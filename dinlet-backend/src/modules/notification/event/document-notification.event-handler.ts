import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  DOCUMENT_FAILED_EVENT,
  DOCUMENT_PROGRESS_EVENT,
  DOCUMENT_READY_EVENT,
  DocumentFailedEvent,
  DocumentProgressEvent,
  DocumentReadyEvent,
} from "#/modules/document/event/document.events.js";
import { NotificationGateway } from "#/modules/notification/gateways/index.js";
import { PushQueueService } from "#/modules/notification/queue/index.js";
import { NotificationDispatchService } from "#/modules/notification/services/index.js";
import { NotificationEntityType, NotificationType } from "#database/enums.js";

/** İstemcinin dinlediği socket olayları (doküman §8 "Socket olayları"). */
export const DocumentSocketEvent = {
  PROGRESS: "document:progress",
  READY: "document:ready",
  FAILED: "document:failed",
} as const;

/**
 * Not işleme olaylarını kullanıcıya iletir: ilerleme socket ile; hazır ve
 * başarısız durumları ayrıca uygulama içi bildirim ve push ile.
 */
@Injectable()
export class DocumentNotificationEventHandler {
  private readonly logger = new Logger(DocumentNotificationEventHandler.name);

  constructor(
    private readonly gateway: NotificationGateway,
    private readonly dispatchService: NotificationDispatchService,
    private readonly pushQueue: PushQueueService,
  ) {}

  @OnEvent(DOCUMENT_PROGRESS_EVENT)
  handleProgress(event: DocumentProgressEvent): void {
    this.gateway.emitToUser(event.userId, DocumentSocketEvent.PROGRESS, {
      documentId: event.documentId,
      status: event.status,
      percent: event.percent,
      readySectionIds: event.readySectionIds,
    });
  }

  @OnEvent(DOCUMENT_READY_EVENT, { async: true })
  async handleReady(event: DocumentReadyEvent): Promise<void> {
    this.gateway.emitToUser(event.userId, DocumentSocketEvent.READY, {
      documentId: event.documentId,
    });

    const title = event.isPartial ? "Notun kısmen hazır" : "Notun dinlemeye hazır";
    const message = event.isPartial
      ? `"${event.title}" notunun bazı bölümleri seslendirilemedi; hazır bölümleri dinleyebilir, kalanları yeniden deneyebilirsin.`
      : `"${event.title}" notunun tüm bölümleri seslendirildi.`;
    await this.notify(event, NotificationType.DOCUMENT_READY, title, message);
  }

  @OnEvent(DOCUMENT_FAILED_EVENT, { async: true })
  async handleFailed(event: DocumentFailedEvent): Promise<void> {
    this.gateway.emitToUser(event.userId, DocumentSocketEvent.FAILED, {
      documentId: event.documentId,
      reason: event.reason,
    });
    await this.notify(
      event,
      NotificationType.DOCUMENT_FAILED,
      "Not işlenemedi",
      `"${event.title}": ${event.reason} Kullanılan sayfa kotası iade edildi.`,
    );
  }

  private async notify(
    event: { userId: number; documentId: number },
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await this.dispatchService.send({
        recipientId: event.userId,
        type,
        entityType: NotificationEntityType.Document,
        entityId: event.documentId,
        title,
        message,
      });
      await this.pushQueue.enqueue(
        {
          userId: event.userId,
          message: {
            title,
            body: message,
            data: { type, documentId: event.documentId },
          },
        },
      );
    } catch (error) {
      // Bildirim hatası işleme hattını etkilemez.
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
