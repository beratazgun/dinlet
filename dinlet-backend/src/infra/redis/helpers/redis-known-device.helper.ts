import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { RedisService } from "#/infra/redis/redis.service.js";

export interface DeviceRegistration {
  /** Cihaz bu kayıtla listeye eklendi mi? */
  isNewDevice: boolean;
  /** Kayıttan önce bilinen cihaz sayısı. */
  knownDeviceCountBefore: number;
}

/**
 * Kullanıcının daha önce giriş yaptığı cihazlar: `user:devices:<userId>`
 * set'i, cihaz anahtarlarının hash'lerini tutar; her girişte 180 gün tazelenir.
 */
@Injectable()
export class RedisKnownDeviceHelper {
  constructor(private readonly redisService: RedisService) {}

  async register(
    userId: number,
    deviceKey: string,
  ): Promise<DeviceRegistration> {
    const result = await this.redisService.sAddTracked(
      this.redisService.createKey("KNOWN_DEVICES", userId),
      createHash("sha256").update(deviceKey).digest("hex"),
    );
    // Redis yoksa cihaz bilinen sayılır: yanlış alarm, kaçırılan alarmdan kötü.
    if (!result) return { isNewDevice: false, knownDeviceCountBefore: 0 };
    return {
      isNewDevice: result.added,
      knownDeviceCountBefore: result.sizeBefore,
    };
  }
}
