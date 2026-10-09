import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CreatedResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { Generator } from "#/core/utils/generator.js";
import { RedisPendingUploadHelper } from "#/infra/redis/helpers/redis-pending-upload.helper.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import type {
  CreateMediaUploadBodyDto,
  UploadIdParamDto,
} from "#/modules/media/dtos/index.js";
import { MediaRepository } from "#/modules/media/repository/index.js";
import type { Media } from "#/modules/media/types/index.js";
import {
  assertUploadAllowed,
  extensionFor,
  hasPdfSignature,
} from "#/modules/media/utils/index.js";
import type { EnvType } from "#config/env.validation.js";

/** İmzalı URL'in geçerlilik süresi. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** Tamamlama için tanınan süre; imzalı URL süresinden uzun tutulur. */
const PENDING_UPLOAD_TTL_SECONDS = 30 * 60;

/**
 * Doğrudan depolamaya (R2/S3) yükleme. Dosya API sunucusuna uğramaz:
 * 1. `createUpload` imzalı `PUT` URL'i üretir, bekleyen yüklemeyi Redis'e yazar.
 * 2. `completeUpload` nesneyi doğrular, kalıcı anahtara taşır ve kaydı açar.
 */
@Injectable()
export class MediaUploadService {
  private readonly logger = new Logger(MediaUploadService.name);
  private readonly maxSize: number;

  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly pendingUploads: RedisPendingUploadHelper,
    private readonly s3Service: S3Service,
    private readonly dateManager: DateManager,
    configService: ConfigService<EnvType>,
  ) {
    this.maxSize = Number.parseInt(
      configService.getOrThrow("MAX_MEDIA_SIZE", { infer: true }),
      10,
    );
  }

  async createUpload(
    body: CreateMediaUploadBodyDto,
    userId: number,
  ): Promise<CreatedResponse> {
    assertUploadAllowed(body, this.maxSize);

    const uploadId = Generator.random(24, "textAndNumber").toLowerCase();
    const temporaryKey = `tmp/uploads/${userId}/${uploadId}.${extensionFor(body.mimeType)}`;

    const { url, headers } = await this.s3Service.createUploadUrl({
      key: temporaryKey,
      contentType: body.mimeType,
      contentLength: body.size,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    await this.pendingUploads.save(
      {
        uploadId,
        userId,
        temporaryKey,
        fileName: body.fileName,
        mimeType: body.mimeType,
        size: body.size,
      },
      PENDING_UPLOAD_TTL_SECONDS,
    );

    return new CreatedResponse("Yükleme URL'i oluşturuldu", {
      uploadId,
      uploadUrl: url,
      headers,
      expiresAt: this.dateManager.toISOString(
        this.dateManager.addMilliseconds(UPLOAD_URL_TTL_SECONDS * 1_000),
      ),
    });
  }

  async completeUpload(
    params: UploadIdParamDto,
    userId: number,
  ): Promise<CreatedResponse> {
    // Atomik alma: eşzamanlı ikinci tamamlama isteği kaydı bulamaz.
    const upload = await this.pendingUploads.take(params.uploadId);
    if (!upload || upload.userId !== userId) {
      if (upload) {
        await this.pendingUploads.save(upload, PENDING_UPLOAD_TTL_SECONDS);
      }
      throw new NotFoundException(
        "Yükleme bulunamadı veya süresi doldu. Lütfen yeniden yükleyin.",
      );
    }

    const stored = await this.s3Service.stat(upload.temporaryKey);
    if (!stored) {
      // İstemci henüz PUT etmemiş; tekrar deneyebilsin diye kayıt geri konur.
      await this.pendingUploads.save(upload, PENDING_UPLOAD_TTL_SECONDS);
      throw new UnprocessableEntityException(
        "Dosya henüz depolamaya yüklenmemiş. Önce verilen URL'e PUT isteği gönderin.",
      );
    }

    if (
      stored.size !== upload.size ||
      (stored.contentType !== null && stored.contentType !== upload.mimeType)
    ) {
      await this.s3Service.deleteFile(upload.temporaryKey);
      throw new UnprocessableEntityException(
        "Yüklenen dosya bildirilen boyut veya türle uyuşmuyor; yükleme iptal edildi.",
      );
    }

    // İçerik bildirilen türle uyuşmalı: PDF dediği dosya gerçekten PDF mi?
    if (upload.mimeType === "application/pdf") {
      const head = await this.s3Service.getFileHead(upload.temporaryKey, 5);
      if (!head || !hasPdfSignature(head)) {
        await this.s3Service.deleteFile(upload.temporaryKey);
        throw new UnprocessableEntityException(
          "Yüklenen dosya geçerli bir PDF değil; yükleme iptal edildi.",
        );
      }
    }

    const month = this.dateManager.toISOString().slice(0, 7);
    const storageKey = `media/${userId}/${month}/${upload.uploadId}.${extensionFor(upload.mimeType)}`;
    await this.s3Service.copyFile(upload.temporaryKey, storageKey);

    let media: Media;
    try {
      media = await this.mediaRepository.create({
        storageKey,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        size: upload.size,
        uploaderId: userId,
      });
    } catch (error) {
      await this.s3Service.deleteFile(storageKey).catch(() => undefined);
      throw error;
    }

    // Geçici nesne kalırsa bucket lifecycle kuralı temizler; hata akışı bozmaz.
    await this.s3Service
      .deleteFile(upload.temporaryKey)
      .catch((error: unknown) =>
        this.logger.warn(
          `Geçici yükleme silinemedi (${upload.temporaryKey}): ${String(error)}`,
        ),
      );

    return new CreatedResponse("Medya kaydedildi", media);
  }
}
