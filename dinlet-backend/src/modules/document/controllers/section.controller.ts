import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
  PlaybackProgressResDto,
  RegenerateSectionResDto,
  SavePlaybackBodyDto,
  SectionDetailResDto,
  SectionIdParamDto,
} from "#/modules/document/dtos/index.js";
import {
  DocumentService,
  PlaybackService,
  SectionService,
} from "#/modules/document/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Sections")
@ApiBearerAuth()
@Controller("sections")
export class SectionController {
  constructor(
    private readonly sectionService: SectionService,
    private readonly playbackService: PlaybackService,
    private readonly documentService: DocumentService,
  ) {}

  @Post(":id/regenerate")
  @Serialize(RegenerateSectionResDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Bölümü yeniden üret",
    description:
      "Akıcı anlatımı ve sesi baştan üretir (kapsam ekranı). Pro + rıza gerekir (403, `data.code`); düz okumada 422; not işlenirken 409. Kota düşülmez.",
  })
  @ApiSuccessResponse({
    model: RegenerateSectionResDto,
    status: 202,
    description: "Bölüm yeniden üretiliyor",
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422, 429, 500)
  regenerate(
    @Param() params: SectionIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.documentService.regenerateSection(params.id, user.id);
  }

  @Get(":id")
  @Serialize(SectionDetailResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Bölüm detayı",
    description:
      "Sesin CDN adresi (`audioUrl`) ve ekranda okumak için seslendirilen metin.",
  })
  @ApiSuccessResponse({ model: SectionDetailResDto, description: "Bölüm" })
  @ApiErrorResponses(400, 401, 404, 500)
  get(
    @Param() params: SectionIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.sectionService.get(params.id, user.id);
  }

  @Put(":id/progress")
  @Serialize(PlaybackProgressResDto)
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Dinleme konumunu kaydet",
    description: "İstemci dinlerken ~15 sn'de bir ve duraklatınca gönderir.",
  })
  @ApiSuccessResponse({
    model: PlaybackProgressResDto,
    description: "Konum kaydedildi",
  })
  @ApiErrorResponses(400, 401, 404, 429, 500)
  saveProgress(
    @Param() params: SectionIdParamDto,
    @Body() body: SavePlaybackBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.playbackService.save(params.id, body, user.id);
  }
}
