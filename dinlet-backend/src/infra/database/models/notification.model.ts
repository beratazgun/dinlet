import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

export const NotificationEntityType = enumType(
  "NotificationEntityType",
  pgText,
  member("Document"),
  member("StoreSubmission"),
);

export const NotificationType = enumType(
  "NotificationType",
  pgText,
  member("PASSWORD_CHANGED"),
  member("ACCOUNT_LOCKED"),
  member("NEW_DEVICE_LOGIN"),
  member("DOCUMENT_READY"),
  member("DOCUMENT_FAILED"),
  member("STORE_SUBMISSION_APPROVED"),
  member("STORE_SUBMISSION_REJECTED"),
);

export const NotificationChannelType = enumType(
  "NotificationChannelType",
  pgText,
  member("EMAIL"),
  member("SMS"),
  member("PUSH"),
);

export const DevicePlatform = enumType(
  "DevicePlatform",
  pgText,
  member("IOS"),
  member("ANDROID"),
);

export const notificationEnums = {
  NotificationEntityType,
  NotificationType,
  NotificationChannelType,
  DevicePlatform,
};

export function createNotificationModels({ field, model }: ModelHelpers) {
  const NotificationTemplates = model("NotificationTemplates", {
    fields: {
      id: autoIncrementId(field),
      name: field.text().unique(),
      code: field.text().unique(),
      channel: field.namedType(NotificationChannelType),
      subject: field.text(),
      template: field.text().optional(),
      content: field.text().optional(),
      params: field.text().many(),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "notification_templates",
    indexes: [constraints.index([cols.channel])],
  }));

  const Notification = model("Notification", {
    fields: {
      id: autoIncrementId(field),
      recipientId: field.int().column("recipient_id"),
      actorId: field.int().optional().column("actor_id"),
      type: field.namedType(NotificationType),
      entityType: field
        .namedType(NotificationEntityType)
        .optional()
        .column("entity_type"),
      entityId: field.int().optional().column("entity_id"),
      title: field.text().optional(),
      message: field.text(),
      actions: field.json().default([]),
      isRead: field.boolean().default(false).column("is_read"),
      readAt: field.temporal.timestamptzString().optional().column("read_at"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [
        // Varsayılan otomatik isim ("notifications_recipient_id_actor_id_type_entity_type_entity_id_key")
        // PostgreSQL'in 63 karakter identifier sınırını aşıp kırpılıyor ve doğrulama başarısız oluyordu;
        // bu yüzden kısa, açık bir isim veriyoruz.
        constraints.unique(
          [
            fields.recipientId,
            fields.actorId,
            fields.type,
            fields.entityType,
            fields.entityId,
          ],
          { name: "notifications_target_key" },
        ),
      ],
    }))
    .sql(({ cols, constraints }) => ({
      table: "notifications",
      indexes: [
        constraints.index([cols.recipientId, cols.isRead, cols.createdAt]),
        constraints.index([cols.recipientId, cols.createdAt]),
        constraints.index([cols.actorId]),
      ],
    }));

  /** Kullanıcının cihazlarındaki Expo push token'ları. */
  const PushToken = model("PushToken", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      token: field.text().unique(),
      platform: field.namedType(DevicePlatform),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "push_tokens",
    indexes: [constraints.index([cols.userId])],
  }));

  return { NotificationTemplates, Notification, PushToken };
}
