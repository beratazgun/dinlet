import {
  Body,
  Controller,
  Delete,
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
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  CreateFolderBodyDto,
  FolderIdParamDto,
  FolderResDto,
  UpdateFolderBodyDto,
} from "#/modules/study/dtos/index.js";
import { FolderService } from "#/modules/study/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Study")
@ApiBearerAuth()
@Controller("folders")
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  @Serialize(FolderResDto)
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Klasör oluştur",
    description: "Aynı adda klasör varsa 409 (`FOLDER_NAME_TAKEN`).",
  })
  @ApiSuccessResponse({
    model: FolderResDto,
    status: 201,
    description: "Klasör oluşturuldu",
  })
  @ApiErrorResponses(400, 401, 409, 422, 429, 500)
  createFolder(@Body() body: CreateFolderBodyDto, @CurrentUser() user: SessionUser) {
    return this.folderService.create(body, user.id);
  }

  @Patch(":id")
  @Serialize(FolderResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Klasörü yeniden adlandır veya rengini değiştir" })
  @ApiSuccessResponse({
    model: FolderResDto,
    description: "Klasör güncellendi",
  })
  @ApiErrorResponses(400, 401, 404, 409, 500)
  updateFolder(
    @Param() params: FolderIdParamDto,
    @Body() body: UpdateFolderBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.folderService.update(params.id, body, user.id);
  }

  @Delete(":id")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Klasörü sil",
    description: "İçindeki notlar silinmez, klasörsüz kalır.",
  })
  @ApiSuccessResponse({ status: 204, description: "Klasör silindi" })
  @ApiErrorResponses(401, 404, 500)
  removeFolder(@Param() params: FolderIdParamDto, @CurrentUser() user: SessionUser) {
    return this.folderService.remove(params.id, user.id);
  }
}
