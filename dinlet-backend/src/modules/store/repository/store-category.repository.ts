import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

export interface StoreCategoryInput {
  parentId?: number | null;
  slug?: string;
  name?: string;
  position?: number;
}

/** Mağaza kataloğu: sınav → ders. */
@Injectable()
export class StoreCategoryRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  listAll() {
    return this.db.orm.public.StoreCategory.select(
      "id",
      "parentId",
      "slug",
      "name",
      "position",
    )
      .orderBy([
        (category) => category.position.asc(),
        (category) => category.id.asc(),
      ])
      .all();
  }

  findById(id: number) {
    return this.db.orm.public.StoreCategory.where({ id })
      .select("id", "parentId", "slug", "name", "position")
      .first();
  }

  findBySlug(slug: string) {
    return this.db.orm.public.StoreCategory.where({ slug })
      .select("id")
      .first();
  }

  /** Kategorinin kendisi ve alt kategorileri (sınav seçilince dersleri de). */
  async findWithChildrenIds(id: number): Promise<number[]> {
    const children = await this.db.orm.public.StoreCategory.where({
      parentId: id,
    })
      .select("id")
      .all();
    return [id, ...children.map((child) => child.id)];
  }

  /** Verilen ID'lerden var olanlar. */
  async findExistingIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.orm.public.StoreCategory.where((category) =>
      category.id.in(ids),
    )
      .select("id")
      .all();
    return rows.map((row) => row.id);
  }

  create(
    input: Required<Omit<StoreCategoryInput, "parentId">> & {
      parentId: number | null;
    },
  ) {
    return this.db.orm.public.StoreCategory.select(
      "id",
      "parentId",
      "slug",
      "name",
      "position",
    ).create(input);
  }

  async update(id: number, patch: StoreCategoryInput): Promise<void> {
    await this.db.orm.public.StoreCategory.where({ id }).updateAndCount(patch);
  }

  /** Alt kategorisi, içeriği veya paketi olan kategori silinmez. */
  async isInUse(id: number): Promise<boolean> {
    const [child, item, bundle] = await Promise.all([
      this.db.orm.public.StoreCategory.where({ parentId: id })
        .select("id")
        .first(),
      this.db.orm.public.StoreItemCategory.where({ categoryId: id })
        .select("id")
        .first(),
      this.db.orm.public.StoreBundle.where({ categoryId: id })
        .select("id")
        .first(),
    ]);
    return Boolean(child || item || bundle);
  }

  async delete(id: number): Promise<boolean> {
    return (
      (await this.db.orm.public.StoreCategory.where({ id }).deleteAndCount()) >
      0
    );
  }
}
