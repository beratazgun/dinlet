import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
  DocumentIdParamDto,
  MnemonicIdParamDto,
  MnemonicListResDto,
  MnemonicRequestResDto,
  MnemonicResDto,
  QuickRequestResDto,
  UpdateMnemonicBodyDto,
} from "#/modules/document/dtos/index.js";
import { StudyGenerationService } from "#/modules/document/services/index.js";
import type { SessionUser } from "#/types/index.js";

const LLM_TOOL_NOTE =
  "Pro + yurt dışı aktarım rızası gerekir (403, `data.code`: `PRO_REQUIRED` / `CROSS_BORDER_CONSENT_REQUIRED`); not hazır değilse 409.";

@ApiTags("Study tools")
@ApiBearerAuth()
@Controller()
export class StudyToolsController {
  constructor(private readonly studyGeneration: StudyGenerationService) {}

  @Post("documents/:id/quick")
  @Serialize(QuickRequestResDto)
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Hızlı tekrar sürümünü hazırla",
    description: `Dinleme modu "Hızlı tekrar": yalnızca ana bilgiler, kısa cümleler. Bölümlerin \`quickStatus\`'u hazır olunca \`quickAudioUrl\` dolar. ${LLM_TOOL_NOTE}`,
  })
  @ApiSuccessResponse({
    model: QuickRequestResDto,
    status: 202,
    description: "Hazırlanıyor",
  })
  @ApiErrorResponses(401, 403, 404, 409, 429, 500)
  requestQuick(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.studyGeneration.requestQuick(params.id, user.id);
  }

  @Get("documents/:id/mnemonics")
  @Serialize(MnemonicListResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Hafıza kancaları",
    description: "Öneriler ve saklananlar; üretim durumu.",
  })
  @ApiSuccessResponse({
    model: MnemonicListResDto,
    description: "Hafıza kancaları",
  })
  @ApiErrorResponses(401, 404, 500)
  listMnemonics(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.studyGeneration.listMnemonics(params.id, user.id);
  }

  @Post("documents/:id/mnemonics")
  @Serialize(MnemonicRequestResDto)
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Hafıza kancası öner",
    description: `Saklanmamış eski öneriler yenileriyle değişir. ${LLM_TOOL_NOTE}`,
  })
  @ApiSuccessResponse({
    model: MnemonicRequestResDto,
    status: 202,
    description: "Hazırlanıyor",
  })
  @ApiErrorResponses(401, 403, 404, 409, 429, 500)
  requestMnemonics(
    @Param() params: DocumentIdParamDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.studyGeneration.requestMnemonics(params.id, user.id);
  }

  @Patch("mnemonics/:id")
  @Serialize(MnemonicResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Hafıza kancasını sakla / kaldır",
    description: "Saklanan kanca seslendirilir ve bölüm sonunda okunur.",
  })
  @ApiSuccessResponse({ model: MnemonicResDto, description: "Hafıza kancası" })
  @ApiErrorResponses(400, 401, 404, 500)
  updateMnemonic(
    @Param() params: MnemonicIdParamDto,
    @Body() body: UpdateMnemonicBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.studyGeneration.updateMnemonic(params.id, body, user.id);
  }
}
