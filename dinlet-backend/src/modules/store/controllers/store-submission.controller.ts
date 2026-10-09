import {
  Body,
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
  CreateSubmissionBodyDto,
  StoreSubmissionResDto,
  SubmissionIdParamDto,
  SubmissionListQueryDto,
} from "#/modules/store/dtos/index.js";
import { StoreSubmissionService } from "#/modules/store/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * "Mağazada paylaş": herkes kendi hazır notunu ücretsiz paylaşabilir;
 * editör onayından sonra mağazada görünür.
 */
@ApiTags("Store")
@ApiBearerAuth()
@Controller("store/submissions")
export class StoreSubmissionController {
  constructor(private readonly submissionService: StoreSubmissionService) {}

  @Post()
  @Serialize(StoreSubmissionResDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Notumu mağazada paylaş",
    description:
      "Kendi, tüm bölümleri hazır notun incelemeye gönderilir; `confirmRights: true` zorunlu. Not zaten incelemede veya yayındaysa 409 (`SUBMISSION_EXISTS`). Mağazadan eklenen içerik paylaşılamaz (422).",
  })
  @ApiSuccessResponse({
    model: StoreSubmissionResDto,
    status: 201,
    description: "Notun incelemeye gönderildi",
  })
  @ApiErrorResponses(400, 401, 404, 409, 422, 429, 500)
  submit(
    @Body() body: CreateSubmissionBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.submissionService.submit(body, user.id);
  }

  @Get()
  @Serialize(StoreSubmissionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Paylaştıklarım",
    description: "En yeni önce; `documentId` ile bir notun paylaşım durumu.",
  })
  @ApiSuccessResponse({
    model: StoreSubmissionResDto,
    isArray: true,
    pagination: "offset",
    description: "Paylaşımların listelendi",
  })
  @ApiErrorResponses(400, 401, 500)
  listMine(
    @Query() query: SubmissionListQueryDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.submissionService.listMine(query, user.id);
  }

  @Post(":id/withdraw")
  @Serialize(StoreSubmissionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Paylaşımı geri çek / mağazadan kaldır",
    description:
      "İncelemedeyse geri çekilir; yayındaysa mağazadan kalkar (daha önce ekleyenlerin kütüphanesinde kalır).",
  })
  @ApiSuccessResponse({
    model: StoreSubmissionResDto,
    description: "Paylaşım kapatıldı",
  })
  @ApiErrorResponses(400, 401, 404, 409, 500)
  withdraw(
    @Param() params: SubmissionIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.submissionService.withdraw(params.id, user.id);
  }
}
