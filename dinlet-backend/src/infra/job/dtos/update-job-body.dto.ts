import { ApiHideProperty, OmitType, PartialType } from "@nestjs/swagger";
import { IsDefined, ValidateIf } from "class-validator";

import { CreateJobBodyDto } from "#/infra/job/dtos/create-job-body.dto.js";

export class UpdateJobBodyDto extends PartialType(
  OmitType(CreateJobBodyDto, ["code"] as const),
) {
  @ApiHideProperty()
  @ValidateIf((value: UpdateJobBodyDto) =>
    [
      value.name,
      value.description,
      value.category,
      value.cronPattern,
      value.isActive,
      value.retryLimit,
      value.params,
    ].every((field) => field === undefined),
  )
  @IsDefined({ message: "En az bir alan gönderilmelidir" })
  private readonly atLeastOneField?: never;
}
