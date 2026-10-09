import { Controller, Get, HttpCode, HttpStatus, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { PageQueryDto } from "#/core/dtos/request/index.js";
import { ContinueItemResDto } from "#/modules/document/dtos/index.js";
import { PlaybackService } from "#/modules/document/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Sections")
@ApiBearerAuth()
@Controller("me/continue")
export class ContinueController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Get()
  @Serialize(ContinueItemResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Kaldığın yerden devam et",
    description: "Yarım kalan bölümler, en son dinlenen önce.",
  })
  @ApiSuccessResponse({
    model: ContinueItemResDto,
    isArray: true,
    pagination: "offset",
    description: "Devam edilecek bölümler",
  })
  @ApiErrorResponses(400, 401, 500)
  list(@Query() query: PageQueryDto, @CurrentUser() user: SessionUser) {
    return this.playbackService.listContinue(query, user.id);
  }
}
