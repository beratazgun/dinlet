import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";
import type { ConsentType } from "#database/enums.js";

export interface ConsentRecord {
  type: ConsentType;
  version: string;
  granted: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

/** KVKK onay/rıza defteri (`user_consents`). Kayıtlar silinmez, eklenir. */
@Injectable()
export class AuthConsentRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Her tür için en son kayıt (güncel durum). */
  async findLatestByUser(userId: number) {
    const rows = await this.db.orm.public.UserConsent.where({ userId })
      .select("type", "version", "granted", "createdAt")
      .orderBy([
        (consent) => consent.createdAt.desc(),
        (consent) => consent.id.desc(),
      ])
      .all();
    const latest = new Map<ConsentType, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.type)) latest.set(row.type, row);
    return latest;
  }

  async record(userId: number, consents: ConsentRecord[]): Promise<void> {
    if (consents.length === 0) return;
    await this.db.orm.public.UserConsent.createAll(
      consents.map((consent) => ({ userId, ...consent })),
    );
  }
}
