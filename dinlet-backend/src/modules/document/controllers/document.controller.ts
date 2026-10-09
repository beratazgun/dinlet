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
import { Throttle } from "@nestjs/throttler";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  CreateDocumentBodyDto,
  DocumentDetailResDto,
  CoverageResDto,
  DocumentListItemResDto,
  DocumentPreflightBodyDto,
  DocumentPreflightResDto,
  DocumentIdParamDto,
  DocumentListQueryDto,
  DocumentResDto,
  UpdateDocumentBodyDto,
} from "#/modules/document/dtos/index.js";
import {
  CoverageService,
  DocumentService,
} from "#/modules/document/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * Notlar. Akış: PDF `POST /media/uploads` → `PUT` → `complete` ile R2'ye
 * yüklenir, ardından `POST /documents { mediaId }` ile işleme alınır.
 * İlerleme socket (`document:progress`) veya `GET /documents/:id` ile izlenir.
 */
@ApiTags("Documents")
@ApiBearerAuth()
@Controller("documents")
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly coverageService: CoverageService,
  ) {}

  @Post()
  @Serialize(DocumentResDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Notu işleme al",
    description:
      "PDF doğrulanır (tür, boyut, sayfa, şifre), sayfa sayısı aylık kotadan düşülür ve işleme kuyruğa alınır. Aynı PDF daha önce yüklendiyse 200 ile mevcut not döner. Kota yetmezse 402. `rewriteMode: FLUENT` verilemiyorsa 403 (`data.code`: `PRO_REQUIRED` veya `CROSS_BORDER_CONSENT_REQUIRED`).",
  })
  @ApiSuccessResponse({
    model: DocumentResDto,
    status: 201,
    description: "Not işleme alındı",
  })
  @ApiErrorResponses(400, 401, 402, 403, 404, 409, 413, 422, 429, 500)
  create(
    @Body() body: CreateDocumentBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.create(body, user.id);
  }

  @Post("preflight")
  @Serialize(DocumentPreflightResDto)
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Yüklenen PDF'i ön kontrol et",
    description:
      "Yükleme ekranı için: sayfa sayısı, kalan sayfa hakkına etkisi, akıcı anlatımın seçilebilirliği ve aynı PDF'in daha önce yüklenip yüklenmediği. Not oluşturmaz, kota düşmez. Geçersiz PDF 422, boyut 413.",
  })
  @ApiSuccessResponse({ model: DocumentPreflightResDto, description: "PDF kontrol edildi" })
  @ApiErrorResponses(400, 401, 404, 413, 422, 429, 500)
  preflight(
    @Body() body: DocumentPreflightBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.preflight(body, user.id);
  }

  @Get()
  @Serialize(DocumentListItemResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Notlarımı listele" })
  @ApiSuccessResponse({
    model: DocumentListItemResDto,
    isArray: true,
    pagination: "cursor",
    description: "Notlar (yeniden eskiye)",
  })
  @ApiErrorResponses(400, 401, 500)
  list(
    @Query() query: DocumentListQueryDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.list(query, user.id);
  }

  @Get(":id")
  @Serialize(DocumentDetailResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Not detayı, bölümler ve ilerleme" })
  @ApiSuccessResponse({ model: DocumentDetailResDto, description: "Not" })
  @ApiErrorResponses(400, 401, 404, 500)
  get(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.get(params.id, user.id);
  }

  @Get(":id/coverage")
  @Serialize(CoverageResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Kapsam güvencesi",
    description:
      "Nottaki tarih, sayı ve özel isimlerin anlatımda geçme oranı ve geçmeyenler (kural tabanlı, LLM'siz).",
  })
  @ApiSuccessResponse({ model: CoverageResDto, description: "Kapsam" })
  @ApiErrorResponses(400, 401, 404, 500)
  getCoverage(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.coverageService.get(params.id, user.id);
  }

  @Patch(":id")
  @Serialize(DocumentResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Not başlığını değiştir" })
  @ApiSuccessResponse({ model: DocumentResDto, description: "Not güncellendi" })
  @ApiErrorResponses(400, 401, 404, 500)
  rename(
    @Param() params: DocumentIdParamDto,
    @Body() body: UpdateDocumentBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.rename(params.id, body, user.id);
  }

  @Delete(":id")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Notu sil",
    description:
      "Not hemen listeden kalkar; PDF ve ses dosyaları zamanlanmış temizlikle kalıcı silinir.",
  })
  @ApiSuccessResponse({ status: 204, description: "Not silindi" })
  @ApiErrorResponses(400, 401, 404, 500)
  delete(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.delete(params.id, user.id);
  }

  @Post(":id/retry")
  @Serialize(DocumentResDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Başarısız bölümleri yeniden dene",
    description:
      "`PARTIAL` veya `FAILED` notta başarısız bölümleri yeniden kuyruğa alır. `FAILED` notun kotası yeniden düşülür.",
  })
  @ApiSuccessResponse({
    model: DocumentResDto,
    status: 202,
    description: "Yeniden işleme alındı",
  })
  @ApiErrorResponses(400, 401, 402, 404, 409, 422, 500)
  retry(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.retry(params.id, user.id);
  }
}
