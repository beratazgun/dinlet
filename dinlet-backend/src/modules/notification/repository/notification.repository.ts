import { Injectable } from "@nestjs/common";

import type { CursorWindow } from "#/core/utils/paginator.js";
import type {
  NewNotification,
  Notification,
  NotificationFilter,
} from "#/modules/notification/types/index.js";
import { DatabaseService } from "#database/database.service.js";

const NOTIFICATION_FIELDS = [
  "id",
  "recipientId",
  "actorId",
  "type",
  "entityType",
  "entityId",
  "title",
  "message",
  "isRead",
  "readAt",
  "createdAt",
] as const;

/** Bildirim kayıtları. Her sorgu tek alıcıyla sınırlıdır. */
@Injectable()
export class NotificationRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  create(input: NewNotification): Promise<Notification> {
    return this.db.orm.public.Notification.select(...NOTIFICATION_FIELDS).create(
      {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        title: input.title ?? null,
        message: input.message,
      },
    );
  }

  /** `(createdAt, id)` azalan keyset sayfası. */
  async findPageForRecipient(
    recipientId: number,
    filter: NotificationFilter,
    window: CursorWindow,
  ): Promise<Notification[]> {
    let query = this.db.orm.public.Notification.where({ recipientId });
    if (filter.unreadOnly) query = query.where({ isRead: false });

    const after = window.after;
    if (after) {
      // `.cursor()`'ın OR koşulundan index sınırı çıkmadığı için tarama
      // doğrudan imleç konumundan başlatılır (bkz. AuditLogRepository).
      query = query.where((notification) =>
        notification.createdAt.lte(after.createdAt),
      );
    }

    return await query
      .select(...NOTIFICATION_FIELDS)
      .orderBy([
        (notification) => notification.createdAt.desc(),
        (notification) => notification.id.desc(),
      ])
      .cursor(after ?? {})
      .limit(window.limit)
      .all();
  }

  async countUnread(recipientId: number): Promise<number> {
    const { total } = await this.db.orm.public.Notification.where({
      recipientId,
      isRead: false,
    }).aggregate((aggregate) => ({ total: aggregate.count() }));
    return total;
  }

  /** Okundu işaretler; bildirim alıcıya ait değilse `false` döner. */
  async markRead(
    id: number,
    recipientId: number,
    readAt: string,
  ): Promise<boolean> {
    const existing = await this.db.orm.public.Notification.where({
      id,
      recipientId,
    })
      .select("id", "isRead")
      .first();
    if (!existing) return false;

    if (!existing.isRead) {
      await this.db.orm.public.Notification.where({ id }).update({
        isRead: true,
        readAt,
      });
    }
    return true;
  }

  /** Tüm okunmamışları okundu yapar; etkilenen kayıt sayısını döner. */
  markAllRead(recipientId: number, readAt: string): Promise<number> {
    return this.db.orm.public.Notification.where({
      recipientId,
      isRead: false,
    }).updateAndCount({ isRead: true, readAt });
  }
}
