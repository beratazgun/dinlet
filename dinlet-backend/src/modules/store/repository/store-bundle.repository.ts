import { Injectable } from "@nestjs/common";

import type { PageWindow } from "#/core/utils/paginator.js";
import { DatabaseService } from "#database/database.service.js";

const BUNDLE_FIELDS = [
  "id",
  "slug",
  "title",
  "description",
  "categoryId",
  "productId",
  "priceTry",
  "isPublished",
  "position",
  "createdAt",
  "updatedAt",
] as const;

export interface StoreBundleFilter {
  /** `true` yayındakiler, `false` yayında olmayanlar; verilmezse hepsi. */
  published?: boolean;
  /** Bu kategorilerden birinde gösterilen paketler. */
  categoryIds?: number[];
}

export interface StoreBundleInput {
  slug?: string;
  title?: string;
  description?: string;
  categoryId?: number | null;
  productId?: string;
  priceTry?: string | null;
  isPublished?: boolean;
  position?: number;
}

/** Paketler ("KPSS Tarih, tamamı") ve içerdikleri içerikler. */
@Injectable()
export class StoreBundleRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  private filtered(filter: StoreBundleFilter) {
    let query = this.db.orm.public.StoreBundle.where((bundle) =>
      bundle.id.gt(0),
    );
    if (filter.published !== undefined) {
      query = query.where({ isPublished: filter.published });
    }
    if (filter.categoryIds) {
      query = query.where((bundle) =>
        bundle.categoryId.in(filter.categoryIds!),
      );
    }
    return query;
  }

  async count(filter: StoreBundleFilter): Promise<number> {
    if (filter.categoryIds?.length === 0) return 0;
    const { total } = await this.filtered(filter).aggregate((aggregate) => ({
      total: aggregate.count(),
    }));
    return total;
  }

  async findPage(filter: StoreBundleFilter, window: PageWindow) {
    if (filter.categoryIds?.length === 0) return [];
    return await this.filtered(filter)
      .select(...BUNDLE_FIELDS)
      .orderBy([
        (bundle) => bundle.position.asc(),
        (bundle) => bundle.id.desc(),
      ])
      .limit(window.limit)
      .offset(window.offset)
      .all();
  }

  findById(id: number) {
    return this.db.orm.public.StoreBundle.where({ id })
      .select(...BUNDLE_FIELDS)
      .first();
  }

  findByProductId(productId: string) {
    return this.db.orm.public.StoreBundle.where({ productId })
      .select("id")
      .first();
  }

  findBySlug(slug: string) {
    return this.db.orm.public.StoreBundle.where({ slug }).select("id").first();
  }

  /** Paketlerin içerik ID'leri (tek sorgu). */
  async findItemIds(bundleIds: number[]): Promise<Map<number, number[]>> {
    const byBundle = new Map<number, number[]>();
    if (bundleIds.length === 0) return byBundle;
    const links = await this.db.orm.public.StoreBundleItem.where((link) =>
      link.bundleId.in(bundleIds),
    )
      .select("bundleId", "storeItemId")
      .all();
    for (const link of links) {
      byBundle.set(link.bundleId, [
        ...(byBundle.get(link.bundleId) ?? []),
        link.storeItemId,
      ]);
    }
    return byBundle;
  }

  /** İçeriği kapsayan yayındaki paketler (detayda "pakette daha uygun"). */
  async findPublishedForItem(itemId: number) {
    const links = await this.db.orm.public.StoreBundleItem.where({
      storeItemId: itemId,
    })
      .select("bundleId")
      .all();
    if (links.length === 0) return [];
    return await this.db.orm.public.StoreBundle.where((bundle) =>
      bundle.id.in(links.map((link) => link.bundleId)),
    )
      .where({ isPublished: true })
      .select(...BUNDLE_FIELDS)
      .orderBy((bundle) => bundle.position.asc())
      .all();
  }

  create(
    input: Required<
      Pick<StoreBundleInput, "slug" | "title" | "description" | "productId">
    > &
      StoreBundleInput,
    itemIds: number[],
  ) {
    return this.db.transaction(async (tx) => {
      const bundle = await tx.orm.public.StoreBundle.select("id").create(input);
      if (itemIds.length > 0) {
        await tx.orm.public.StoreBundleItem.createAll(
          itemIds.map((storeItemId) => ({ bundleId: bundle.id, storeItemId })),
        );
      }
      return bundle;
    });
  }

  update(id: number, patch: StoreBundleInput, itemIds?: number[]) {
    return this.db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.orm.public.StoreBundle.where({ id }).updateAndCount(patch);
      }
      if (itemIds) {
        await tx.orm.public.StoreBundleItem.where({
          bundleId: id,
        }).deleteAndCount();
        if (itemIds.length > 0) {
          await tx.orm.public.StoreBundleItem.createAll(
            itemIds.map((storeItemId) => ({ bundleId: id, storeItemId })),
          );
        }
      }
    });
  }
}
