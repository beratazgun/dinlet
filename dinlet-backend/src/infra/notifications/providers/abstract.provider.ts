import { NotificationResult, SendNotificationParams } from "#/infra/notifications/types/index.js";

export abstract class NotificationProvider {
  /**
   * Template'i render et ve gönder
   */
  abstract send(params: SendNotificationParams): Promise<NotificationResult>;

  /**
   * Provider'ın bağlantısını test et
   */
  abstract test(): Promise<boolean>;
}
