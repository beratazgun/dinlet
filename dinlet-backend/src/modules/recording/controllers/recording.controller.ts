import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  RecordingClipParamDto,
  RecordingListItemResDto,
  RecordingListQueryDto,
  RecordingSectionParamDto,
  RecordingSummaryResDto,
  SaveClipQueryDto,
  SectionRecordingResDto,
  UpdateRecordingBodyDto,
  UpdateVoiceBodyDto,
  VoiceSettingResDto,
} from "#/modules/recording/dtos/index.js";
import {
  RecordingService,
  VoiceSettingService,
} from "#/modules/recording/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * Kendi sesinle kayıt ve ses tercihi. Paragraf kaydı `multipart/form-data`
 * (`audio` alanı) ile gönderilir; dosya yalnızca bu kullanıcıya aittir.
 */
@ApiTags("Recordings")
@ApiBearerAuth()
@Controller()
export class RecordingController {
  constructor(
    private readonly recordingService: RecordingService,
    private readonly voiceService: VoiceSettingService,
  ) {}

  @Get("sections/:id/recording")
  @Serialize(SectionRecordingResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Bölüm kaydı",
    description:
      "Okunacak paragraflar (sonda tekrar özeti) ve kaydedilenler. Kayıt yoksa `status: null`. Bölüm hazır değilse 409.",
  })
  @ApiSuccessResponse({
    model: SectionRecordingResDto,
    description: "Bölüm kaydı",
  })
  @ApiErrorResponses(400, 401, 404, 409, 500)
  getRecording(
    @Param() params: RecordingSectionParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.recordingService.get(params.id, user.id);
  }

  @Put("sections/:id/recording/clips/:position")
  @Serialize(SectionRecordingResDto)
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["audio"],
      properties: { audio: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({
    summary: "Paragraf kaydını yükle",
    description:
      "Paragrafın (veya sondaki tekrar özetinin) kaydı; varsa eskisinin yerine geçer. M4A/AAC, MP3, WAV, WebM, 3GP; en fazla 15 MB.",
  })
  @ApiSuccessResponse({
    model: SectionRecordingResDto,
    description: "Paragraf kaydedildi",
  })
  @ApiErrorResponses(400, 401, 404, 409, 422, 429, 500)
  async saveClip(
    @Param() params: RecordingClipParamDto,
    @Query() query: SaveClipQueryDto,
    @Req() request: FastifyRequest,
    @CurrentUser() user: SessionUser,
  ) {
    const file = request.isMultipart() ? await request.file() : undefined;
    if (!file || file.fieldname !== "audio") {
      throw new BadRequestException(
        "Kayıt dosyası `audio` alanında gönderilmeli.",
      );
    }
    return this.recordingService.saveClip(
      params.id,
      params.position,
      query.durationMs,
      { mimeType: file.mimetype, buffer: await file.toBuffer() },
      user.id,
    );
  }

  @Patch("sections/:id/recording")
  @Serialize(SectionRecordingResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Kaydı kaydet / bu bölümde hangi ses çalsın",
    description:
      '`finalize: true` tüm paragraflar kayıtlıysa tek sese birleştirir (`status: PROCESSING` → `READY`); eksikse 422 (`RECORDING_INCOMPLETE`). `useOwnVoice: true` genel ses tercihini "Benim sesim" yapar.',
  })
  @ApiSuccessResponse({
    model: SectionRecordingResDto,
    description: "Kayıt güncellendi",
  })
  @ApiErrorResponses(400, 401, 404, 409, 422, 500)
  updateRecording(
    @Param() params: RecordingSectionParamDto,
    @Body() body: UpdateRecordingBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.recordingService.update(params.id, body, user.id);
  }

  @Delete("sections/:id/recording")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Kaydı sil",
    description: "Bölüm Dinlet sesiyle çalar.",
  })
  @ApiSuccessResponse({ status: 204, description: "Kayıt silindi" })
  @ApiErrorResponses(400, 401, 404, 409, 500)
  removeRecording(
    @Param() params: RecordingSectionParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.recordingService.remove(params.id, user.id);
  }

  @Get("me/recordings")
  @Serialize(RecordingListItemResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kayıtlarım" })
  @ApiSuccessResponse({
    model: RecordingListItemResDto,
    isArray: true,
    pagination: "offset",
    description: "Kayıtlar listelendi",
  })
  @ApiErrorResponses(400, 401, 500)
  listRecordings(
    @Query() query: RecordingListQueryDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.recordingService.list(query, user.id);
  }

  @Get("me/recordings/summary")
  @Serialize(RecordingSummaryResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Kayıtlarım özeti",
    description: "Hazır, yarım, toplam süre.",
  })
  @ApiSuccessResponse({
    model: RecordingSummaryResDto,
    description: "Kayıt özeti",
  })
  @ApiErrorResponses(401, 500)
  recordingSummary(@CurrentUser() user: SessionUser) {
    return this.recordingService.summary(user.id);
  }

  @Get("me/voice")
  @Serialize(VoiceSettingResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Ses tercihi" })
  @ApiSuccessResponse({ model: VoiceSettingResDto, description: "Ses tercihi" })
  @ApiErrorResponses(401, 500)
  getVoice(@CurrentUser() user: SessionUser) {
    return this.voiceService.get(user.id);
  }

  @Put("me/voice")
  @Serialize(VoiceSettingResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Ses tercihini değiştir",
    description: "Henüz kullanılamayan ses 422 (`VOICE_UNAVAILABLE`).",
  })
  @ApiSuccessResponse({
    model: VoiceSettingResDto,
    description: "Ses tercihi güncellendi",
  })
  @ApiErrorResponses(400, 401, 422, 500)
  updateVoice(
    @Body() body: UpdateVoiceBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.voiceService.update(body.voice, user.id);
  }
}
