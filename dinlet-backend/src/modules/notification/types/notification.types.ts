import type {
  NotificationEntityType,
  NotificationType,
} from "#database/enums.js";

/** Kullanıcıya uygulama içinde gösterilen bildirim. */
export interface Notification {
  id: number;
  recipientId: number;
  actorId: number | null;
  type: NotificationType;
  entityType: NotificationEntityType | null;
  entityId: number | null;
  title: string | null;
  message: string;
  isRead: boolean;
  /** ISO 8601 */
  readAt: string | null;
  /** ISO 8601 */
  createdAt: string;
}

export interface NewNotification {
  recipientId: number;
  actorId?: number | null;
  type: NotificationType;
  entityType?: NotificationEntityType | null;
  entityId?: number | null;
  title?: string | null;
  message: string;
}

export interface NotificationFilter {
  unreadOnly?: boolean;
}
