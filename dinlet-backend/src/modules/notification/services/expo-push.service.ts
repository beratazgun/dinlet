import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo tek istekte en fazla 100 mesaj kabul eder. */
const BATCH_SIZE = 100;

export interface PushMessage {
  title: string;
  body: string;
  /** Uygulamanın bildirime dokunulunca açacağı ekran için veri. */
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Expo Push API istemcisi. Yalnızca iletir; kimin, neyi alacağına çağıran
 * (push kuyruğu processor'ı) karar verir. Ağ veya 5xx hatası fırlatılır
 * (kuyruk yeniden dener); cihazı kayıtlı olmayan token'lar döndürülür.
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly accessToken?: string;
  private readonly isLogOnly: boolean;

  constructor(configService: ConfigService<EnvType>) {
    this.accessToken = configService.get("EXPO_ACCESS_TOKEN", { infer: true });
    this.isLogOnly =
      configService.get("PUSH_DELIVERY", { infer: true }) === "log";
  }

  /** Mesajı token'lara gönderir; artık geçersiz olan token'ları döndürür. */
  async send(tokens: string[], message: PushMessage): Promise<string[]> {
    if (this.isLogOnly) {
      this.logger.log(`[push:log] ${tokens.length} cihaz: ${message.title}`);
      return [];
    }

    const invalid: string[] = [];
    for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
      const batch = tokens.slice(start, start + BATCH_SIZE);
      const tickets = await this.post(
        batch.map((to) => ({ to, sound: "default", ...message })),
      );
      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") return;
        if (ticket.details?.error === "DeviceNotRegistered") {
          invalid.push(batch[index]!);
        } else {
          this.logger.warn(`Push iletilemedi: ${ticket.message ?? "bilinmeyen hata"}`);
        }
      });
    }
    return invalid;
  }

  private async post(messages: object[]): Promise<ExpoTicket[]> {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      throw new Error(`Expo push ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as { data?: ExpoTicket[] };
    return body.data ?? [];
  }
}
