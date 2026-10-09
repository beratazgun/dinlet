import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  Public,
  Serialize,
} from "#/core/decorators/index.js";
import {
  LegalDocumentParamDto,
  LegalDocumentResDto,
} from "#/modules/auth/dtos/index.js";
import { LegalService } from "#/modules/auth/services/index.js";

@ApiTags("Legal")
@Controller("legal")
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get(":document")
  @Public()
  @Serialize(LegalDocumentResDto)
  @ApiOperation({
    summary: "KVKK / kullanım metni",
    description:
      "Aydınlatma Metni, Kullanım Koşulları veya yurt dışına aktarım açık rıza metni. `version`, onay kaydına yazılan sürümdür.",
  })
  @ApiSuccessResponse({ model: LegalDocumentResDto, description: "Metin" })
  @ApiErrorResponses(422, 500)
  getDocument(@Param() params: LegalDocumentParamDto) {
    return this.legalService.getDocument(params.document);
  }
}
