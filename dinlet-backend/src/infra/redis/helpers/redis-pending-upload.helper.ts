import { Injectable } from "@nestjs/common";
import { RedisService } from "#/infra/redis/redis.service.js";

/**
 * Yükleme URL'i verilmiş ama henüz tamamlanmamış dosya. Kalıcı değildir;
 * süresi dolunca kendiliğinden düşer (geçici nesneyi bucket lifecycle
 * kuralı siler).
 */
export interface PendingUpload {
  uploadId: string;
  userId: number;
  /** Geçici nesne anahtarı (`tmp/` altında). */
  temporaryKey: string;
  fileName: string;
  mimeType: string;
  /** İstemcinin bildirdiği ve imzaya giren boyut (bayt). */
  size: number;
}

/** Tamamlanmamış yüklemelerin kısa ömürlü kaydı (`media:upload:<uploadId>`). */
@Injectable()
export class RedisPendingUploadHelper {
  constructor(private readonly redisService: RedisService) {}

  private key(uploadId: string) {
    return this.redisService.createKey("PENDING_MEDIA_UPLOAD", uploadId);
  }

  async save(upload: PendingUpload, ttlSeconds: number): Promise<void> {
    await this.redisService.setJson(
      this.key(upload.uploadId),
      upload,
      ttlSeconds,
    );
  }

  /**
   * Kaydı atomik olarak okuyup siler. Aynı yükleme iki kez tamamlanmaya
   * çalışılırsa yalnızca ilki kaydı alır.
   */
  take(uploadId: string): Promise<PendingUpload | null> {
    return this.redisService.takeJson<PendingUpload>(this.key(uploadId));
  }
}
