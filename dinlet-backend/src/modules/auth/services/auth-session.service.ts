import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { FastifyRequest } from "fastify";
import type { EnvType } from "#config/env.validation.js";
import type { RequestMetadata } from "#/core/decorators/index.js";
import { OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { RedisKnownDeviceHelper } from "#/infra/redis/helpers/redis-known-device.helper.js";
import { RedisSessionHelper } from "#/infra/redis/helpers/redis-session.helper.js";
import {
  buildSessionClearCookieOptions,
  DEVICE_ID_HEADER,
  isMobileClient,
  normalizeDeviceId,
} from "#/infra/session/index.js";
import type {
  SessionListQueryDto,
  TerminateSessionsBodyDto,
} from "#/modules/auth/dtos/index.js";
import {
  NEW_DEVICE_LOGIN_EVENT,
  NewDeviceLoginEvent,
} from "#/modules/auth/event/auth.events.js";
import {
  deviceKeyOf,
  shouldAlertNewDevice,
} from "#/modules/auth/utils/new-device.util.js";
import type { SessionUser } from "#/types/session-user.type.js";

/**
 * Oturum yaşam döngüsü.
 *
 * Oturum verisi `@fastify/session` üzerinden Redis'te tutulur; bu servis
 * oturumun açılması/kapanması ile kullanıcının açık oturum defterini yönetir.
 * Cookie yazma işini plugin'in `onSend` hook'u üstlendiği için burada yalnızca
 * silme (`clearCookies`) tarafı elle kurgulanır.
 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly sessionHelper: RedisSessionHelper,
    private readonly knownDevices: RedisKnownDeviceHelper,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService<EnvType>,
    private readonly dateManager: DateManager,
    private readonly paginator: Paginator,
  ) {}

  /**
   * Kimlik doğrulandıktan sonra yeni oturum açar.
   *
   * Oturum id'si `regenerate()` ile yenilenir — giriş öncesindeki anonim
   * oturum id'si geçerli kalırsa session fixation saldırısına açık olurdu.
   *
   * İstek `X-Client: mobile` taşıyorsa oturum `X-Device-Id` ile cihaza
   * bağlanır, mobil ömrü alır ve yanıtta cookie yerine kullanılacak
   * `accessToken` (imzalı oturum kimliği) döner.
   */
  async issueSession(
    request: FastifyRequest,
    user: SessionUser,
    metadata: RequestMetadata,
    message = "Giriş başarılı.",
  ): Promise<OkResponse> {
    const isMobile = isMobileClient(request);
    const deviceId = isMobile ? this.requireDeviceId(request) : null;
    const maxAge = isMobile ? this.mobileSessionMaxAge() : this.sessionMaxAge();

    await request.session.regenerate();

    const session = request.session;
    // Oturum ömrü cookie bilgisiyle birlikte store'a yazılır; `rolling`
    // her istekte bu değeri kullanarak tazeler.
    if (isMobile) session.options({ maxAge: maxAge * 1_000 });
    session.set("user", user);
    session.set("userAgent", metadata.userAgent);
    session.set("ipAddress", metadata.ipAddress);
    session.set("createdAt", this.dateManager.toISOString());
    session.set("client", isMobile ? "mobile" : "web");
    session.set("deviceId", deviceId);
    await session.save();

    await this.sessionHelper.register(user.id, session.sessionId);
    await this.detectNewDevice(user.id, metadata);

    return new OkResponse(message, {
      expiresIn: maxAge,
      expiresAt: this.resolveExpiresAt(request, maxAge),
      ...(isMobile ? { accessToken: session.encryptedSessionId } : {}),
    });
  }

  /** Mobil girişte cihaz kimliği zorunludur; oturum bu cihaza bağlanır. */
  private requireDeviceId(request: FastifyRequest): string {
    const deviceId = normalizeDeviceId(request.headers[DEVICE_ID_HEADER]);
    if (!deviceId) {
      throw new BadRequestException(
        "Mobil girişte geçerli bir X-Device-Id başlığı gönderilmelidir.",
      );
    }
    return deviceId;
  }

  /**
   * Daha önce görülmemiş bir cihazdan girişte `NEW_DEVICE_LOGIN_EVENT`
   * yayınlar (e-posta + uygulama içi bildirim handler'larda).
   */
  private async detectNewDevice(
    userId: number,
    metadata: RequestMetadata,
  ): Promise<void> {
    const deviceKey = deviceKeyOf(metadata.userAgent);
    if (!deviceKey) return;

    const registration = await this.knownDevices.register(userId, deviceKey);
    if (shouldAlertNewDevice(registration)) {
      this.eventEmitter.emit(
        NEW_DEVICE_LOGIN_EVENT,
        new NewDeviceLoginEvent(
          userId,
          metadata.ipAddress,
          metadata.userAgent!,
          this.dateManager.toISOString(),
        ),
      );
    }
  }

  /** Mevcut oturumu sonlandırır ve cookie'yi siler. */
  async logout(request: FastifyRequest): Promise<OkResponse> {
    const user = request.session.get("user");
    const sessionId = request.session.sessionId;

    // destroy() sonrası `request.session` null olur; plugin de cookie
    // tazelemeyi atlar, bu yüzden silme talimatını biz veriyoruz.
    await request.session.destroy();
    if (user) await this.sessionHelper.unregister(user.id, sessionId);

    return new OkResponse("Çıkış yapıldı", {
      clearCookies: this.buildClearCookies(),
    });
  }

  /** Kullanıcının açık oturumlarını sayfalı olarak listeler. */
  async listSessions(
    request: FastifyRequest,
    userId: number,
    query: SessionListQueryDto,
  ): Promise<OkResponse> {
    const currentSessionId = request.session.sessionId;
    const sessions = await this.sessionHelper.list(userId);

    const result = await this.paginator.applyToArray(
      sessions.map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId,
      })),
      { page: query.page, limit: query.limit },
    );

    return new OkResponse("Açık oturumlar", result.docs, {
      meta: { pagination: result.pagination },
    });
  }

  /** Seçilen oturumları sonlandırır. Sadece kullanıcının kendi oturumları. */
  async terminateSessions(
    request: FastifyRequest,
    body: TerminateSessionsBodyDto,
    userId: number,
  ): Promise<OkResponse> {
    const currentSessionId = request.session.sessionId;
    const ownedIds = new Set(
      (await this.sessionHelper.list(userId)).map((session) => session.id),
    );
    const targets = body.sessionIds.filter((sessionId) =>
      ownedIds.has(sessionId),
    );

    for (const sessionId of targets) {
      if (sessionId === currentSessionId) continue;
      await this.sessionHelper.destroy(userId, sessionId);
    }

    // Kendi oturumunu da sonlandırdıysa store'dan silmek yetmez: plugin
    // `rolling` gereği yanıtta oturumu geri yazardı. destroy() ile keselim.
    const terminatedCurrent = targets.includes(currentSessionId);
    if (terminatedCurrent) {
      await request.session.destroy();
      await this.sessionHelper.unregister(userId, currentSessionId);
    }

    return new OkResponse(`${targets.length} oturum sonlandırıldı`, {
      meta: {
        terminatedCount: targets.length,
        requestedCount: body.sessionIds.length,
      },
      ...(terminatedCurrent ? { clearCookies: this.buildClearCookies() } : {}),
    });
  }

  /**
   * Kullanıcının tüm oturumlarını sonlandırır (hesap silme gibi durumlarda).
   * İsteği yapan oturum da kapatılır.
   */
  async terminateAllSessions(
    request: FastifyRequest,
    userId: number,
  ): Promise<void> {
    await this.sessionHelper.destroyAll(userId);
    if (typeof request.session?.destroy === "function") {
      await request.session.destroy();
    }
  }

  /** Oturum cookie'sini silmek için gereken isim + seçenek çifti. */
  buildClearCookies() {
    return [
      {
        name: this.configService.getOrThrow("SESSION_COOKIE_NAME", {
          infer: true,
        }),
        options: buildSessionClearCookieOptions(this.configService),
      },
    ];
  }

  private sessionMaxAge(): number {
    return this.configService.getOrThrow("SESSION_MAX_AGE", { infer: true });
  }

  private mobileSessionMaxAge(): number {
    return this.configService.getOrThrow("SESSION_MAX_AGE_MOBILE", {
      infer: true,
    });
  }

  /** Cookie'nin gerçek bitiş anını, yoksa verilen ömrü kullanır. */
  private resolveExpiresAt(request: FastifyRequest, maxAge: number): string {
    const expires = request.session.cookie?.expires;
    return expires
      ? this.dateManager.toISOString(new Date(expires))
      : this.dateManager.toISOString(
          this.dateManager.addMilliseconds(maxAge * 1_000),
        );
  }
}
