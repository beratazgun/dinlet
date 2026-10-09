import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { NotificationProvider } from "#/infra/notifications/providers/abstract.provider.js";
import { NotificationResult, SendNotificationParams } from "#/infra/notifications/types/index.js";
import * as React from "react";
import { EnvType } from "#config/env.validation.js";
import { getEmailTemplate } from "#/infra/notifications/templates/index.js";

/**
 * Resend.com email provider
 * @see https://resend.com/docs
 */
@Injectable()
export class ResendProvider extends NotificationProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private resend: Resend | null = null;
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly nodeEnv: string;
  private readonly devEmail: string;

  constructor(private readonly configService: ConfigService<EnvType>) {
    super();
    this.apiKey = this.configService.get<string>("RESEND_API_KEY", "");
    this.fromEmail = this.configService.get<string>(
      "RESEND_FROM_EMAIL",
      "onboarding@resend.dev",
    );
    this.nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    this.devEmail = this.configService.get<string>(
      "RESEND_MAIL_FOR_DEV_ENV",
      "delivered@resend.dev",
    );
  }

  async send(params: SendNotificationParams): Promise<NotificationResult> {
    this.validateEmailChannel(params.channel);

    if (!this.isProductionEnv()) {
      this.logger.log(
        `Development modunda email gönderimi simüle ediliyor (Alıcı: ${this.devEmail})`,
      );
      // Local ortamda gerçek mail gitmesini istiyorsan alttaki return'ü kaldırabilirsin.
      // return this.createSuccessResult('dev-mode-skip');
    }

    try {
      const cleanTemplateName = this.cleanTemplateName(
        params.templateName || "",
      );
      const Template = getEmailTemplate(cleanTemplateName);
      if (!Template)
        throw new Error(`Template bulunamadı: ${cleanTemplateName}`);

      // SDK direkt React bileşenini desteklediği için renderReactEmail'e gerek kalmadı.
      // ÖNEMLİ: Resend dökümanına göre bileşeni fonksiyon olarak çağırıyoruz.
      const reactComponent = React.createElement(
        Template,
        params.variables ?? {},
      );

      return await this.sendEmail({
        to: this.isProductionEnv() ? params.to : this.devEmail,
        subject: params.subject,
        react: reactComponent,
        // Opsiyonel: Idempotency key ekleme
        idempotencyKey: `${cleanTemplateName}-${params.to}-${Date.now()}`,
      });
    } catch (error) {
      return this.handleError(error, "send");
    }
  }

  async test(): Promise<boolean> {
    const resend = await this.getResendClient();
    const { data, error } = await resend.emails.send({
      from: this.fromEmail,
      to: "delivered@resend.dev",
      subject: "Test Email",
      html: "<p>Test</p>",
    });

    if (error) {
      this.logger.error("Test başarısız:", error.message);
      return false;
    }

    this.logger.log(`Test başarılı, ID: ${data?.id}`);
    return true;
  }

  private async getResendClient(): Promise<Resend> {
    if (!this.resend) {
      if (!this.apiKey) {
        throw new Error("RESEND_API_KEY environment variable is not set");
      }
      this.resend = new Resend(this.apiKey);
    }
    return this.resend;
  }

  private validateEmailChannel(channel: string): void {
    if (channel !== "EMAIL") {
      throw new Error(
        `Resend sadece EMAIL kanalını destekler. Gelen: ${channel}`,
      );
    }
  }

  private async sendEmail(params: {
    to: string | string[];
    subject: string;
    react: React.ReactNode;
    idempotencyKey?: string;
  }): Promise<NotificationResult> {
    const resend = await this.getResendClient();

    // Resend SDK { data, error } döner, try/catch network hataları içindir.
    const { data, error } = await resend.emails.send({
      from: this.fromEmail,
      ...params,
    });

    if (error) {
      return this.createErrorResult(error.message);
    }

    return this.createSuccessResult(data?.id);
  }

  private isProductionEnv(): boolean {
    return this.nodeEnv === "production";
  }

  private cleanTemplateName(templateName: string): string {
    return templateName.replace(/\.tsx$/, "");
  }

  private handleError(error: unknown, context: string): NotificationResult {
    const errorMessage =
      error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    this.logger.error(`${context} hatası:`, errorMessage);
    return this.createErrorResult(errorMessage);
  }

  private createSuccessResult(messageId?: string): NotificationResult {
    return {
      success: true,
      messageId,
    };
  }

  private createErrorResult(error: string): NotificationResult {
    return {
      success: false,
      error,
    };
  }
}
