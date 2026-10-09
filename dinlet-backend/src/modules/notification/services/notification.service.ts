import { Injectable, NotFoundException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import type { NotificationListQueryDto } from "#/modules/notification/dtos/index.js";
import { NotificationRepository } from "#/modules/notification/repository/index.js";

/** Kullanıcının kendi uygulama içi bildirimleri. */
@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly paginator: Paginator,
    private readonly dateManager: DateManager,
  ) {}

  /** Bildirimleri en yeniden eskiye imleçle sayfalar. */
  async list(
    query: NotificationListQueryDto,
    recipientId: number,
  ): Promise<OkResponse> {
    const { docs, pagination } = await this.paginator.applyCursor({
      cursor: query.cursor,
      limit: query.limit,
      query: (window) =>
        this.notificationRepository.findPageForRecipient(
          recipientId,
          { unreadOnly: query.unreadOnly },
          window,
        ),
    });

    return new OkResponse("Bildirimler listelendi", docs, {
      meta: { pagination },
    });
  }

  /** Okunmamış bildirim sayısı (rozet için). */
  async countUnread(recipientId: number): Promise<OkResponse> {
    return new OkResponse("Okunmamış bildirim sayısı", {
      unreadCount: await this.notificationRepository.countUnread(recipientId),
    });
  }

  /** Tek bildirimi okundu işaretler. Zaten okunmuşsa sessizce başarılı olur. */
  async markRead(id: number, recipientId: number): Promise<OkResponse> {
    const found = await this.notificationRepository.markRead(
      id,
      recipientId,
      this.dateManager.toISOString(),
    );
    if (!found) throw new NotFoundException(`Bildirim bulunamadı: ${id}`);

    return new OkResponse("Bildirim okundu işaretlendi");
  }

  /** Kullanıcının tüm okunmamış bildirimlerini okundu işaretler. */
  async markAllRead(recipientId: number): Promise<OkResponse> {
    const updatedCount = await this.notificationRepository.markAllRead(
      recipientId,
      this.dateManager.toISOString(),
    );
    return new OkResponse(`${updatedCount} bildirim okundu işaretlendi`);
  }
}
