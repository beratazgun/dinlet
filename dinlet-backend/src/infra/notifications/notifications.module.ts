import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NotificationsService } from "#/infra/notifications/notifications.service.js";
import { BrevoProvider } from "#/infra/notifications/providers/brevo.provider.js";
import { ResendProvider } from "#/infra/notifications/providers/resend.provider.js";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    NotificationsService,
    BrevoProvider,
    ResendProvider,
    {
      provide: "NOTIFICATION_PROVIDERS",
      useFactory: (
        brevoProvider: BrevoProvider,
        resendProvider: ResendProvider,
      ) => ({
        // Brevo → primary email provider
        "brevo.provider": brevoProvider,
        // Resend → fallback email provider
        "email.provider": resendProvider,
      }),
      inject: [BrevoProvider, ResendProvider],
    },
  ],
  exports: [NotificationsService, "NOTIFICATION_PROVIDERS"],
})
export class NotificationsModule {}
