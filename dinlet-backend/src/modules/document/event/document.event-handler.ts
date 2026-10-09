import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  USER_DELETED_EVENT,
  UserDeletedEvent,
} from "#/modules/auth/event/auth.events.js";
import {
  DOCUMENT_CREATED_EVENT,
  DocumentCreatedEvent,
} from "#/modules/document/event/document.events.js";
import { DocumentRepository } from "#/modules/document/repository/index.js";
import { DocumentPipelineService } from "#/modules/document/services/document-pipeline.service.js";

/**
 * Belge açıldıktan sonra metin çıkarma işini kuyruğa alır; hesap silinince
 * kullanıcının notlarını kapatır.
 */
@Injectable()
export class DocumentEventHandler {
  private readonly logger = new Logger(DocumentEventHandler.name);

  constructor(
    private readonly pipeline: DocumentPipelineService,
    private readonly documentRepository: DocumentRepository,
  ) {}

  @OnEvent(DOCUMENT_CREATED_EVENT, { async: true })
  async onCreated(event: DocumentCreatedEvent): Promise<void> {
    try {
      await this.pipeline.startExtraction(event.documentId);
    } catch (error) {
      // Kuyruğa alınamayan belge `QUEUED` kalır; uzlaştırıcı yeniden dener.
      this.logger.error(
        `Belge#${event.documentId} kuyruğa alınamadı: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Notlar soft delete edilir; dosyalar `DATA_PURGE` ile kalıcı silinir. */
  @OnEvent(USER_DELETED_EVENT, { async: true })
  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    try {
      await this.documentRepository.softDeleteAllForUser(event.userId);
    } catch (error) {
      // Kalan notlar kullanıcı temizliğinde (`DATA_PURGE`) yakalanır.
      this.logger.error(
        `Kullanıcı#${event.userId} notları kapatılamadı: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
