import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import {
  ToBoolean,
  ToInt,
  ToUpperCase,
  Trim,
} from "#/core/decorators/index.js";
import { CursorQueryDto } from "#/core/dtos/request/index.js";
import { DocumentStatus } from "#database/enums.js";

const DOCUMENT_STATUSES = Object.values(DocumentStatus);

/** Kütüphanedeki filtre sekmeleri ve kapsadıkları durumlar. */
export const DOCUMENT_GROUPS = {
  ready: [DocumentStatus.READY, DocumentStatus.PARTIAL],
  processing: [
    DocumentStatus.QUEUED,
    DocumentStatus.EXTRACTING,
    DocumentStatus.SCRIPTING,
    DocumentStatus.SYNTHESIZING,
  ],
} as const satisfies Record<string, DocumentStatus[]>;

export type DocumentGroup = keyof typeof DOCUMENT_GROUPS;
const DOCUMENT_GROUP_KEYS = Object.keys(DOCUMENT_GROUPS) as DocumentGroup[];

/** Belge listesi: imleçli sayfalama + isteğe bağlı durum filtresi. */
export class DocumentListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ type: String, enum: DOCUMENT_STATUSES })
  @Trim()
  @ToUpperCase()
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES, { message: "Geçersiz belge durumu" })
  status?: DocumentStatus;

  @ApiPropertyOptional({
    type: String,
    enum: DOCUMENT_GROUP_KEYS,
    description:
      "Kütüphane filtresi: `ready` (hazır, kısmen hazır), `processing` (sırada, işleniyor). `status` ile birlikte verilirse `status` geçerlidir.",
  })
  @Trim()
  @IsOptional()
  @IsIn(DOCUMENT_GROUP_KEYS, { message: "Geçersiz filtre" })
  group?: DocumentGroup;

  @ApiPropertyOptional({ type: Number, description: "Klasördeki notlar" })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Klasör ID tam sayı olmalıdır" })
  @Min(1, { message: "Klasör ID en az 1 olmalıdır" })
  folderId?: number;

  @ApiPropertyOptional({ type: Number, description: "Etiketli notlar" })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Etiket ID tam sayı olmalıdır" })
  @Min(1, { message: "Etiket ID en az 1 olmalıdır" })
  tagId?: number;

  @ApiPropertyOptional({ type: Boolean, description: "Yalnızca favoriler (`true`)" })
  @ToBoolean()
  @IsOptional()
  @IsBoolean({ message: "Favori filtresi true/false olmalıdır" })
  favorite?: boolean;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 90,
    description: "Son N günde eklenenler (\"Bu hafta\" için 7)",
  })
  @ToInt()
  @IsOptional()
  @IsInt({ message: "Gün sayısı tam sayı olmalıdır" })
  @Min(1, { message: "Gün sayısı en az 1 olmalıdır" })
  @Max(90, { message: "Gün sayısı en fazla 90 olabilir" })
  addedWithinDays?: number;
}
