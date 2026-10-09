import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";
import type { DevicePlatform } from "#database/enums.js";

/** Kullanıcıların cihazlarındaki Expo push token'ları. */
@Injectable()
export class PushTokenRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /**
   * Token'ı kaydeder. Aynı cihaz başka hesaba geçtiyse token yeni kullanıcıya
   * taşınır (token tekil; bir cihaz aynı anda tek hesaba bildirim alır).
   */
  async upsert(
    userId: number,
    token: string,
    platform: DevicePlatform,
  ): Promise<void> {
    await this.db.orm.public.PushToken.upsert({
      create: { userId, token, platform },
      update: { userId, platform },
      conflictOn: { token },
    });
  }

  async deleteForUser(userId: number, token: string): Promise<boolean> {
    const deleted = await this.db.orm.public.PushToken.where({
      userId,
      token,
    }).deleteAndCount();
    return deleted > 0;
  }

  async deleteTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;
    return this.db.orm.public.PushToken.where((pushToken) =>
      pushToken.token.in(tokens),
    ).deleteAndCount();
  }

  async findTokensByUser(userId: number): Promise<string[]> {
    const rows = await this.db.orm.public.PushToken.where({ userId })
      .select("token")
      .all();
    return rows.map((row) => row.token);
  }

  async deleteAllForUser(userId: number): Promise<number> {
    return this.db.orm.public.PushToken.where({ userId }).deleteAndCount();
  }
}
