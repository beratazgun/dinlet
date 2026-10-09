import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  CreatedResponse,
  NoContentResponse,
  OkResponse,
} from "#/core/http/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { generateSlug } from "#/core/utils/generate-slug.js";
import { Paginator } from "#/core/utils/paginator.js";
import type {
  AdminStoreItemListQueryDto,
  CreateStoreBundleBodyDto,
  CreateStoreCategoryBodyDto,
  CreateStoreItemBodyDto,
  StoreBundleListQueryDto,
  UpdateStoreBundleBodyDto,
  UpdateStoreCategoryBodyDto,
  UpdateStoreItemBodyDto,
} from "#/modules/store/dtos/index.js";
import {
  StoreBundleRepository,
  StoreCategoryRepository,
  StoreEntitlementRepository,
  StoreItemRepository,
  type StoreItemInput,
} from "#/modules/store/repository/index.js";
import { StoreCatalogService } from "#/modules/store/services/store-catalog.service.js";
import { StoreLibraryService } from "#/modules/store/services/store-library.service.js";
import { StorePresenterService } from "#/modules/store/services/store-presenter.service.js";
import { DocumentStatus } from "#database/enums.js";

/**
 * Mağaza yönetimi: kategoriler, içerikler, paketler. İçerik, yöneticinin
 * kendi kütüphanesindeki hazır nottan yayınlanır; başkasının notu
 * mağazaya konamaz (KVKK).
 */
@Injectable()
export class StoreAdminService {
  constructor(
    private readonly categoryRepository: StoreCategoryRepository,
    private readonly itemRepository: StoreItemRepository,
    private readonly bundleRepository: StoreBundleRepository,
    private readonly entitlementRepository: StoreEntitlementRepository,
    private readonly catalogService: StoreCatalogService,
    private readonly libraryService: StoreLibraryService,
    private readonly presenter: StorePresenterService,
    private readonly paginator: Paginator,
    private readonly dateManager: DateManager,
  ) {}

  // ─── Kategoriler ─────────────────────────────────────────────────────────

  async listCategories(): Promise<OkResponse> {
    return new OkResponse("Kategoriler", await this.presenter.categoryTree());
  }

  async createCategory(
    body: CreateStoreCategoryBodyDto,
  ): Promise<CreatedResponse> {
    const parentId = body.parentId ?? null;
    if (parentId !== null) await this.assertRootCategory(parentId);
    const slug = body.slug ?? generateSlug(body.name);
    if (await this.categoryRepository.findBySlug(slug)) throw slugTaken(slug);

    const category = await this.categoryRepository.create({
      parentId,
      slug,
      name: body.name,
      position: body.position ?? 0,
    });
    return new CreatedResponse("Kategori oluşturuldu", category);
  }

  async updateCategory(
    id: number,
    body: UpdateStoreCategoryBodyDto,
  ): Promise<OkResponse> {
    const category = await this.categoryRepository.findById(id);
    if (!category) throw new NotFoundException(`Kategori bulunamadı: ${id}`);
    if (body.parentId) {
      if (body.parentId === id) {
        throw new UnprocessableEntityException(
          "Kategori kendisinin altına taşınamaz.",
        );
      }
      await this.assertRootCategory(body.parentId);
      if ((await this.categoryRepository.findWithChildrenIds(id)).length > 1) {
        throw new UnprocessableEntityException(
          "Altında ders olan sınav başka bir sınavın altına taşınamaz.",
        );
      }
    }
    if (body.slug && body.slug !== category.slug) {
      if (await this.categoryRepository.findBySlug(body.slug))
        throw slugTaken(body.slug);
    }

    await this.categoryRepository.update(id, {
      parentId: body.parentId,
      slug: body.slug,
      name: body.name,
      position: body.position,
    });
    return new OkResponse(
      "Kategori güncellendi",
      await this.categoryRepository.findById(id),
    );
  }

  async deleteCategory(id: number): Promise<NoContentResponse> {
    if (!(await this.categoryRepository.findById(id))) {
      throw new NotFoundException(`Kategori bulunamadı: ${id}`);
    }
    if (await this.categoryRepository.isInUse(id)) {
      throw new ConflictException({
        message: "Kategoride ders, içerik veya paket var; önce onları taşıyın.",
        code: "STORE_CATEGORY_IN_USE",
      });
    }
    await this.categoryRepository.delete(id);
    return new NoContentResponse("Kategori silindi");
  }

  /** Katalog iki seviyelidir: ders yalnızca bir sınavın altına girer. */
  private async assertRootCategory(parentId: number): Promise<void> {
    const parent = await this.categoryRepository.findById(parentId);
    if (!parent)
      throw new NotFoundException(`Üst kategori bulunamadı: ${parentId}`);
    if (parent.parentId !== null) {
      throw new UnprocessableEntityException(
        "Ders yalnızca bir sınavın altına eklenebilir (en fazla iki seviye).",
      );
    }
  }

  // ─── İçerikler ───────────────────────────────────────────────────────────

  async listItems(query: AdminStoreItemListQueryDto): Promise<OkResponse> {
    const filter = await this.catalogService.itemFilter(
      query,
      null,
      query.published,
    );
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.itemRepository.count(filter),
      query: (window) => this.itemRepository.findPage(filter, window),
    });
    return new OkResponse(
      "Mağaza içerikleri listelendi",
      await this.presenter.items(docs, null),
      { meta: { pagination } },
    );
  }

  async createItem(
    body: CreateStoreItemBodyDto,
    adminUserId: number,
  ): Promise<CreatedResponse> {
    await this.assertPublishableDocument(body.documentId, adminUserId);
    if (await this.itemRepository.findByDocumentId(body.documentId)) {
      throw new ConflictException({
        message: "Bu not zaten mağazada.",
        code: "STORE_DOCUMENT_TAKEN",
      });
    }
    const slug = body.slug ?? generateSlug(body.title);
    if (await this.itemRepository.findBySlug(slug)) throw slugTaken(slug);
    if (body.productId) await this.assertProductFree(body.productId);
    const categoryIds = await this.assertCategories(body.categoryIds ?? []);

    const item = await this.itemRepository.create(
      {
        ...this.itemFields(body),
        slug,
        title: body.title,
        description: body.description,
        source: body.source,
        documentId: body.documentId,
        publishedAt: body.isPublished ? this.dateManager.toISOString() : null,
      },
      categoryIds,
    );
    return new CreatedResponse(
      "İçerik mağazaya eklendi",
      await this.adminItem(item.id),
    );
  }

  async updateItem(
    id: number,
    body: UpdateStoreItemBodyDto,
  ): Promise<OkResponse> {
    const item = await this.itemRepository.findById(id);
    if (!item) throw new NotFoundException(`İçerik bulunamadı: ${id}`);
    if (body.slug && body.slug !== item.slug) {
      if (await this.itemRepository.findBySlug(body.slug))
        throw slugTaken(body.slug);
    }
    if (body.productId && body.productId !== item.productId) {
      await this.assertProductFree(body.productId);
    }
    const categoryIds = body.categoryIds
      ? await this.assertCategories(body.categoryIds)
      : undefined;
    if (body.isPublished && !item.isPublished) {
      // Kaynak not bu arada yeniden işlenmiş olabilir; yalnızca hazırken yayına girer.
      const source = await this.itemRepository.findSourceDocument(
        item.documentId,
      );
      if (source?.status !== DocumentStatus.READY) throw sourceNotReady();
    }

    await this.itemRepository.update(
      id,
      {
        ...this.itemFields(body),
        slug: body.slug,
        title: body.title,
        description: body.description,
        source: body.source,
        publishedAt:
          body.isPublished && !item.publishedAt
            ? this.dateManager.toISOString()
            : undefined,
      },
      categoryIds,
    );
    return new OkResponse("İçerik güncellendi", await this.adminItem(id));
  }

  async grantItem(itemId: number, userId: number): Promise<OkResponse> {
    if (!(await this.itemRepository.findById(itemId))) {
      throw new NotFoundException(`İçerik bulunamadı: ${itemId}`);
    }
    if (!(await this.entitlementRepository.userExists(userId))) {
      throw new NotFoundException(`Kullanıcı bulunamadı: ${userId}`);
    }
    const granted = await this.libraryService.grantByAdmin(itemId, userId);
    return new OkResponse(
      granted.length > 0
        ? "İçerik kullanıcıya tanımlandı"
        : "Kullanıcı içeriğe zaten sahip",
    );
  }

  /** Ortak alanlar: boş bırakılan (`undefined`) alan değişmez. */
  private itemFields(body: UpdateStoreItemBodyDto): StoreItemInput {
    return {
      publisherName: body.publisherName,
      credit: body.credit,
      productId: body.productId,
      priceTry: toPrice(body.priceTry),
      sampleSections: body.sampleSections,
      isFeatured: body.isFeatured,
      isPublished: body.isPublished,
      position: body.position,
    };
  }

  private async adminItem(id: number) {
    const item = await this.itemRepository.findById(id);
    const [card] = await this.presenter.items([item!], null);
    return card;
  }

  /** Kaynak: yöneticinin kendi, silinmemiş, hazır ve kopya olmayan notu. */
  private async assertPublishableDocument(
    documentId: number,
    adminUserId: number,
  ): Promise<void> {
    const document = await this.itemRepository.findSourceDocument(documentId);
    if (!document || document.userId !== adminUserId || document.deletedAt) {
      throw new NotFoundException(`Not bulunamadı: ${documentId}`);
    }
    if (document.storeItemId !== null) {
      throw new UnprocessableEntityException(
        "Mağazadan eklenmiş bir not yeniden mağazaya konamaz.",
      );
    }
    if (document.status !== DocumentStatus.READY) throw sourceNotReady();
  }

  /** Ürün kimliği hem içeriklerde hem paketlerde tektir. */
  private async assertProductFree(productId: string): Promise<void> {
    if (
      (await this.itemRepository.findByProductId(productId)) ||
      (await this.bundleRepository.findByProductId(productId))
    ) {
      throw new ConflictException({
        message: `Ürün kimliği kullanımda: ${productId}`,
        code: "STORE_PRODUCT_TAKEN",
      });
    }
  }

  private async assertCategories(ids: number[]): Promise<number[]> {
    const unique = [...new Set(ids)];
    const existing = await this.categoryRepository.findExistingIds(unique);
    const missing = unique.filter((id) => !existing.includes(id));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `Kategori bulunamadı: ${missing.join(", ")}`,
      );
    }
    return unique;
  }

  // ─── Paketler ────────────────────────────────────────────────────────────

  async listBundles(query: StoreBundleListQueryDto): Promise<OkResponse> {
    const filter = {
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
    const bundles = await Promise.all(
      docs.map((bundle) => this.presenter.bundleDetail(bundle, null)),
    );
    return new OkResponse("Paketler listelendi", bundles, {
      meta: { pagination },
    });
  }

  async createBundle(body: CreateStoreBundleBodyDto): Promise<CreatedResponse> {
    const slug = body.slug ?? generateSlug(body.title);
    if (await this.bundleRepository.findBySlug(slug)) throw slugTaken(slug);
    await this.assertProductFree(body.productId);
    if (body.categoryId) await this.assertCategories([body.categoryId]);
    const itemIds = await this.assertItems(body.itemIds);

    const bundle = await this.bundleRepository.create(
      {
        slug,
        title: body.title,
        description: body.description,
        categoryId: body.categoryId ?? null,
        productId: body.productId,
        priceTry: toPrice(body.priceTry) ?? null,
        isPublished: body.isPublished ?? false,
        position: body.position ?? 0,
      },
      itemIds,
    );
    return new CreatedResponse(
      "Paket oluşturuldu",
      await this.adminBundle(bundle.id),
    );
  }

  async updateBundle(
    id: number,
    body: UpdateStoreBundleBodyDto,
  ): Promise<OkResponse> {
    const bundle = await this.bundleRepository.findById(id);
    if (!bundle) throw new NotFoundException(`Paket bulunamadı: ${id}`);
    if (body.slug && body.slug !== bundle.slug) {
      if (await this.bundleRepository.findBySlug(body.slug))
        throw slugTaken(body.slug);
    }
    if (body.productId && body.productId !== bundle.productId) {
      await this.assertProductFree(body.productId);
    }
    if (body.categoryId) await this.assertCategories([body.categoryId]);
    const itemIds = body.itemIds
      ? await this.assertItems(body.itemIds)
      : undefined;

    await this.bundleRepository.update(
      id,
      {
        slug: body.slug,
        title: body.title,
        description: body.description,
        categoryId: body.categoryId,
        productId: body.productId,
        priceTry: toPrice(body.priceTry),
        isPublished: body.isPublished,
        position: body.position,
      },
      itemIds,
    );
    return new OkResponse("Paket güncellendi", await this.adminBundle(id));
  }

  private async adminBundle(id: number) {
    const bundle = await this.bundleRepository.findById(id);
    return this.presenter.bundleDetail(bundle!, null);
  }

  /** Paket yalnızca ücretli içeriklerden oluşur. */
  private async assertItems(ids: number[]): Promise<number[]> {
    const unique = [...new Set(ids)];
    const items = await this.itemRepository.findByIds(unique);
    const missing = unique.filter(
      (id) => !items.some((item) => item.id === id),
    );
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `İçerik bulunamadı: ${missing.join(", ")}`,
      );
    }
    if (items.some((item) => item.productId === null)) {
      throw new UnprocessableEntityException(
        "Pakete yalnızca ücretli içerikler eklenebilir.",
      );
    }
    return unique;
  }
}

/** `undefined` değişmez, `null` fiyatı kaldırır; DB'ye 2 ondalıklı metin yazılır. */
function toPrice(value: number | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  return value.toFixed(2);
}

function slugTaken(slug: string): ConflictException {
  return new ConflictException({
    message: `Kısa ad kullanımda: ${slug}`,
    code: "STORE_SLUG_TAKEN",
  });
}

function sourceNotReady(): UnprocessableEntityException {
  return new UnprocessableEntityException(
    "Kaynak not hazır değil; işleme bitince yayınlanabilir.",
  );
}
