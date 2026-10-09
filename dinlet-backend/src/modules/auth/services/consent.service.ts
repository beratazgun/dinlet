import { Injectable } from "@nestjs/common";

import type { RequestMetadata } from "#/core/decorators/index.js";
import { OkResponse } from "#/core/http/index.js";
import { RedisGetMeHelper } from "#/infra/redis/helpers/redis-get-me.helper.js";
import {
  AuthConsentRepository,
  type ConsentRecord,
} from "#/modules/auth/repository/index.js";
import { CONSENT_VERSIONS } from "#/modules/auth/utils/consents.js";
import { ConsentType } from "#database/enums.js";

export interface ConsentSummary {
  privacyNotice: boolean;
  termsOfUse: boolean;
  crossBorderTransfer: boolean;
}

/**
 * KVKK onay ve rızaları. Onaylar kanıtlanabilir olsun diye metin sürümü, IP
 * ve user-agent ile defterde tutulur. Yurt dışına aktarım rızası (LLM ile
 * anlatım) isteğe bağlıdır: verilmezse Pro notlar da LLM'siz işlenir.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly consentRepository: AuthConsentRepository,
    private readonly publicMeCache: RedisGetMeHelper,
  ) {}

  /**
   * Kayıt formundaki onayların defter kayıtları. Zorunlu metinler DTO'da
   * doğrulandığı için burada kabul edilmiş sayılır; kullanıcı kaydıyla aynı
   * transaction'da yazılır.
   */
  registrationRecords(
    choices: { crossBorderTransfer: boolean },
    metadata: RequestMetadata,
  ): ConsentRecord[] {
    return this.acceptanceRecords(choices, metadata);
  }

  /**
   * Kayıt formu dışında verilen onaylar: Apple / Google ile açılan hesaplar
   * ve metin sürümü değişince yeniden onay. Uygulama `/auth/me`'deki
   * `consents` eksikse bu adıma yönlendirir.
   */
  async recordAcceptance(
    userId: number,
    choices: { crossBorderTransfer: boolean },
    metadata: RequestMetadata,
  ): Promise<OkResponse> {
    await this.consentRepository.record(
      userId,
      this.acceptanceRecords(choices, metadata),
    );
    await this.publicMeCache.invalidate(userId);
    return new OkResponse("Onayların kaydedildi.", await this.getSummary(userId));
  }

  private acceptanceRecords(
    choices: { crossBorderTransfer: boolean },
    metadata: RequestMetadata,
  ): ConsentRecord[] {
    const entry = (type: ConsentType, granted: boolean): ConsentRecord => ({
      type,
      version: CONSENT_VERSIONS[type],
      granted,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return [
      entry(ConsentType.PRIVACY_NOTICE, true),
      entry(ConsentType.TERMS_OF_USE, true),
      entry(ConsentType.CROSS_BORDER_TRANSFER, choices.crossBorderTransfer),
    ];
  }

  /**
   * Güncel durum. Bir metin yeni sürüme geçtiyse eski sürümün onayı
   * geçersiz sayılır (yeniden onay istenir).
   */
  async getSummary(userId: number): Promise<ConsentSummary> {
    const latest = await this.consentRepository.findLatestByUser(userId);
    const isValid = (type: ConsentType) => {
      const consent = latest.get(type);
      return Boolean(
        consent?.granted && consent.version === CONSENT_VERSIONS[type],
      );
    };
    return {
      privacyNotice: isValid(ConsentType.PRIVACY_NOTICE),
      termsOfUse: isValid(ConsentType.TERMS_OF_USE),
      crossBorderTransfer: isValid(ConsentType.CROSS_BORDER_TRANSFER),
    };
  }

  async hasCrossBorderTransferConsent(userId: number): Promise<boolean> {
    return (await this.getSummary(userId)).crossBorderTransfer;
  }
}
