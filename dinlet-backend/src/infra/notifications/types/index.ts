import { NotificationChannelType } from "#database/enums.js";

export interface SendNotificationParams {
  to: string | string[];
  templateName?: string;
  content?: string;
  subject: string;
  variables?: Record<string, unknown>;
  channel: NotificationChannelType;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
