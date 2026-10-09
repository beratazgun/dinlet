import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { CollectionsResDto } from "#/modules/study/dtos/index.js";
import { CollectionsService } from "#/modules/study/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Study")
@ApiBearerAuth()
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @Serialize(CollectionsResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Klasörlerim, etiketlerim ve sınav hedefim",
    description:
      "Klasörler ve hedef, içlerindeki notların dinleme ilerlemesiyle; favori, son 7 gün ve klasörsüz not sayıları.",
  })
  @ApiSuccessResponse({ model: CollectionsResDto, description: "Klasörler" })
  @ApiErrorResponses(401, 500)
  getCollections(@CurrentUser() user: SessionUser) {
    return this.collectionsService.get(user.id);
  }
}
