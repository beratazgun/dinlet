import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import { MAX_PAGE_LIMIT } from "#/core/utils/paginator.js";

import { ToDate, ToInt } from "#/core/decorators/query-transform.decorator.js";

export type SortOrder = "asc" | "desc";

export class FilterDto {
  /**
   * Sayfa numarası
   * @example 1
   */
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Sayfa numarası tam sayı olmalıdır" })
  @Min(1, { message: "Sayfa numarası en az 1 olmalıdır" })
  page?: number = 1;

  /**
   * Sayfa başına kayıt sayısı
   * @example 20
   */
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: MAX_PAGE_LIMIT })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Limit tam sayı olmalıdır" })
  @Min(1, { message: "Limit en az 1 olmalıdır" })
  @Max(MAX_PAGE_LIMIT, {
    message: `Limit en fazla ${MAX_PAGE_LIMIT} olabilir`,
  })
  limit?: number = 20;

  /**
   * Başlangıç tarihi ([year]-[month]-[day])
   * @example 2024-01-01
   */
  @ApiPropertyOptional({ type: String, format: "date", example: "2024-01-01" })
  @ToDate()
  @IsOptional()
  @IsDate({ message: "Geçerli bir başlangıç tarihi giriniz" })
  dateFrom?: Date;

  /**
   * Bitiş tarihi ([year]-[month]-[day])
   * @example 2024-01-01
   */
  @ApiPropertyOptional({ type: String, format: "date", example: "2024-01-01" })
  @ToDate()
  @IsOptional()
  @IsDate({ message: "Geçerli bir bitiş tarihi giriniz" })
  dateTo?: Date;

  /** Sıralama yönü */
  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sıralama yönü asc veya desc olmalıdır" })
  order?: SortOrder;
}
