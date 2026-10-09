import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  STORE_SUBMISSION_REVIEWED_EVENT,
  StoreSubmissionReviewedEvent,
} from "#/modules/store/event/store.events.js";
import { PushQueueService } from "#/modules/notification/queue/index.js";
import { NotificationDispatchService } from "#/modules/notification/services/index.js";
import { NotificationEntityType, NotificationType } from "#database/enums.js";

/** Paylaşım başvurusunun sonucu: uygulama içi bildirim ve push. */
@Injectable()
export class StoreNotificationEventHandler {
  private readonly logger = new Logger(StoreNotificationEventHandler.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    private readonly pushQueue: PushQueueService,
  ) {}

  @OnEvent(STORE_SUBMISSION_REVIEWED_EVENT, { async: true })
  async handleReviewed(event: StoreSubmissionReviewedEvent): Promise<void> {
    const type = event.approved
      ? NotificationType.STORE_SUBMISSION_APPROVED
      : NotificationType.STORE_SUBMISSION_REJECTED;
    const title = event.approved ? "Notun mağazada" : "Paylaşımın onaylanmadı";
    const message = event.approved
      ? `"${event.title}" artık mağazada; herkes ücretsiz dinleyebilir.`
      : `"${event.title}": ${event.reason}`;
    try {
      await this.dispatchService.send({
        recipientId: event.userId,
        type,
        entityType: NotificationEntityType.StoreSubmission,
        entityId: event.submissionId,
        title,
        message,
      });
      await this.pushQueue.enqueue({
        userId: event.userId,
        message: {
          title,
          body: message,
          data: {
            type,
            submissionId: event.submissionId,
            storeItemId: event.storeItemId,
          },
        },
      });
    } catch (error) {
      // Bildirim hatası kararı geri almaz.
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
