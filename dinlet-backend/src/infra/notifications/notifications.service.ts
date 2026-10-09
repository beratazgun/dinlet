import { NotificationChannelType } from "#database/enums.js";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvType } from "#config/env.validation.js";
import { NotificationProvider } from "#/infra/notifications/providers/abstract.provider.js";
import { NotificationResult, SendNotificationParams } from "#/infra/notifications/types/index.js";
import { DatabaseService } from "#database/database.service.js";
import { NOTIFICATION_TEMPLATES_BY_CODE } from "#/infra/notifications/constants/notification-templates.constant.js";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private providers: Map<string, NotificationProvider> = new Map();

  constructor(
    @Inject("NOTIFICATION_PROVIDERS")
    private notificationProviders: Record<string, NotificationProvider>,
    private database: DatabaseService,
    private readonly configService: ConfigService<EnvType>,
  ) {
    this.initializeProviders();
  }

  private initializeProviders() {
    Object.entries(this.notificationProviders).forEach(([name, provider]) => {
      this.providers.set(name, provider);
    });
  }

  /**
   * Bildirimi gönder
   * @param params Send notification parameters
   * @returns Notification result
   */
  async send(params: SendNotificationParams): Promise<NotificationResult> {
    const provider = this.getProviderForType(params.channel);

    if (!provider) {
      return {
        success: false,
        error: `${params.channel} türü için provider tanımlanmamış`,
      };
    }

    return provider.send(params);
  }

  /**
   * Email gönder (varsayılan — sadece aktif provider)
   */
  async sendEmail(
    params: Omit<SendNotificationParams, "channel">,
  ): Promise<NotificationResult> {
    return this.send({
      channel: "EMAIL",
      ...params,
    });
  }

  /**
   * DB'deki template'i bulur (yoksa kod içi varsayılan şablonu kullanır),
   * subject'teki değişkenleri yerleştirir, önce Brevo ile gönderir;
   * başarısız olursa Resend'e düşer.
   *
   * Kullanım senaryosu:
   *   - Brevo kota/servis hatası → Resend'e düşer
   *   - Brevo API_KEY eksik      → Resend'e düşer
   *   - Her iki provider da başarısız → son hatayı döner
   */
  async sendEmailWithFallback(params: {
    to: string | string[];
    code: string;
    variables: Record<string, unknown>;
  }): Promise<NotificationResult> {
    const dbTemplate =
      await this.database.client.orm.public.NotificationTemplates.where({
        code: params.code,
      }).first();

    const fallbackTemplate = NOTIFICATION_TEMPLATES_BY_CODE.get(params.code);

    if (!dbTemplate && !fallbackTemplate) {
      return {
        success: false,
        error: `${params.code} kodlu template bulunamadı`,
      };
    }

    if (!dbTemplate && fallbackTemplate) {
      this.logger.debug?.(
        `"${params.code}" şablonu DB'de bulunamadı, kod içi varsayılan şablon kullanılıyor.`,
      );
    }

    const templateMeta = dbTemplate ?? fallbackTemplate!;
    let subject = templateMeta.subject;

    Object.entries(params.variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, String(value ?? ""));
    });

    // `EMAIL_DELIVERY=log`: şablon çözülür ama sağlayıcıya gidilmez (test,
    // API anahtarı olmayan yerel geliştirme).
    if (this.configService.get("EMAIL_DELIVERY", { infer: true }) === "log") {
      this.logger.log(
        `[EMAIL_DELIVERY=log] ${params.code} → ${String(params.to)}: "${subject}"`,
      );
      return { success: true };
    }

    const sendParams: SendNotificationParams = {
      channel: "EMAIL",
      to: params.to,
      subject,
      templateName: templateMeta.template || "",
      variables: params.variables,
    };

    const brevo = this.providers.get("brevo.provider");
    const resend = this.providers.get("email.provider");

    if (brevo) {
      const result = await brevo.send(sendParams);
      if (result.success) {
        return result;
      }
      this.logger.warn(
        `Brevo başarısız (${result.error}), Resend'e geçiliyor…`,
      );
    } else {
      this.logger.warn(
        "brevo.provider kayıtlı değil, doğrudan Resend kullanılıyor.",
      );
    }

    if (resend) {
      return resend.send(sendParams);
    }

    return { success: false, error: "Hiçbir email provider bulunamadı." };
  }

  /**
   * Operasyon/sistem uyarısı e-postası (OPS_ALERT) gönderir.
   */
  async sendOpsAlert(params: {
    title: string;
    details: string;
    to?: string;
    checkedAt?: string;
  }): Promise<NotificationResult> {
    const to =
      params.to || this.configService.get("ALERT_EMAIL", { infer: true });
    if (!to) {
      this.logger.warn(
        `OPS_ALERT gönderilemedi (ALERT_EMAIL tanımlı değil): ${params.title}`,
      );
      return { success: false, error: "ALERT_EMAIL tanımlı değil" };
    }

    return this.sendEmailWithFallback({
      to,
      code: "OPS_ALERT",
      variables: {
        title: params.title,
        details: params.details,
        checkedAt:
          params.checkedAt ||
          new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
      },
    });
  }

  /**
   * Bildirimi test et
   */
  async testNotification(channel: NotificationChannelType): Promise<boolean> {
    const provider = this.getProviderForType(channel);

    if (!provider) {
      console.warn(`${channel} türü için provider tanımlanmamış`);
      return false;
    }

    return provider.test();
  }

  /**
   * Notification type'ına uygun provider'ı getir
   */
  private getProviderForType(
    channel: NotificationChannelType,
  ): NotificationProvider | null {
    // Varsayılan olarak provider adını type ile eşleştir
    const providerName = `${channel.toLowerCase()}.provider`;
    return this.providers.get(providerName) || null;
  }

  /**
   * Mevcut providers'ı liste
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
