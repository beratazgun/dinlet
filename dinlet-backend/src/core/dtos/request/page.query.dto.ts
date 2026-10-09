import { PickType } from "@nestjs/swagger";

import { FilterDto } from "#/core/dtos/request/filter.dto.js";

/** Yalnızca `page` + `limit` kabul eden liste sorgusu. */
export class PageQueryDto extends PickType(FilterDto, [
  "page",
  "limit",
] as const) {}
