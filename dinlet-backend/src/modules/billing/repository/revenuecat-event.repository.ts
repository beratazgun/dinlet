import { Injectable } from "@nestjs/common";
import type { JsonValue } from "@prisma/orm-postgres/target/codec-types";

import { DatabaseService } from "#database/database.service.js";

/** İşlenmiş RevenueCat olayları (webhook idempotency). */
@Injectable()
export class RevenueCatEventRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /**
   * Olayı kaydeder; daha önce kaydedilmişse `false` döner. RevenueCat
   * başarısız teslimatları tekrar gönderdiği için aynı olay birden fazla
   * gelebilir.
   */
  async record(input: {
    eventId: string;
    type: string;
    appUserId: string;
    payload: unknown;
  }): Promise<boolean> {
    const existing = await this.db.orm.public.RevenueCatEvent.where({
      eventId: input.eventId,
    })
      .select("id")
      .first();
    if (existing) return false;

    try {
      await this.db.orm.public.RevenueCatEvent.create({
        ...input,
        payload: input.payload as JsonValue,
      });
      return true;
    } catch (error) {
      // Eşzamanlı ikinci teslimat unique kısıtına takılır.
      const raced = await this.db.orm.public.RevenueCatEvent.where({
        eventId: input.eventId,
      })
        .select("id")
        .first();
      if (raced) return false;
      throw error;
    }
  }

  /** İşlenemeyen olayın kaydını siler; RevenueCat'in yeniden denemesi işlenir. */
  async forget(eventId: string): Promise<void> {
    await this.db.orm.public.RevenueCatEvent.where({ eventId }).deleteAndCount();
  }
}
