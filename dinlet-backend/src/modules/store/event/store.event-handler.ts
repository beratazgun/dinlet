import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  REVENUECAT_PRODUCT_EVENT,
  RevenueCatProductEvent,
} from "#/modules/billing/event/billing.events.js";
import {
  USER_DELETED_EVENT,
  UserDeletedEvent,
} from "#/modules/auth/event/auth.events.js";
import {
  StoreLibraryService,
  StoreSubmissionService,
} from "#/modules/store/services/index.js";

/**
 * Mağazayı ilgilendiren dış olaylar: RevenueCat'ten gelen tek seferlik satın
 * alma ve iadeler (webhook dinleyiciyi `emitAsync` ile bekler; hata yutulmaz
 * ki RevenueCat olayı yeniden göndersin) ve hesap silme.
 */
@Injectable()
export class StoreEventHandler {
  constructor(
    private readonly libraryService: StoreLibraryService,
    private readonly submissionService: StoreSubmissionService,
  ) {}

  @OnEvent(REVENUECAT_PRODUCT_EVENT, { suppressErrors: false })
  handleProductEvent(event: RevenueCatProductEvent): Promise<boolean> {
    return this.libraryService.handleProductEvent(event);
  }

  /** Hesabı silinen kullanıcının paylaştığı notlar mağazadan kalkar. */
  @OnEvent(USER_DELETED_EVENT, { async: true })
  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    await this.submissionService.unpublishAuthor(event.userId);
  }
}
