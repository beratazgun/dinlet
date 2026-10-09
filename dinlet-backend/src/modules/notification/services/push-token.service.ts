import { Injectable } from "@nestjs/common";

import { NoContentResponse, OkResponse } from "#/core/http/index.js";
import type { RegisterPushTokenBodyDto } from "#/modules/notification/dtos/index.js";
import { PushTokenRepository } from "#/modules/notification/repository/index.js";

/** Cihaz push token kaydı (Expo). */
@Injectable()
export class PushTokenService {
  constructor(private readonly pushTokenRepository: PushTokenRepository) {}

  async register(
    body: RegisterPushTokenBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    await this.pushTokenRepository.upsert(userId, body.token, body.platform);
    return new OkResponse("Bildirim cihazı kaydedildi");
  }

  /** Çıkışta veya bildirim izni kapatılınca çağrılır; yoksa sessizce geçer. */
  async remove(token: string, userId: number): Promise<NoContentResponse> {
    await this.pushTokenRepository.deleteForUser(userId, token);
    return new NoContentResponse("Bildirim cihazı kaldırıldı");
  }
}
