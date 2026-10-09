import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AppAbility } from "#/core/casl/index.js";
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CheckPolicies,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  AdminStoreSubmissionResDto,
  AdminSubmissionListQueryDto,
  ApproveSubmissionBodyDto,
  RejectSubmissionBodyDto,
  StoreSubmissionResDto,
  SubmissionIdParamDto,
  AdminStoreBundleResDto,
  AdminStoreItemListQueryDto,
  AdminStoreItemResDto,
  CreateStoreBundleBodyDto,
  CreateStoreCategoryBodyDto,
  CreateStoreItemBodyDto,
  GrantStoreItemBodyDto,
  StoreBundleIdParamDto,
  StoreBundleListQueryDto,
  StoreCategoryIdParamDto,
  StoreCategoryResDto,
  StoreCategoryTreeResDto,
  StoreItemIdParamDto,
  UpdateStoreBundleBodyDto,
  UpdateStoreCategoryBodyDto,
  UpdateStoreItemBodyDto,
} from "#/modules/store/dtos/index.js";
import {
  StoreAdminService,
  StoreSubmissionService,
} from "#/modules/store/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * Mağaza yönetimi (editör/ops). İçerik akışı: editör PDF'i kendi hesabına
 * normal yoldan yükler, not hazır olunca `POST /admin/store/items` ile
 * mağazaya koyar, `isPublished` ile yayına alır.
 */
@ApiTags("Store Admin")
@ApiBearerAuth()
@Controller("admin/store")
export class StoreAdminController {
  constructor(
    private readonly adminService: StoreAdminService,
    private readonly submissionService: StoreSubmissionService,
  ) {}

  @Get("submissions")
  @CheckPolicies((ability: AppAbility) => ability.can("review", "Store"))
  @Serialize(AdminStoreSubmissionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Paylaşım başvuruları",
    description: "Varsayılan: incelemedekiler, ilk gelen önce.",
  })
  @ApiSuccessResponse({
    model: AdminStoreSubmissionResDto,
    isArray: true,
    pagination: "offset",
    description: "Paylaşım başvuruları",
  })
  @ApiErrorResponses(400, 401, 403, 500)
  listSubmissions(@Query() query: AdminSubmissionListQueryDto) {
    return this.submissionService.listForReview(query);
  }

  @Post("submissions/:id/approve")
  @CheckPolicies((ability: AppAbility) => ability.can("review", "Store"))
  @Serialize(StoreSubmissionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Paylaşımı onayla",
    description:
      'Notun o anki hâli (sesleriyle) kopyalanır ve ücretsiz "Öğrenci notu" olarak yayına girer. Başlık, açıklama ve kategoriler düzeltilebilir. Not silinmiş/hazır değilse 409.',
  })
  @ApiSuccessResponse({
    model: StoreSubmissionResDto,
    description: "Paylaşım onaylandı",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 500)
  approveSubmission(
    @Param() params: SubmissionIdParamDto,
    @Body() body: ApproveSubmissionBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.submissionService.approve(params.id, body, user.id);
  }

  @Post("submissions/:id/reject")
  @CheckPolicies((ability: AppAbility) => ability.can("review", "Store"))
  @Serialize(StoreSubmissionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Paylaşımı reddet",
    description: "Neden kullanıcıya bildirimle gösterilir.",
  })
  @ApiSuccessResponse({
    model: StoreSubmissionResDto,
    description: "Paylaşım reddedildi",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 500)
  rejectSubmission(
    @Param() params: SubmissionIdParamDto,
    @Body() body: RejectSubmissionBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.submissionService.reject(params.id, body.reason, user.id);
  }

  @Get("categories")
  @CheckPolicies((ability: AppAbility) => ability.can("list", "Store"))
  @Serialize(StoreCategoryTreeResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kategori ağacı (sınav → ders)" })
  @ApiSuccessResponse({
    model: StoreCategoryTreeResDto,
    isArray: true,
    description: "Kategoriler",
  })
  @ApiErrorResponses(401, 403, 500)
  listCategories() {
    return this.adminService.listCategories();
  }

  @Post("categories")
  @CheckPolicies((ability: AppAbility) => ability.can("create", "Store"))
  @Serialize(StoreCategoryResDto)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Kategori oluştur",
    description:
      "`parentId` yoksa sınav, varsa o sınavın dersi. Kısa ad çakışırsa 409 (`STORE_SLUG_TAKEN`).",
  })
  @ApiSuccessResponse({
    model: StoreCategoryResDto,
    status: 201,
    description: "Kategori oluşturuldu",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 500)
  createCategory(@Body() body: CreateStoreCategoryBodyDto) {
    return this.adminService.createCategory(body);
  }

  @Patch("categories/:id")
  @CheckPolicies((ability: AppAbility) => ability.can("update", "Store"))
  @Serialize(StoreCategoryResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kategoriyi güncelle" })
  @ApiSuccessResponse({
    model: StoreCategoryResDto,
    description: "Kategori güncellendi",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 500)
  updateCategory(
    @Param() params: StoreCategoryIdParamDto,
    @Body() body: UpdateStoreCategoryBodyDto,
  ) {
    return this.adminService.updateCategory(params.id, body);
  }

  @Delete("categories/:id")
  @CheckPolicies((ability: AppAbility) => ability.can("delete", "Store"))
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Kategoriyi sil",
    description:
      "Altında ders, içerik veya paket varsa 409 (`STORE_CATEGORY_IN_USE`).",
  })
  @ApiSuccessResponse({ status: 204, description: "Kategori silindi" })
  @ApiErrorResponses(400, 401, 403, 404, 409, 500)
  deleteCategory(@Param() params: StoreCategoryIdParamDto) {
    return this.adminService.deleteCategory(params.id);
  }

  @Get("items")
  @CheckPolicies((ability: AppAbility) => ability.can("list", "Store"))
  @Serialize(AdminStoreItemResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Tüm içerikler (yayında olmayanlar dahil)" })
  @ApiSuccessResponse({
    model: AdminStoreItemResDto,
    isArray: true,
    pagination: "offset",
    description: "Mağaza içerikleri listelendi",
  })
  @ApiErrorResponses(400, 401, 403, 500)
  listItems(@Query() query: AdminStoreItemListQueryDto) {
    return this.adminService.listItems(query);
  }

  @Post("items")
  @CheckPolicies((ability: AppAbility) => ability.can("create", "Store"))
  @Serialize(AdminStoreItemResDto)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Notu mağazaya koy",
    description:
      "Kaynak, isteği yapanın kendi hazır notudur (başkasının notu 404). Not zaten mağazadaysa 409 (`STORE_DOCUMENT_TAKEN`), ürün kimliği kullanımdaysa 409 (`STORE_PRODUCT_TAKEN`). `productId` yoksa içerik ücretsizdir.",
  })
  @ApiSuccessResponse({
    model: AdminStoreItemResDto,
    status: 201,
    description: "İçerik mağazaya eklendi",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 500)
  createItem(
    @Body() body: CreateStoreItemBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.adminService.createItem(body, user.id);
  }

  @Patch("items/:id")
  @CheckPolicies((ability: AppAbility) => ability.can("update", "Store"))
  @Serialize(AdminStoreItemResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "İçeriği güncelle / yayına al / yayından kaldır",
    description:
      "Yayından kaldırılan içerik mağazada görünmez; sahipleri kütüphanelerinde tutar. Kaynak not değiştirilemez.",
  })
  @ApiSuccessResponse({
    model: AdminStoreItemResDto,
    description: "İçerik güncellendi",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 500)
  updateItem(
    @Param() params: StoreItemIdParamDto,
    @Body() body: UpdateStoreItemBodyDto,
  ) {
    return this.adminService.updateItem(params.id, body);
  }

  @Post("items/:id/grants")
  @CheckPolicies((ability: AppAbility) => ability.can("grant", "Store"))
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "İçeriği kullanıcıya tanımla",
    description:
      "Destek için: satın alma sorunlarında içeriği ücretsiz tanımlar.",
  })
  @ApiSuccessResponse({ description: "İçerik kullanıcıya tanımlandı" })
  @ApiErrorResponses(400, 401, 403, 404, 500)
  grantItem(
    @Param() params: StoreItemIdParamDto,
    @Body() body: GrantStoreItemBodyDto,
  ) {
    return this.adminService.grantItem(params.id, body.userId);
  }

  @Get("bundles")
  @CheckPolicies((ability: AppAbility) => ability.can("list", "Store"))
  @Serialize(AdminStoreBundleResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Tüm paketler (yayında olmayanlar dahil)" })
  @ApiSuccessResponse({
    model: AdminStoreBundleResDto,
    isArray: true,
    pagination: "offset",
    description: "Paketler listelendi",
  })
  @ApiErrorResponses(400, 401, 403, 500)
  listBundles(@Query() query: StoreBundleListQueryDto) {
    return this.adminService.listBundles(query);
  }

  @Post("bundles")
  @CheckPolicies((ability: AppAbility) => ability.can("create", "Store"))
  @Serialize(AdminStoreBundleResDto)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Paket oluştur",
    description: "Pakete yalnızca ücretli içerikler eklenir.",
  })
  @ApiSuccessResponse({
    model: AdminStoreBundleResDto,
    status: 201,
    description: "Paket oluşturuldu",
  })
  @ApiErrorResponses(400, 401, 403, 409, 422, 500)
  createBundle(@Body() body: CreateStoreBundleBodyDto) {
    return this.adminService.createBundle(body);
  }

  @Patch("bundles/:id")
  @CheckPolicies((ability: AppAbility) => ability.can("update", "Store"))
  @Serialize(AdminStoreBundleResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Paketi güncelle / yayına al" })
  @ApiSuccessResponse({
    model: AdminStoreBundleResDto,
    description: "Paket güncellendi",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 500)
  updateBundle(
    @Param() params: StoreBundleIdParamDto,
    @Body() body: UpdateStoreBundleBodyDto,
  ) {
    return this.adminService.updateBundle(params.id, body);
  }
}
