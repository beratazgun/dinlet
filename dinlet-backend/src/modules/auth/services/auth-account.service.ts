import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { FastifyRequest } from "fastify";
import { NoContentResponse, OkResponse } from "#/core/http/index.js";
import { Generator } from "#/core/utils/generator.js";
import { AccountType } from "#database/enums.js";
import { RedisService } from "#/infra/redis/redis.service.js";
import type { DeleteAccountBodyDto } from "#/modules/auth/dtos/index.js";
import {
  ACCOUNT_DELETION_REQUESTED_EVENT,
  AccountDeletionRequestedEvent,
  USER_DELETED_EVENT,
  UserDeletedEvent,
} from "#/modules/auth/event/auth.events.js";
import {
  AuthAccountRepository,
  AuthUserRepository,
} from "#/modules/auth/repository/index.js";
import { AuthSessionService } from "#/modules/auth/services/auth-session.service.js";

@Injectable()
export class AuthAccountService {
  constructor(
    private readonly userRepository: AuthUserRepository,
    private readonly accountRepository: AuthAccountRepository,
    private readonly sessionService: AuthSessionService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async unlinkAccount(
    userId: number,
    accountId: number,
  ): Promise<NoContentResponse> {
    const accounts =
      await this.accountRepository.findUserAccountsForUnlink(userId);
    if (accounts.length === 0) {
      throw new UnprocessableEntityException("Kullanıcı bulunamadı.");
    }

    const target = accounts.find((account) => account.id === accountId);
    if (!target) throw new UnprocessableEntityException("Hesap bulunamadı.");
    if (target.type === AccountType.LOCAL) {
      throw new UnprocessableEntityException(
        "LOCAL hesap kaldırılamaz. Hesabınızı silmek için hesap silme işlemini kullanın.",
      );
    }

    const remaining = accounts.filter((account) => account.id !== accountId);
    if (
      remaining.length === 0 ||
      (!remaining.some(
        (account) => account.type === AccountType.LOCAL && account.hasPassword,
      ) &&
        !remaining.some((account) => account.type !== AccountType.LOCAL))
    ) {
      throw new UnprocessableEntityException(
        "Bu hesabı kaldıramazsınız. Kaldırma sonrası giriş yapabileceğiniz bir hesap kalmaz.",
      );
    }

    await this.accountRepository.deleteAccountById(accountId, userId);
    await this.redisService.clear([{ key: "PUBLIC_ME", params: { userId } }]);
    return new NoContentResponse("Hesap bağlantısı kaldırıldı.");
  }

  async requestAccountDeletion(userId: number): Promise<OkResponse> {
    const user = await this.userRepository.findUserWithDetails(userId);
    if (!user) {
      throw new UnprocessableEntityException("Kullanıcı bulunamadı.");
    }

    const code = Generator.random(6, "numeric").toString().padStart(6, "0");
    const redisKey = this.redisService.createKey(
      "ACCOUNT_DELETION_CODE",
      userId,
    );
    await this.redisService.set(redisKey, code);
    this.eventEmitter.emit(
      ACCOUNT_DELETION_REQUESTED_EVENT,
      new AccountDeletionRequestedEvent(userId, code),
    );
    return new OkResponse(
      "Hesap silme doğrulama kodu e-posta adresinize gönderildi.",
    );
  }

  async deleteAccount(
    request: FastifyRequest,
    userId: number,
    body: DeleteAccountBodyDto,
  ): Promise<NoContentResponse> {
    if (!(await this.userRepository.findById(userId))) {
      throw new UnprocessableEntityException("Kullanıcı bulunamadı.");
    }

    const redisKey = this.redisService.createKey(
      "ACCOUNT_DELETION_CODE",
      userId,
    );
    const savedCode = await this.redisService.get(redisKey);
    if (!savedCode || savedCode !== body.code) {
      throw new UnprocessableEntityException(
        "Geçersiz veya süresi dolmuş doğrulama kodu.",
      );
    }

    await this.redisService.del(redisKey);
    return this.eraseAccount(request, userId);
  }

  /**
   * Hesabı ve tüm verilerini siler (KVKK silme hakkı, App Store zorunluluğu).
   * Giriş hesapları kalkar, kullanıcı anonimleştirilir, tüm oturumlar kapanır.
   * Notlar ve dosyalar `USER_DELETED_EVENT` ile kapatılır; R2'deki PDF ve
   * sesler zamanlanmış temizlikte (`DATA_PURGE`) kalıcı silinir.
   */
  async eraseAccount(
    request: FastifyRequest,
    userId: number,
  ): Promise<NoContentResponse> {
    if (!(await this.userRepository.findById(userId))) {
      throw new UnprocessableEntityException("Kullanıcı bulunamadı.");
    }

    await this.userRepository.anonymizeAndSoftDelete(userId);
    // Silinen hesabın hiçbir cihazda açık oturumu kalmamalı.
    await this.sessionService.terminateAllSessions(request, userId);
    await this.redisService.clear([{ key: "PUBLIC_ME", params: { userId } }]);
    this.eventEmitter.emit(USER_DELETED_EVENT, new UserDeletedEvent(userId));

    return new NoContentResponse("Hesap silindi.", {
      clearCookies: this.sessionService.buildClearCookies(),
    });
  }
}
