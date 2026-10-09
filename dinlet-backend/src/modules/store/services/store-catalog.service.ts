import { Injectable, NotFoundException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { Paginator } from "#/core/utils/paginator.js";
import type {
  StoreBundleListQueryDto,
  StoreItemListQueryDto,
} from "#/modules/store/dtos/index.js";
import {
  StoreBundleRepository,
  StoreCategoryRepository,
  StoreEntitlementRepository,
  StoreItemRepository,
  type StoreItemFilter,
} from "#/modules/store/repository/index.js";
import { StorePresenterService } from "#/modules/store/services/store-presenter.service.js";

const FEATURED_LIMIT = 5;

/** Mağazada gezinme: ana ekran, liste, içerik ve paket detayı. */
@Injectable()
export class StoreCatalogService {
  constructor(
    private readonly categoryRepository: StoreCategoryRepository,
    private readonly itemRepository: StoreItemRepository,
    private readonly bundleRepository: StoreBundleRepository,
    private readonly entitlementRepository: StoreEntitlementRepository,
    private readonly presenter: StorePresenterService,
    private readonly paginator: Paginator,
  ) {}

  /** Ana ekran: sınav çipleri (dersleriyle) ve öne çıkanlar. */
  async home(userId: number): Promise<OkResponse> {
    const [categories, featured] = await Promise.all([
      this.presenter.categoryTree(),
      this.itemRepository.findPage(
        { published: true, featured: true },
        { limit: FEATURED_LIMIT, offset: 0 },
      ),
    ]);
    return new OkResponse("Mağaza", {
      categories,
      featured: await this.presenter.items(featured, userId),
    });
  }

  async listItems(
    query: StoreItemListQueryDto,
    userId: number,
  ): Promise<OkResponse> {
    const filter = await this.itemFilter(query, userId);
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.itemRepository.count(filter),
      query: (window) => this.itemRepository.findPage(filter, window),
    });
    return new OkResponse(
      "Mağaza içerikleri listelendi",
      await this.presenter.items(docs, userId),
      { meta: { pagination } },
    );
  }

  /**
   * Kategori, sahiplik ve diğer süzgeçler. Sınav seçilince altındaki
   * derslerin içerikleri de gelir.
   */
  async itemFilter(
    query: Omit<StoreItemListQueryDto, "owned"> & { owned?: boolean },
    userId: number | null,
    published: boolean | undefined = true,
  ): Promise<StoreItemFilter> {
    let ids: number[] | undefined;
    if (query.categoryId) {
      const categoryIds = await this.categoryRepository.findWithChildrenIds(
        query.categoryId,
      );
      ids = await this.itemRepository.findIdsByCategories(categoryIds);
    }

    let excludeIds: number[] | undefined;
    if (query.owned !== undefined && userId !== null) {
      const owned = [
        ...(await this.entitlementRepository.findOwnedIds(userId)),
      ];
      if (query.owned)
        ids = ids ? ids.filter((id) => owned.includes(id)) : owned;
      else excludeIds = owned;
    }

    return {
      // Sahip olunan içerik yayından kalksa da "Sahip olduklarım"da görünür.
      published: query.owned === true ? undefined : published,
      ids,
      excludeIds,
      source: query.source,
      free: query.price === undefined ? undefined : query.price === "free",
      featured: query.featured,
      search: query.q || undefined,
    };
  }

  async getItem(id: number, userId: number): Promise<OkResponse> {
    const item = await this.itemRepository.findById(id);
    if (
      !item ||
      (!item.isPublished &&
        !(await this.entitlementRepository.isOwned(userId, id)))
    ) {
      throw new NotFoundException(`İçerik bulunamadı: ${id}`);
    }
    return new OkResponse(
      "İçerik getirildi",
      await this.presenter.itemDetail(item, userId),
    );
  }

  async listBundles(
    query: StoreBundleListQueryDto,
    userId: number,
  ): Promise<OkResponse> {
    const filter = {
      published: true,
      categoryIds: query.categoryId
        ? await this.categoryRepository.findWithChildrenIds(query.categoryId)
        : undefined,
    };
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.bundleRepository.count(filter),
      query: (window) => this.bundleRepository.findPage(filter, window),
    });
    return new OkResponse(
      "Paketler listelendi",
      await this.presenter.bundles(docs, userId),
      { meta: { pagination } },
    );
  }

  async getBundle(id: number, userId: number): Promise<OkResponse> {
    const bundle = await this.bundleRepository.findById(id);
    if (!bundle?.isPublished) {
      throw new NotFoundException(`Paket bulunamadı: ${id}`);
    }
    return new OkResponse(
      "Paket getirildi",
      await this.presenter.bundleDetail(bundle, userId),
    );
  }
}
