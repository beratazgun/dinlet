import { ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { Trim } from "#/core/decorators/query-transform.decorator.js";
import { FilterDto } from "#/core/dtos/request/filter.dto.js";

/**
 * İmleçli (keyset) liste sorgusu: `cursor` + `limit`. Sayfa numarası yoktur;
 * sonraki sayfa için önceki yanıttaki `meta.pagination.nextCursor` gönderilir.
 */
export class CursorQueryDto extends PickType(FilterDto, ["limit"] as const) {
  /**
   * Önceki yanıttaki `nextCursor` (opak). Boşsa ilk sayfa döner.
   * @example WyIyMDI2LTEwLTA0IDEyOjAwOjAwLjEyMzQ1NiswMCIsNDJd
   */
  @ApiPropertyOptional({ type: String, maxLength: 256 })
  @Trim()
  @IsOptional()
  @IsString({ message: "Sayfa imleci metin olmalıdır" })
  @MaxLength(256, { message: "Sayfa imleci en fazla 256 karakter olabilir" })
  cursor?: string;
}
