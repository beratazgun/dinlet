import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrevoClient } from "@getbrevo/brevo";
import { render } from "react-email";
import * as React from "react";
import { EnvType } from "#config/env.validation.js";
import { NotificationProvider } from "#/infra/notifications/providers/abstract.provider.js";
import {
  NotificationResult,
  SendNotificationParams,
} from "#/infra/notifications/types/index.js";
import { getEmailTemplate } from "#/infra/notifications/templates/index.js";

/**
 * Brevo (eski adıyla Sendinblue) email provider — v5 SDK
 * @see https://developers.brevo.com/docs/api-clients/node-js
 *
 * Brevo, Resend'den farklı olarak React bileşenini doğrudan kabul etmez.
 * Template önce react-email ile HTML'e dönüştürülür, ardından
 * Brevo Transactional Email API'si üzerinden gönderilir.
 */
@Injectable()
export class BrevoProvider extends NotificationProvider {
  private readonly logger = new Logger(BrevoProvider.name);
  private client: BrevoClient | null = null;
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly nodeEnv: string;
  private readonly devEmail: string;

  constructor(private readonly configService: ConfigService<EnvType>) {
    super();
    this.apiKey = this.configService.get<string>("BREVO_API_KEY", "");
    this.fromEmail = this.configService.get<string>("BREVO_FROM_EMAIL", "");
    this.fromName = this.configService.get<string>("BREVO_FROM_NAME", "Dinlet");
    this.nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    this.devEmail = this.configService.get<string>(
      "BREVO_MAIL_FOR_DEV_ENV",
      "",
    );
  }

  async send(params: SendNotificationParams): Promise<NotificationResult> {
    if (params.channel !== "EMAIL") {
      throw new Error(
        `Brevo sadece EMAIL kanalını destekler. Gelen: ${params.channel}`,
      );
    }

    if (!this.isProductionEnv()) {
      this.logger.log(
        `Development modunda Brevo email gönderimi (Alıcı: ${this.devEmail || params.to})`,
      );
    }

    try {
      const cleanTemplateName = (params.templateName || "").replace(
        /\.tsx$/,
        "",
      );
      const Template = getEmailTemplate(cleanTemplateName);
      if (!Template)
        throw new Error(`Template bulunamadı: ${cleanTemplateName}`);

      // React bileşenini oluştur ve HTML string'e dönüştür
      const reactElement = React.createElement(
        Template,
        params.variables ?? {},
      );
      const html = await render(reactElement);

      const to = this.isProductionEnv()
        ? params.to
        : this.devEmail || params.to;

      return await this.sendEmail({ to, subject: params.subject, html });
    } catch (error) {
      return this.handleError(error, "send");
    }
  }

  async test(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.transactionalEmails.sendTransacEmail({
        subject: "Brevo Test Email",
        htmlContent: "<p>Test</p>",
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: "delivered@resend.dev" }],
      });
      this.logger.log("Brevo test başarılı");
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Bilinmeyen hata";
      this.logger.error(`Brevo test başarısız: ${msg}`);
      return false;
    }
  }

  private getClient(): BrevoClient {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error("BREVO_API_KEY environment variable is not set");
      }
      this.client = new BrevoClient({ apiKey: this.apiKey });
    }
    return this.client;
  }

  private async sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<NotificationResult> {
    const client = this.getClient();

    const recipients = (Array.isArray(params.to) ? params.to : [params.to]).map(
      (email) => ({ email }),
    );

    try {
      const response = await client.transactionalEmails.sendTransacEmail({
        subject: params.subject,
        htmlContent: params.html,
        sender: { name: this.fromName, email: this.fromEmail },
        to: recipients,
      });

      const messageId = response.messageId;
      this.logger.log(`Brevo email gönderildi. MessageId: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`Brevo email gönderilemedi: ${msg}`);
      return { success: false, error: msg };
    }
  }

  private isProductionEnv(): boolean {
    return this.nodeEnv === "production";
  }

  private handleError(error: unknown, context: string): NotificationResult {
    const errorMessage =
      error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu";
    this.logger.error(`${context} hatası:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}
