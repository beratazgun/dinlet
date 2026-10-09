import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  Public,
  Serialize,
} from "#/core/decorators/index.js";
import { UtilsService } from "#/modules/utils/utils.service.js";
import { EnumOptionResDto } from "#/modules/utils/dtos/response/index.js";
import { GetEnumOptionsQueryDto, SendTestEmailBodyDto } from "#/modules/utils/dtos/request/index.js";

@ApiTags("utils")
@Controller("utils")
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Get("enums")
  @Serialize(EnumOptionResDto)
  @Public()
  @ApiOperation({
    summary: "Enum değerlerini select option formatında getirir",
  })
  @ApiSuccessResponse({
    model: EnumOptionResDto,
    status: 200,
    isArray: true,
    description: "Enum seçenekleri listelendi",
  })
  @ApiErrorResponses(400, 500)
  getEnumOptions(@Query() query: GetEnumOptionsQueryDto) {
    return this.utilsService.getEnumOptions(query);
  }

  @Post("test-email")
  @Public()
  @ApiOperation({
    summary: "E-posta şablonunu test et (kuyruğa ekler)",
    description:
      "İstenen şablon kodunu örnek veya özel değişkenlerle hedef e-posta adresine kuyruk üzerinden gönderir.",
  })
  @ApiSuccessResponse({
    status: 200,
    description: "Test e-postası kuyruğa eklendi",
  })
  @ApiErrorResponses(400, 500)
  sendTestEmail(@Body() body: SendTestEmailBodyDto) {
    return this.utilsService.sendTestEmail(body);
  }
}
