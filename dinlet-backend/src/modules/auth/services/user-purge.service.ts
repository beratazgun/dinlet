import { Injectable, Logger } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import { AuthUserRepository } from "#/modules/auth/repository/index.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const BATCH_SIZE = 50;

/**
 * Silinen hesapları kalıcı siler. Notları önce `DocumentPurgeService`
 * temizler; burada notu kalmamış kullanıcıların kalan yüklemeleri ve
 * satırı (FK ile bağlı tüm kayıtlar) silinir.
 */
@Injectable()
export class UserPurgeService {
  private readonly logger = new Logger(UserPurgeService.name);

  constructor(
    private readonly userRepository: AuthUserRepository,
    private readonly s3Service: S3Service,
    private readonly dateManager: DateManager,
  ) {}

  async purgeDeleted(graceDays: number): Promise<number> {
    const before = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(-graceDays * DAY_MS),
    );
    const userIds = await this.userRepository.findPurgeable(before, BATCH_SIZE);

    let purged = 0;
    for (const userId of userIds) {
      try {
        const uploads = await this.userRepository.findUploadKeys(userId);
        await this.s3Service.deleteFiles(uploads.map((upload) => upload.storageKey));
        await this.userRepository.hardDelete(userId);
        purged++;
      } catch (error) {
        this.logger.error(
          `Kullanıcı#${userId} kalıcı silinemedi: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return purged;
  }
}
