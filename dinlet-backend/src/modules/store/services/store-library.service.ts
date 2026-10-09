import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { nanoid } from "nanoid";

import { CreatedResponse, OkResponse } from "#/core/http/index.js";
import { RedisQuotaLockHelper } from "#/infra/redis/helpers/redis-quota-lock.helper.js";
import type { RevenueCatProductEvent } from "#/modules/billing/event/billing.events.js";
import { RevenueCatClientService } from "#/modules/billing/services/index.js";
import { nonSubscriptionPurchases } from "#/modules/billing/utils/index.js";
import { DocumentRepository } from "#/modules/document/repository/index.js";
import {
  StoreBundleRepository,
  StoreEntitlementRepository,
  StoreItemRepository,
  StoreLibraryRepository,
} from "#/modules/store/repository/index.js";
import {
  DocumentStatus,
  StoreEntitlementSource,
  type SubscriptionStore,
} from "#database/enums.js";

interface ProductGrant {
  /** Ürün mağazaya ait (içerik veya paket). */
  isStoreProduct: boolean;
  grantedItemIds: number[];
}

/**
 * Sahiplik ve kütüphane: ücretsiz içeriği ekleme, satın alınanı açma,
 * satın almaları RevenueCat'ten doğrulama ve iadeyi geri alma.
 */
@Injectable()
export class StoreLibraryService {
  private readonly logger = new Logger(StoreLibraryService.name);

  constructor(
    private readonly itemRepository: StoreItemRepository,
    private readonly bundleRepository: StoreBundleRepository,
    private readonly entitlementRepository: StoreEntitlementRepository,
    private readonly libraryRepository: StoreLibraryRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly revenueCatClient: RevenueCatClientService,
    private readonly userLock: RedisQuotaLockHelper,
  ) {}

  /**
   * "Kütüphaneme ekle": ücretsiz içerikte sahiplik yazılır; ücretli içerik
   * satın alınmış olmalıdır (webhook henüz gelmediyse RevenueCat'e sorulur).
   * Kopya zaten varsa o döner. Sayfa kotasından düşmez.
   */
  async addItem(
    itemId: number,
    userId: number,
  ): Promise<CreatedResponse | OkResponse> {
    const item = await this.itemRepository.findById(itemId);
    let owned = item
      ? await this.entitlementRepository.isOwned(userId, itemId)
      : false;
    if (!item || (!item.isPublished && !owned)) {
      throw new NotFoundException(`İçerik bulunamadı: ${itemId}`);
    }

    if (!owned && item.productId === null) {
      await this.entitlementRepository.grant(userId, [itemId], {
        source: StoreEntitlementSource.FREE,
      });
      owned = true;
    }
    if (!owned) {
      await this.syncFromRevenueCat(userId);
      owned = await this.entitlementRepository.isOwned(userId, itemId);
    }
    if (!owned) throw purchaseRequired();

    const [entry] = await this.openCopies(userId, [itemId]);
    return entry!.isNew
      ? new CreatedResponse("İçerik kütüphanene eklendi", { entries: [entry] })
      : new OkResponse("İçerik zaten kütüphanende", { entries: [entry] });
  }

  /** Paketteki tüm içerikleri kütüphaneye ekler (paket satın alınmış olmalı). */
  async addBundle(
    bundleId: number,
    userId: number,
  ): Promise<CreatedResponse | OkResponse> {
    const bundle = await this.bundleRepository.findById(bundleId);
    const itemIds = bundle
      ? ((await this.bundleRepository.findItemIds([bundleId])).get(bundleId) ??
        [])
      : [];
    const ownsAll = async () =>
      (await this.entitlementRepository.findOwnedIds(userId, itemIds)).size ===
      itemIds.length;

    let owned = itemIds.length > 0 && (await ownsAll());
    if (!bundle || (!bundle.isPublished && !owned)) {
      throw new NotFoundException(`Paket bulunamadı: ${bundleId}`);
    }
    if (itemIds.length === 0) {
      throw new ConflictException("Bu pakette henüz içerik yok.");
    }
    if (!owned) {
      await this.syncFromRevenueCat(userId);
      owned = await ownsAll();
    }
    if (!owned) throw purchaseRequired();

    const entries = await this.openCopies(userId, itemIds);
    return entries.some((entry) => entry.isNew)
      ? new CreatedResponse("Paket kütüphanene eklendi", { entries })
      : new OkResponse("Paket zaten kütüphanende", { entries });
  }

  /**
   * "Satın almaları geri yükle": RevenueCat'teki tek seferlik satın almaları
   * sahipliğe çevirir (yeni cihaz, kaçan webhook).
   */
  async syncPurchases(userId: number): Promise<OkResponse> {
    const grantedItemIds = await this.syncFromRevenueCat(userId);
    const owned = await this.entitlementRepository.findOwnedIds(userId);
    return new OkResponse(
      grantedItemIds.length > 0
        ? `${grantedItemIds.length} içerik hesabına tanımlandı`
        : "Satın almalar güncel",
      { grantedItemIds, ownedItemIds: [...owned].sort((a, b) => a - b) },
    );
  }

  /**
   * RevenueCat webhook'undan gelen ürün olayı. Ürün mağazaya aitse `true`
   * döner (abonelik etkilenmez). İade (`CANCELLATION`) sahipliği geri alır
   * ve kütüphanedeki kopyaları kaldırır.
   */
  async handleProductEvent(event: RevenueCatProductEvent): Promise<boolean> {
    if (event.type === "CANCELLATION") {
      if (!(await this.isStoreProduct(event.productId))) return false;
      const revoked = await this.entitlementRepository.revoke(
        event.userId,
        event.productId,
      );
      const copies = await this.libraryRepository.findCopies(
        event.userId,
        revoked,
      );
      for (const documentId of copies.values()) {
        await this.documentRepository.softDelete(documentId, event.userId);
      }
      this.logger.log(
        `İade: kullanıcı#${event.userId} ${event.productId} → ${revoked.length} içerik geri alındı`,
      );
      return true;
    }

    if (event.type === "NON_RENEWING_PURCHASE") {
      const { isStoreProduct, grantedItemIds } = await this.grantProduct(
        event.userId,
        event.productId,
        event.transactionId,
        event.store,
      );
      if (isStoreProduct) {
        this.logger.log(
          `Satın alma: kullanıcı#${event.userId} ${event.productId} → ${grantedItemIds.length} içerik`,
        );
      }
      return isStoreProduct;
    }

    // Diğer olaylar (TRANSFER, TEST…) mağaza ürünü için yalnızca kaydedilir.
    return this.isStoreProduct(event.productId);
  }

  /** Destek: içeriği kullanıcıya ücretsiz tanımlar. */
  async grantByAdmin(itemId: number, userId: number): Promise<number[]> {
    return this.entitlementRepository.grant(userId, [itemId], {
      source: StoreEntitlementSource.GRANT,
    });
  }

  /** RevenueCat REST API tanımlı değilse sahiplik yalnızca webhook'la gelir. */
  private async syncFromRevenueCat(userId: number): Promise<number[]> {
    if (!this.revenueCatClient.isEnabled) return [];
    const subscriber = await this.revenueCatClient.getSubscriber(
      String(userId),
    );
    const granted: number[] = [];
    for (const purchase of nonSubscriptionPurchases(
      subscriber as Parameters<typeof nonSubscriptionPurchases>[0],
    )) {
      const result = await this.grantProduct(
        userId,
        purchase.productId,
        purchase.transactionId,
        purchase.store,
      );
      granted.push(...result.grantedItemIds);
    }
    return granted;
  }

  private async grantProduct(
    userId: number,
    productId: string,
    transactionId: string | null,
    store: SubscriptionStore | null,
  ): Promise<ProductGrant> {
    const grant = {
      source: StoreEntitlementSource.PURCHASE,
      productId,
      transactionId,
      store,
    };
    const item = await this.itemRepository.findByProductId(productId);
    if (item) {
      return {
        isStoreProduct: true,
        grantedItemIds: await this.entitlementRepository.grant(
          userId,
          [item.id],
          grant,
        ),
      };
    }
    const bundle = await this.bundleRepository.findByProductId(productId);
    if (bundle) {
      const itemIds =
        (await this.bundleRepository.findItemIds([bundle.id])).get(bundle.id) ??
        [];
      return {
        isStoreProduct: true,
        grantedItemIds: await this.entitlementRepository.grant(
          userId,
          itemIds,
          {
            ...grant,
            bundleId: bundle.id,
          },
        ),
      };
    }
    return { isStoreProduct: false, grantedItemIds: [] };
  }

  private async isStoreProduct(productId: string): Promise<boolean> {
    return Boolean(
      (await this.itemRepository.findByProductId(productId)) ??
      (await this.bundleRepository.findByProductId(productId)),
    );
  }

  /**
   * Eksik kopyaları açar. Kullanıcı kilidi altında: aynı anda iki istek aynı
   * içeriği iki kez kopyalamaz.
   */
  private openCopies(userId: number, itemIds: number[]) {
    return this.userLock.withLock(userId, async () => {
      const existing = await this.libraryRepository.findCopies(userId, itemIds);
      const items = await this.itemRepository.findByIds(
        itemIds.filter((id) => !existing.has(id)),
      );
      const created = new Map<number, number>();
      for (const item of items) {
        const source = await this.itemRepository.findSourceDocument(
          item.documentId,
        );
        if (!source || source.status !== DocumentStatus.READY) {
          this.logger.error(`İçerik#${item.id} kaynak notu hazır değil`);
          throw new ConflictException(
            "İçerik şu an hazırlanıyor; lütfen biraz sonra tekrar dene.",
          );
        }
        created.set(
          item.id,
          await this.libraryRepository.createCopy({
            userId,
            storeItemId: item.id,
            sourceDocumentId: item.documentId,
            title: item.title,
            storagePrefix: nanoid(16),
          }),
        );
      }
      return itemIds.map((storeItemId) => ({
        storeItemId,
        documentId: existing.get(storeItemId) ?? created.get(storeItemId)!,
        isNew: created.has(storeItemId),
      }));
    });
  }
}

function purchaseRequired(): HttpException {
  return new HttpException(
    {
      message: "Bu içerik ücretli; önce satın almalısın.",
      code: "PURCHASE_REQUIRED",
    },
    HttpStatus.PAYMENT_REQUIRED,
  );
}
