import { PickType } from "@nestjs/swagger";
import { FilterDto } from "#/core/dtos/request/index.js";

export class SessionListQueryDto extends PickType(FilterDto, [
  "page",
  "limit",
] as const) {}
