import type { PushMessage } from "#/modules/notification/services/expo-push.service.js";

export const PushJobName = { SEND: "send-push" } as const;

/** Bir kullanıcının tüm cihazlarına gidecek push bildirimi. */
export interface PushJobData {
  userId: number;
  message: PushMessage;
}
