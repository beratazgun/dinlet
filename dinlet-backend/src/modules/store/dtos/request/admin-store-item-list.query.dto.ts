import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

import { ToBoolean } from "#/core/decorators/index.js";

import { StoreItemListQueryDto } from "./store-item-list.query.dto.js";

/** Yönetim listesi: yayında olmayanlar dahil. */
export class AdminStoreItemListQueryDto extends OmitType(
  StoreItemListQueryDto,
  ["owned"] as const,
) {
  @ApiPropertyOptional({ type: Boolean, description: "Yayın durumu" })
  @ToBoolean()
  @IsOptional()
  @IsBoolean({ message: "Yayın filtresi true/false olmalıdır" })
  published?: boolean;
}
