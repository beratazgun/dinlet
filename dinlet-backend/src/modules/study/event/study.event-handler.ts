import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  SECTION_COMPLETED_EVENT,
  SectionCompletedEvent,
} from "#/modules/document/event/document.events.js";
import { ReviewService } from "#/modules/study/services/index.js";

/** Belge modülündeki dinleme olaylarından aralıklı tekrarı besler. */
@Injectable()
export class StudyEventHandler {
  private readonly logger = new Logger(StudyEventHandler.name);

  constructor(private readonly reviewService: ReviewService) {}

  @OnEvent(SECTION_COMPLETED_EVENT)
  async handleSectionCompleted(event: SectionCompletedEvent): Promise<void> {
    try {
      await this.reviewService.enroll(event.userId, event.sectionId);
    } catch (error) {
      this.logger.warn(
        `Bölüm#${event.sectionId} tekrara eklenemedi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
