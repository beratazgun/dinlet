import { Injectable } from "@nestjs/common";

import { NotificationGateway } from "#/modules/notification/gateways/index.js";
import { NotificationRepository } from "#/modules/notification/repository/index.js";
import type {
  NewNotification,
  Notification,
} from "#/modules/notification/types/index.js";

/**
 * Bildirimi kaydeder ve alıcının açık bağlantılarına anlık iletir.
 * Diğer modüller bu servisi doğrudan çağırmaz; kendi domain event'lerini
 * yayınlar, bu modülün event handler'ları dinleyip burayı çağırır.
 */
@Injectable()
export class NotificationDispatchService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async send(input: NewNotification): Promise<Notification> {
    const notification = await this.notificationRepository.create(input);
    this.notificationGateway.notify(notification.recipientId, notification);
    return notification;
  }
}
