import { Injectable, Logger } from "@nestjs/common";

import type { TrackedModelName } from "#/core/decorators/index.js";
import { DatabaseService } from "#database/database.service.js";

type SnapshotAccessor = {
  where: (filter: Record<string, unknown>) => {
    first: () => Promise<unknown>;
  };
};

/**
 * `@TrackChanges` için güncelleme öncesi kaydın anlık durumunu (before-state)
 * okur. Model adı dinamik olduğu için ORM yüzeyine indeksle erişilir.
 */
@Injectable()
export class EntitySnapshotRepository {
  private readonly logger = new Logger(EntitySnapshotRepository.name);

  constructor(private readonly database: DatabaseService) {}

  async findSnapshot(
    model: TrackedModelName,
    key: string,
    value: unknown,
  ): Promise<Record<string, unknown> | null> {
    if (value === undefined || value === null || value === "") return null;

    try {
      const orm = this.database.client.orm.public as unknown as Record<
        string,
        SnapshotAccessor | undefined
      >;
      const accessor = orm[model];
      if (!accessor || typeof accessor.where !== "function") {
        this.logger.warn(`Model '${model}' için Prisma ORM tablosu bulunamadı.`);
        return null;
      }

      const row = await accessor
        .where({ [key]: this.parseLookupValue(value) })
        .first();
      return (row as Record<string, unknown> | null) ?? null;
    } catch (error) {
      this.logger.warn(
        `'${model}' modeli için snapshot çekilemedi (${key}=${String(value)}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Route parametreleri metin gelir; sayısal kimlikleri sayıya çevirir. */
  private parseLookupValue(value: unknown): unknown {
    if (typeof value === "string" && /^\d+$/.test(value)) {
      const num = Number(value);
      if (Number.isSafeInteger(num)) return num;
    }
    return value;
  }
}
