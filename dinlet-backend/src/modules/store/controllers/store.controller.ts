import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import {
  StoreBundleDetailResDto,
  StoreBundleIdParamDto,
  StoreBundleListQueryDto,
  StoreBundleResDto,
  StoreHomeResDto,
  StoreItemDetailResDto,
  StoreItemIdParamDto,
  StoreItemListQueryDto,
  StoreItemResDto,
  StoreLibraryResDto,
  StorePurchaseSyncResDto,
} from "#/modules/store/dtos/index.js";
import {
  StoreCatalogService,
  StoreLibraryService,
} from "#/modules/store/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * Not mağazası. Satın alma uygulamada RevenueCat ile yapılır (tek seferlik
 * ürün, `productId`); sahiplik webhook'la ya da `POST /store/purchases/sync`
 * ile gelir. Kütüphaneye eklenen içerik sayfa kotasından düşmez.
 */
@ApiTags("Store")
@ApiBearerAuth()
@Controller("store")
export class StoreController {
  constructor(
    private readonly catalogService: StoreCatalogService,
    private readonly libraryService: StoreLibraryService,
  ) {}

  @Get()
  @Serialize(StoreHomeResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Mağaza ana ekranı",
    description: "Sınav çipleri (dersleriyle) ve öne çıkan içerikler.",
  })
  @ApiSuccessResponse({ model: StoreHomeResDto, description: "Mağaza" })
  @ApiErrorResponses(401, 500)
  home(@CurrentUser() user: SessionUser) {
    return this.catalogService.home(user.id);
  }

  @Get("items")
  @Serialize(StoreItemResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Mağaza içeriklerini listele",
    description:
      "Sınav/ders (`categoryId`, sınavda alt dersler dahil), kaynak, ücretsiz/ücretli, öne çıkan, sahip olunan ve başlık araması.",
  })
  @ApiSuccessResponse({
    model: StoreItemResDto,
    isArray: true,
    pagination: "offset",
    description: "Mağaza içerikleri listelendi",
  })
  @ApiErrorResponses(400, 401, 500)
  listItems(
    @Query() query: StoreItemListQueryDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.catalogService.listItems(query, user.id);
  }

  @Get("items/:id")
  @Serialize(StoreItemDetailResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "İçerik detayı",
    description:
      "İçindekiler; örnek bölümlerin sesi (`audioUrl`) satın almadan dinlenebilir. Yayından kalkmış içerik yalnızca sahibine görünür.",
  })
  @ApiSuccessResponse({
    model: StoreItemDetailResDto,
    description: "İçerik getirildi",
  })
  @ApiErrorResponses(400, 401, 404, 500)
  getItem(
    @Param() params: StoreItemIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.catalogService.getItem(params.id, user.id);
  }

  @Post("items/:id/library")
  @Serialize(StoreLibraryResDto)
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Kütüphaneme ekle",
    description:
      "Ücretsiz içerik doğrudan eklenir. Ücretli içerik satın alınmış olmalıdır; değilse 402 (`data.code`: `PURCHASE_REQUIRED`). Zaten kütüphanedeyse 200 ile mevcut not döner. Not açmak için `GET /documents/:documentId`.",
  })
  @ApiSuccessResponse({
    model: StoreLibraryResDto,
    status: 201,
    description: "İçerik kütüphanene eklendi",
  })
  @ApiErrorResponses(400, 401, 402, 404, 409, 429, 500)
  addItem(
    @Param() params: StoreItemIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.libraryService.addItem(params.id, user.id);
  }

  @Get("bundles")
  @Serialize(StoreBundleResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Paketleri listele" })
  @ApiSuccessResponse({
    model: StoreBundleResDto,
    isArray: true,
    pagination: "offset",
    description: "Paketler listelendi",
  })
  @ApiErrorResponses(400, 401, 500)
  listBundles(
    @Query() query: StoreBundleListQueryDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.catalogService.listBundles(query, user.id);
  }

  @Get("bundles/:id")
  @Serialize(StoreBundleDetailResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Paket detayı ve içerikleri" })
  @ApiSuccessResponse({
    model: StoreBundleDetailResDto,
    description: "Paket getirildi",
  })
  @ApiErrorResponses(400, 401, 404, 500)
  getBundle(
    @Param() params: StoreBundleIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.catalogService.getBundle(params.id, user.id);
  }

  @Post("bundles/:id/library")
  @Serialize(StoreLibraryResDto)
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Paketi kütüphaneme ekle",
    description:
      "Paket satın alınmış olmalıdır; değilse 402 (`PURCHASE_REQUIRED`). Eksik içerikler eklenir; hepsi zaten varsa 200.",
  })
  @ApiSuccessResponse({
    model: StoreLibraryResDto,
    status: 201,
    description: "Paket kütüphanene eklendi",
  })
  @ApiErrorResponses(400, 401, 402, 404, 409, 429, 500)
  addBundle(
    @Param() params: StoreBundleIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.libraryService.addBundle(params.id, user.id);
  }

  @Post("purchases/sync")
  @Serialize(StorePurchaseSyncResDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Satın almaları geri yükle",
    description:
      "RevenueCat'teki tek seferlik satın almaları hesaba tanımlar (yeni cihaz, gecikmiş webhook). Satın alma tamamlanınca da çağrılabilir.",
  })
  @ApiSuccessResponse({
    model: StorePurchaseSyncResDto,
    description: "Satın almalar güncel",
  })
  @ApiErrorResponses(401, 429, 500)
  syncPurchases(@CurrentUser() user: SessionUser) {
    return this.libraryService.syncPurchases(user.id);
  }
}
