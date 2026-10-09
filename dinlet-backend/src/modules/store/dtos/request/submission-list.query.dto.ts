import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";

import { ToInt, ToUpperCase, Trim } from "#/core/decorators/index.js";
import { PageQueryDto } from "#/core/dtos/request/index.js";
import { SubmissionStatus } from "#database/enums.js";

const SUBMISSION_STATUSES = Object.values(SubmissionStatus);

export class SubmissionListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ type: Number, description: "Bu notun başvuruları" })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Not ID tam sayı olmalıdır" })
  @Min(1, { message: "Not ID en az 1 olmalıdır" })
  documentId?: number;
}

/** Editör kuyruğu: varsayılan incelemedekiler, en eski önce. */
export class AdminSubmissionListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: SUBMISSION_STATUSES,
    default: "PENDING",
  })
  @Trim()
  @ToUpperCase()
  @IsOptional()
  @IsIn(SUBMISSION_STATUSES, { message: "Geçersiz başvuru durumu" })
  status?: SubmissionStatus;
}
