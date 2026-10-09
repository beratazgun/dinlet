import { ApiPropertyOptional, IntersectionType, OmitType } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  ToInt,
  ToUpperCase,
  Trim,
} from "#/core/decorators/index.js";
import { CursorQueryDto, FilterDto } from "#/core/dtos/request/index.js";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Denetim kaydı listesi sorgusu. `dateFrom`/`dateTo` (gün bazında, dahil) ve
 * `order` `FilterDto`'dan; `cursor` + `limit` `CursorQueryDto`'dan gelir
 * (keyset sayfalama — `page` yoktur).
 */
export class AuditLogListQueryDto extends IntersectionType(
  OmitType(FilterDto, ["page", "limit"] as const),
  CursorQueryDto,
) {
  @ApiPropertyOptional({ type: Number, minimum: 1, example: 1 })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Kullanıcı ID tam sayı olmalıdır" })
  @Min(1, { message: "Kullanıcı ID en az 1 olmalıdır" })
  userId?: number;

  @ApiPropertyOptional({ type: String, enum: HTTP_METHODS })
  @ToUpperCase()
  @IsOptional()
  @IsIn(HTTP_METHODS, { message: "Geçersiz HTTP metodu" })
  method?: string;

  @ApiPropertyOptional({ type: Number, minimum: 100, maximum: 599, example: 401 })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Durum kodu tam sayı olmalıdır" })
  @Min(100, { message: "Durum kodu en az 100 olmalıdır" })
  @Max(599, { message: "Durum kodu en fazla 599 olabilir" })
  statusCode?: number;

  @ApiPropertyOptional({
    type: String,
    maxLength: 200,
    example: "/auth/login",
    description: "URL içinde geçen metin (büyük/küçük harf duyarsız)",
  })
  @Trim()
  @IsOptional()
  @IsString({ message: "Yol metin olmalıdır" })
  @MaxLength(200, { message: "Yol en fazla 200 karakter olabilir" })
  path?: string;

  @ApiPropertyOptional({ type: String, maxLength: 128 })
  @Trim()
  @IsOptional()
  @IsString({ message: "İstek ID metin olmalıdır" })
  @MaxLength(128, { message: "İstek ID en fazla 128 karakter olabilir" })
  requestId?: string;
}
