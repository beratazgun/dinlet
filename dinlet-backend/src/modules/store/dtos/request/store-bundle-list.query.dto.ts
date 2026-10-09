import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

import { ToInt } from "#/core/decorators/index.js";
import { PageQueryDto } from "#/core/dtos/request/index.js";

export class StoreBundleListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    type: Number,
    description: "Sınav (alt dersleri dahil) veya ders",
  })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Kategori ID tam sayı olmalıdır" })
  @Min(1, { message: "Kategori ID en az 1 olmalıdır" })
  categoryId?: number;
}
