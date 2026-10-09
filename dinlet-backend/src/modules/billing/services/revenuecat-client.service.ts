import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvType } from "#config/env.validation.js";

const API_URL = "https://api.revenuecat.com/v1/subscribers";

/** RevenueCat REST API (abonenin güncel durumu). */
@Injectable()
export class RevenueCatClientService {
  private readonly apiKey?: string;

  constructor(configService: ConfigService<EnvType>) {
    this.apiKey = configService.get("REVENUECAT_API_KEY", { infer: true });
  }

  get isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async getSubscriber(appUserId: string): Promise<unknown> {
    const response = await fetch(
      `${API_URL}/${encodeURIComponent(appUserId)}`,
      { headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`RevenueCat ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }
}
