import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { EmptyResDto } from "#/core/dtos/response/index.js";
import { DocumentIdParamDto } from "#/modules/document/dtos/index.js";
import {
  DocumentTagResDto,
  SetDocumentTagsBodyDto,
  TagIdParamDto,
  TagNameBodyDto,
  TagResDto,
} from "#/modules/study/dtos/index.js";
import { TagService } from "#/modules/study/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Study")
@ApiBearerAuth()
@Controller()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post("tags")
  @Serialize(TagResDto)
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Etiket oluştur",
    description: "Aynı adda etiket varsa 409 (`TAG_NAME_TAKEN`).",
  })
  @ApiSuccessResponse({
    model: TagResDto,
    status: 201,
    description: "Etiket oluşturuldu",
  })
  @ApiErrorResponses(400, 401, 409, 422, 429, 500)
  createTag(@Body() body: TagNameBodyDto, @CurrentUser() user: SessionUser) {
    return this.tagService.create(body, user.id);
  }

  @Patch("tags/:id")
  @Serialize(TagResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Etiketi yeniden adlandır" })
  @ApiSuccessResponse({ model: TagResDto, description: "Etiket güncellendi" })
  @ApiErrorResponses(400, 401, 404, 409, 500)
  renameTag(
    @Param() params: TagIdParamDto,
    @Body() body: TagNameBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tagService.rename(params.id, body, user.id);
  }

  @Delete("tags/:id")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Etiketi sil",
    description: "Notlardan kaldırılır, notlar silinmez.",
  })
  @ApiSuccessResponse({ status: 204, description: "Etiket silindi" })
  @ApiErrorResponses(401, 404, 500)
  removeTag(@Param() params: TagIdParamDto, @CurrentUser() user: SessionUser) {
    return this.tagService.remove(params.id, user.id);
  }

  @Put("documents/:id/tags")
  @Serialize(DocumentTagResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Notun etiketlerini ayarla",
    description: "Verilen liste mevcut etiketlerin yerine geçer.",
  })
  @ApiSuccessResponse({
    model: DocumentTagResDto,
    isArray: true,
    description: "Notun etiketleri",
  })
  @ApiErrorResponses(400, 401, 404, 500)
  setDocumentTags(
    @Param() params: DocumentIdParamDto,
    @Body() body: SetDocumentTagsBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tagService.setForDocument(params.id, body, user.id);
  }
}
