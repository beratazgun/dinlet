import { Injectable } from "@nestjs/common";

import {
  StoreBundleRepository,
  StoreCategoryRepository,
  StoreEntitlementRepository,
  StoreItemRepository,
  StoreLibraryRepository,
} from "#/modules/store/repository/index.js";
import { buildCategoryTree } from "#/modules/store/utils/index.js";

type StoreItemRow = NonNullable<
  Awaited<ReturnType<StoreItemRepository["findById"]>>
>;
type StoreBundleRow = NonNullable<
  Awaited<ReturnType<StoreBundleRepository["findById"]>>
>;

/**
 * Mağaza kartlarını kullanıcıya göre doldurur: kategoriler, bölüm/soru
 * sayıları, sahiplik ve kütüphanedeki kopya. Liste, detay ve yönetim
 * görünümü aynı alanları buradan alır; her biri sayfa başına sabit sayıda
 * sorgu yapar.
 */
@Injectable()
export class StorePresenterService {
  constructor(
    private readonly categoryRepository: StoreCategoryRepository,
    private readonly itemRepository: StoreItemRepository,
    private readonly bundleRepository: StoreBundleRepository,
    private readonly entitlementRepository: StoreEntitlementRepository,
    private readonly libraryRepository: StoreLibraryRepository,
  ) {}

  async categoryTree() {
    return buildCategoryTree(await this.categoryRepository.listAll());
  }

  /** `userId` yoksa (yönetim görünümü) sahiplik alanları boş döner. */
  async items(items: StoreItemRow[], userId: number | null) {
    const ids = items.map((item) => item.id);
    const [categories, categoryIds, stats, owned, copies] = await Promise.all([
      this.categoryRepository.listAll(),
      this.itemRepository.findCategoryIds(ids),
      this.itemRepository.findStats(items.map((item) => item.documentId)),
      userId === null
        ? Promise.resolve(new Set<number>())
        : this.entitlementRepository.findOwnedIds(userId, ids),
      userId === null
        ? Promise.resolve(new Map<number, number>())
        : this.libraryRepository.findCopies(userId, ids),
    ]);
    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );

    return items.map((item) => {
      const stat = stats.get(item.documentId);
      return {
        ...item,
        categories: (categoryIds.get(item.id) ?? []).flatMap((id) => {
          const category = categoryById.get(id);
          return category ? [category] : [];
        }),
        sectionCount: stat?.sectionCount ?? 0,
        totalDurationMs: stat?.totalDurationMs ?? null,
        pageCount: stat?.pageCount ?? 0,
        questionCount: stat?.questionCount ?? 0,
        hasQuickVersion: stat?.hasQuickVersion ?? false,
        rewriteMode: stat?.rewriteMode ?? null,
        isFree: item.productId === null,
        price: item.priceTry,
        isOwned: owned.has(item.id),
        libraryDocumentId: copies.get(item.id) ?? null,
      };
    });
  }

  /** İçerik detayı: içindekiler (örnek bölüm sesleriyle) ve kapsayan paketler. */
  async itemDetail(item: StoreItemRow, userId: number | null) {
    const [[card], sections, bundles] = await Promise.all([
      this.items([item], userId),
      this.itemRepository.findSections(item.documentId),
      this.bundleRepository.findPublishedForItem(item.id),
    ]);
    return {
      ...card!,
      sections: sections.map((section, index) => {
        const isSample = index < item.sampleSections;
        return {
          order: section.order,
          title: section.title,
          durationMs: section.durationMs,
          isSample,
          sampleAudioKey: isSample ? section.audioKey : null,
        };
      }),
      bundles: await this.bundles(bundles, userId),
    };
  }

  async bundles(bundles: StoreBundleRow[], userId: number | null) {
    const itemIdsByBundle = await this.bundleRepository.findItemIds(
      bundles.map((bundle) => bundle.id),
    );
    const allItemIds = [...new Set([...itemIdsByBundle.values()].flat())];
    const items = await this.itemRepository.findByIds(allItemIds);
    const [stats, owned] = await Promise.all([
      this.itemRepository.findStats(items.map((item) => item.documentId)),
      userId === null
        ? Promise.resolve(new Set<number>())
        : this.entitlementRepository.findOwnedIds(userId, allItemIds),
    ]);
    const documentByItem = new Map(
      items.map((item) => [item.id, item.documentId]),
    );

    return bundles.map((bundle) => {
      const itemIds = itemIdsByBundle.get(bundle.id) ?? [];
      const ownedItemCount = itemIds.filter((id) => owned.has(id)).length;
      return {
        ...bundle,
        price: bundle.priceTry,
        itemCount: itemIds.length,
        sectionCount: itemIds.reduce((sum, id) => {
          const documentId = documentByItem.get(id);
          return (
            sum +
            (documentId === undefined
              ? 0
              : (stats.get(documentId)?.sectionCount ?? 0))
          );
        }, 0),
        ownedItemCount,
        isOwned: itemIds.length > 0 && ownedItemCount === itemIds.length,
      };
    });
  }

  /** Paket detayı: paketteki içerikler (yayından kalkmış olanlar dahil). */
  async bundleDetail(bundle: StoreBundleRow, userId: number | null) {
    const [[card], itemIds] = await Promise.all([
      this.bundles([bundle], userId),
      this.bundleRepository.findItemIds([bundle.id]),
    ]);
    const items = await this.itemRepository.findByIds(
      itemIds.get(bundle.id) ?? [],
    );
    items.sort((a, b) => a.position - b.position || b.id - a.id);
    return { ...card!, items: await this.items(items, userId) };
  }
}
