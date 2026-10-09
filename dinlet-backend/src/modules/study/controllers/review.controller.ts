import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import {
  ReviewResultResDto,
  ReviewSectionIdParamDto,
  ReviewSessionResDto,
  ReviewSummaryResDto,
  SubmitReviewBodyDto,
} from "#/modules/study/dtos/index.js";
import { ReviewService } from "#/modules/study/services/index.js";
import type { SessionUser } from "#/types/index.js";

@ApiTags("Review")
@ApiBearerAuth()
@Controller("me/review")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @Serialize(ReviewSummaryResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Bugünkü tekrar",
    description:
      "Haftalık şerit, seri, bugün tekrar edilecek bölüm sayısı ve süresi; bugünküler ile sıradaki tekrarlar.",
  })
  @ApiSuccessResponse({
    model: ReviewSummaryResDto,
    description: "Tekrar özeti",
  })
  @ApiErrorResponses(401, 500)
  getReviewSummary(@CurrentUser() user: SessionUser) {
    return this.reviewService.summary(user.id);
  }

  @Get("session")
  @Serialize(ReviewSessionResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Tekrar oturumu",
    description:
      "Bugün tekrar edilecek bölümler: özet sesi ve soru/cevap sesleri.",
  })
  @ApiSuccessResponse({
    model: ReviewSessionResDto,
    description: "Tekrar oturumu",
  })
  @ApiErrorResponses(401, 500)
  getReviewSession(@CurrentUser() user: SessionUser) {
    return this.reviewService.session(user.id);
  }

  @Post("sections/:sectionId")
  @Serialize(ReviewResultResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Bölümün tekrar sonucunu gönder",
    description:
      'Hepsi "Bildim" ise bölüm bir sonraki aşamaya (3, 7, 21. gün) geçer; biri "Bilemedim" ise yarın tekrar gelir.',
  })
  @ApiSuccessResponse({
    model: ReviewResultResDto,
    description: "Yeni tekrar günü",
  })
  @ApiErrorResponses(400, 401, 404, 500)
  submitReview(
    @Param() params: ReviewSectionIdParamDto,
    @Body() body: SubmitReviewBodyDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.reviewService.submit(user.id, params.sectionId, body);
  }
}
