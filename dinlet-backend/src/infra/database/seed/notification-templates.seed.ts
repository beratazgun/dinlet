import { db } from "#database/db.js";
import { NotificationChannelType } from "#database/enums.js";
import { NOTIFICATION_TEMPLATES } from "#/infra/notifications/constants/notification-templates.constant.js";

export async function seedNotificationTemplates(): Promise<void> {
  console.log("✉️  E-posta şablonları yükleniyor...");

  for (const template of NOTIFICATION_TEMPLATES) {
    const values = {
      name: template.name,
      channel: NotificationChannelType.EMAIL,
      subject: template.subject,
      template: template.template,
      params: template.params,
    };
    await db.orm.public.NotificationTemplates.upsert({
      create: { code: template.code, ...values },
      update: values,
      conflictOn: { code: template.code },
    });
  }

  console.log(`✅ ${NOTIFICATION_TEMPLATES.length} şablon hazır`);
}
