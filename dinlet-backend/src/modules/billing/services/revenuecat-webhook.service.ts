import { timingSafeEqual } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { EnvType } from "#config/env.validation.js";
import { OkResponse } from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import {
  REVENUECAT_PRODUCT_EVENT,
  RevenueCatProductEvent,
} from "#/modules/billing/event/billing.events.js";
import {
  RevenueCatEventRepository,
  SubscriptionRepository,
} from "#/modules/billing/repository/index.js";
import { RevenueCatClientService } from "#/modules/billing/services/revenuecat-client.service.js";
import {
  mapStore,
  parseRevenueCatEvent,
  resolveUserId,
  stateFromEvent,
  stateFromSubscriber,
  type RevenueCatWebhookEvent,
  type SubscriptionState,
} from "#/modules/billing/utils/index.js";

/**
 * RevenueCat webhook'u (doküman §10): App Store ve Play Store aboneliklerini
 * tek yerden senkronlar.
 *
 * - Doğrulama: RevenueCat panelinde tanımlanan gizli `Authorization` değeri.
 * - Idempotency: olay `id`'si saklanır; tekrar gelen olay işlenmez.
 * - Güven: REST API anahtarı tanımlıysa durum olaydan değil RevenueCat'teki
 *   güncel abone kaydından okunur (olay sırası/kaybı etkilemez); değilse
 *   olaydan türetilir ve `lastEventAt`'ten eski olaylar yok sayılır.
 * - Mağaza içeriği gibi abonelik dışı ürünler `REVENUECAT_PRODUCT_EVENT`
 *   ile ilgili modüle bırakılır; o ürünlerin olayları aboneliği değiştirmez.
 */
@Injectable()
export class RevenueCatWebhookService {
  private readonly logger = new Logger(RevenueCatWebhookService.name);
  private readonly webhookAuth?: string;
  private readonly proEntitlement: string;

  constructor(
    private readonly eventRepository: RevenueCatEventRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly revenueCatClient: RevenueCatClientService,
    private readonly dateManager: DateManager,
    private readonly eventEmitter: EventEmitter2,
    configService: ConfigService<EnvType>,
  ) {
    this.webhookAuth = configService.get("REVENUECAT_WEBHOOK_AUTH", {
      infer: true,
    });
    this.proEntitlement = configService.getOrThrow(
      "REVENUECAT_PRO_ENTITLEMENT",
      { infer: true },
    );
  }

  async handle(
    authorization: string | undefined,
    body: unknown,
  ): Promise<OkResponse> {
    this.assertAuthorized(authorization);

    const event = parseRevenueCatEvent(body);
    if (!event) throw new BadRequestException("Geçersiz RevenueCat olayı");

    const isNew = await this.eventRepository.record({
      eventId: event.id,
      type: event.type,
      appUserId: event.app_user_id,
      payload: body,
    });
    if (!isNew) return new OkResponse("Olay daha önce işlendi");

    const userId = resolveUserId(event);
    if (userId === null || !(await this.subscriptionRepository.userExists(userId))) {
      this.logger.warn(
        `RevenueCat olayı kullanıcıya bağlanamadı (${event.type}, ${event.app_user_id})`,
      );
      return new OkResponse("Olay kaydedildi; kullanıcı bulunamadı");
    }

    if (await this.handledAsProduct(event, userId)) {
      return new OkResponse("Ürün satın alması işlendi");
    }

    const state = await this.resolveState(event, userId);
    if (!state) return new OkResponse("Olay kaydedildi");

    const eventAt = this.dateManager.toISOString(
      new Date(event.event_timestamp_ms),
    );
    if (!this.revenueCatClient.isEnabled) {
      const current = await this.subscriptionRepository.findByUserId(userId);
      if (
        current?.lastEventAt &&
        !this.dateManager.isAfter(eventAt, current.lastEventAt)
      ) {
        return new OkResponse("Daha yeni bir olay zaten işlenmiş");
      }
    }

    await this.subscriptionRepository.upsertForUser(userId, {
      plan: state.plan,
      status: state.status,
      rcAppUserId: event.app_user_id,
      productId: state.productId,
      currentPeriodEnd:
        state.currentPeriodEndMs === null
          ? null
          : this.dateManager.toISOString(new Date(state.currentPeriodEndMs)),
      store: state.store,
      lastEventAt: eventAt,
    });
    this.logger.log(
      `Abonelik güncellendi: kullanıcı#${userId} ${state.plan}/${state.status} (${event.type})`,
    );
    return new OkResponse("Abonelik güncellendi");
  }

  /**
   * Abonelik dışı ürün (mağaza içeriği, paket) olayını dinleyicisine verir.
   * Dinleyici hata verirse webhook 500 döner ve RevenueCat yeniden dener;
   * olay kaydı geri alınır ki ikinci deneme işlensin.
   */
  private async handledAsProduct(
    event: RevenueCatWebhookEvent,
    userId: number,
  ): Promise<boolean> {
    if (!event.product_id) return false;
    try {
      const results: unknown[] = await this.eventEmitter.emitAsync(
        REVENUECAT_PRODUCT_EVENT,
        new RevenueCatProductEvent(
          userId,
          event.type,
          event.product_id,
          event.transaction_id ?? null,
          mapStore(event.store),
        ),
      );
      return results.some((handled) => handled === true);
    } catch (error) {
      await this.eventRepository.forget(event.id);
      throw error;
    }
  }

  private async resolveState(
    event: RevenueCatWebhookEvent,
    userId: number,
  ): Promise<SubscriptionState | null> {
    if (!this.revenueCatClient.isEnabled) {
      return stateFromEvent(event, this.proEntitlement);
    }
    const subscriber = await this.revenueCatClient.getSubscriber(String(userId));
    return stateFromSubscriber(
      subscriber as Parameters<typeof stateFromSubscriber>[0],
      this.proEntitlement,
      this.dateManager.utcNow().getTime(),
    );
  }

  /** Sabit zamanlı karşılaştırma; gizli değer tanımlı değilse tüm istekler reddedilir. */
  private assertAuthorized(authorization: string | undefined): void {
    const expected = this.webhookAuth;
    const received = authorization ?? "";
    const isValid =
      Boolean(expected) &&
      expected!.length === received.length &&
      timingSafeEqual(Buffer.from(expected!), Buffer.from(received));
    if (!isValid) throw new UnauthorizedException("Geçersiz webhook imzası");
  }
}
