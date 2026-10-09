import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import {
  StudyGoalResDto,
  UpsertStudyGoalBodyDto,
} from "#/modules/study/dtos/index.js";
import { StudyGoalService } from "#/modules/study/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Study")
@ApiBearerAuth()
@Controller("me/study-goal")
export class StudyGoalController {
  constructor(private readonly goalService: StudyGoalService) {}

  @Put()
  @Serialize(StudyGoalResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sınav hedefini ayarla",
    description:
      "Sınav adı ve günü. Geçmiş tarih veya 3 yıldan uzak tarih 400.",
  })
  @ApiSuccessResponse({ model: StudyGoalResDto, description: "Sınav hedefi" })
  @ApiErrorResponses(400, 401, 500)
  upsertStudyGoal(
    @Body() body: UpsertStudyGoalBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.goalService.upsert(body, user.id);
  }

  @Delete()
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Sınav hedefini kaldır" })
  @ApiSuccessResponse({ status: 204, description: "Sınav hedefi kaldırıldı" })
  @ApiErrorResponses(401, 500)
  removeStudyGoal(@CurrentUser() user: SessionUser) {
    return this.goalService.remove(user.id);
  }
}
