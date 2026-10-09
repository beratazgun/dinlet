import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { PageQueryDto } from "#/core/dtos/request/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import type {
  CreatedResponse,
  NoContentResponse,
  OkResponse,
} from "#/core/http/index.js";
import {
  CreateMediaUploadBodyDto,
  MediaIdParamDto,
  MediaResDto,
  MediaUploadResDto,
  UploadIdParamDto,
} from "#/modules/media/dtos/index.js";
import {
  MediaService,
  MediaUploadService,
} from "#/modules/media/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * Kullanıcının yüklediği dosyalar (Dinlet'te PDF notları).
 *
 * Yükleme iki adımlıdır ve dosya API sunucusundan geçmez:
 * 1. `POST /media/uploads` → imzalı URL; istemci dosyayı bu URL'e `PUT` eder.
 * 2. `POST /media/uploads/:uploadId/complete` → dosya doğrulanır, kayıt açılır.
 */
@ApiTags("Media")
@ApiCookieAuth()
@Controller("media")
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly mediaUploadService: MediaUploadService,
  ) {}

  @Post("uploads")
  @Serialize(MediaUploadResDto)
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Yükleme URL'i al",
    description:
      "Dönen `uploadUrl`'e dosya, `headers` içindeki başlıklarla `PUT` edilir. URL 10 dakika geçerlidir.",
  })
  @ApiSuccessResponse({
    model: MediaUploadResDto,
    status: 201,
    description: "Yükleme URL'i oluşturuldu",
  })
  @ApiErrorResponses(400, 401, 403, 429, 500)
  createUpload(
    @Body() body: CreateMediaUploadBodyDto,
    @CurrentUser() user: SessionUser,
  ): Promise<CreatedResponse> {
    return this.mediaUploadService.createUpload(body, user.id);
  }

  @Post("uploads/:uploadId/complete")
  @Serialize(MediaResDto)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Yüklemeyi tamamla" })
  @ApiSuccessResponse({
    model: MediaResDto,
    status: 201,
    description: "Medya kaydedildi",
  })
  @ApiErrorResponses(400, 401, 403, 404, 422, 500)
  completeUpload(
    @Param() params: UploadIdParamDto,
    @CurrentUser() user: SessionUser,
  ): Promise<CreatedResponse> {
    return this.mediaUploadService.completeUpload(params, user.id);
  }

  @Get()
  @Serialize(MediaResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Medyalarımı listele" })
  @ApiSuccessResponse({
    model: MediaResDto,
    isArray: true,
    pagination: "offset",
    description: "Medyalar",
  })
  @ApiErrorResponses(400, 401, 500)
  list(
    @Query() query: PageQueryDto,
    @CurrentUser() user: SessionUser,
  ): Promise<OkResponse> {
    return this.mediaService.list(query, user.id);
  }

  @Get(":id")
  @Serialize(MediaResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Medyayı getir" })
  @ApiSuccessResponse({ model: MediaResDto, description: "Medya" })
  @ApiErrorResponses(400, 401, 404, 500)
  get(
    @Param() params: MediaIdParamDto,
    @CurrentUser() user: SessionUser,
  ): Promise<OkResponse> {
    return this.mediaService.get(params.id, user.id);
  }

  @Delete(":id")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Medyayı sil",
    description: "Bir nota bağlı dosya silinemez; önce not silinmelidir.",
  })
  @ApiSuccessResponse({ status: 204, description: "Medya silindi" })
  @ApiErrorResponses(400, 401, 403, 404, 500)
  delete(
    @Param() params: MediaIdParamDto,
    @CurrentUser() user: SessionUser,
  ): Promise<NoContentResponse> {
    return this.mediaService.delete(params.id, user.id);
  }
}
