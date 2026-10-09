import { SetMetadata } from "@nestjs/common";

import { TRACK_CHANGES_KEY } from "#/core/constants/index.js";
import type { Contract } from "#database/generated/contract.d.js";

/**
 * Prisma contract modellerinin adları.
 * `Contract["roots"]` üzerinden otomatik olarak türetilir.
 */
export type TrackedModelName =
  Contract["roots"][keyof Contract["roots"]]["model"];

export interface TrackChangesOptions {
  /** Takip edilecek Prisma modeli (Job, User, Role vb.) */
  model: TrackedModelName;
  /**
   * Route parametresinin adı (ör. 'id', 'code', 'userId').
   * Belirtilmezse sırasıyla `params.code`, `params.id` otomatik denenir.
   */
  param?: string;
  /** Karşılaştırmaya dahil edilmeyecek alanlar (varsayılan: ['updatedAt']). */
  exclude?: string[];
}

/**
 * Controller metoduna eklenerek, güncelleme öncesi ve sonrasındaki
 * veri farkının (diff) otomatik olarak denetim kaydına (`changes`)
 * yazılmasını sağlar. Servis veya repository katmanına dokunmadan,
 * tamamen deklaratif değişiklik takibi yapar.
 *
 * @example
 * @Patch(":code")
 * @TrackChanges({ model: "Job" })
 * async update(@Param("code") code: string, @Body() body: UpdateJobBodyDto) { ... }
 */
export const TrackChanges = (options: TrackChangesOptions) =>
  SetMetadata(TRACK_CHANGES_KEY, options);
