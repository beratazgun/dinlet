import { Injectable, Logger } from "@nestjs/common";

import { DateManager } from "#/core/utils/date-manager.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import { DocumentRepository } from "#/modules/document/repository/index.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const BATCH_SIZE = 50;

/**
 * Silinen notların dosyalarını R2'den ve kayıtlarını veritabanından kalıcı
 * siler (doküman §9: silme hakkı, en geç 7 gün). Bir notun temizliği
 * başarısız olursa diğerleri devam eder; kalan bir sonraki çalışmada denenir.
 */
@Injectable()
export class DocumentPurgeService {
  private readonly logger = new Logger(DocumentPurgeService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly s3Service: S3Service,
    private readonly dateManager: DateManager,
  ) {}

  async purgeDeleted(graceDays: number): Promise<number> {
    const before = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(-graceDays * DAY_MS),
    );
    const documents = await this.documentRepository.findPurgeable(
      before,
      BATCH_SIZE,
    );

    let purged = 0;
    for (const document of documents) {
      try {
        if (document.media) await this.s3Service.deleteFile(document.media.storageKey);
        if (document.extractedKey) await this.s3Service.deleteFile(document.extractedKey);
        await this.s3Service.deleteByPrefix(
          `audio/${document.userId}/${document.id}-${document.storagePrefix}/`,
        );
        await this.documentRepository.hardDelete(document.id, document.mediaId);
        purged++;
      } catch (error) {
        this.logger.error(
          `Not#${document.id} kalıcı silinemedi: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return purged;
  }
}
