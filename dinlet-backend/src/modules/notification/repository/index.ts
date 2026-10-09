import { NotificationRepository } from "./notification.repository.js";
import { PushTokenRepository } from "./push-token.repository.js";

export { NotificationRepository, PushTokenRepository };

export const NotificationRepositories = [
  NotificationRepository,
  PushTokenRepository,
];
