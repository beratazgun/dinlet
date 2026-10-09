import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

/** Kullanıcının etiketleri ve not–etiket bağları. */
@Injectable()
export class TagRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  listByUser(userId: number) {
    return this.db.orm.public.Tag.where({ userId })
      .select("id", "name")
      .orderBy([(tag) => tag.name.asc()])
      .all();
  }

  findOwned(id: number, userId: number) {
    return this.db.orm.public.Tag.where({ id, userId })
      .select("id", "name")
      .first();
  }

  findByName(userId: number, name: string) {
    return this.db.orm.public.Tag.where({ userId, name }).select("id").first();
  }

  async countByUser(userId: number): Promise<number> {
    const { total } = await this.db.orm.public.Tag.where({
      userId,
    }).aggregate((aggregate) => ({ total: aggregate.count() }));
    return total;
  }

  /** Verilen ID'lerden kullanıcıya ait olanlar. */
  async findOwnedIds(userId: number, ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.orm.public.Tag.where({ userId })
      .where((tag) => tag.id.in(ids))
      .select("id")
      .all();
    return rows.map((row) => row.id);
  }

  create(input: { userId: number; name: string }) {
    return this.db.orm.public.Tag.select("id", "name").create(input);
  }

  async rename(id: number, userId: number, name: string): Promise<void> {
    await this.db.orm.public.Tag.where({ id, userId }).updateAndCount({ name });
  }

  async delete(id: number, userId: number): Promise<boolean> {
    return (
      (await this.db.orm.public.Tag.where({ id, userId }).deleteAndCount()) > 0
    );
  }

  /** Notun etiketlerini verilen listeyle değiştirir. */
  setForDocument(documentId: number, tagIds: number[]): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.DocumentTag.where({ documentId }).deleteAndCount();
      if (tagIds.length > 0) {
        await tx.orm.public.DocumentTag.createAll(
          tagIds.map((tagId) => ({ documentId, tagId })),
        );
      }
    });
  }

  /** Etiketli notların ID'leri (kütüphane filtresi). */
  async findDocumentIds(tagId: number): Promise<number[]> {
    const links = await this.db.orm.public.DocumentTag.where({ tagId })
      .select("documentId")
      .all();
    return links.map((link) => link.documentId);
  }

  /** Notların etiketleri (liste ve detay görünümü için tek sorgu). */
  async findForDocuments(
    documentIds: number[],
  ): Promise<Map<number, { id: number; name: string }[]>> {
    const byDocument = new Map<number, { id: number; name: string }[]>();
    if (documentIds.length === 0) return byDocument;
    const links = await this.db.orm.public.DocumentTag.where((link) =>
      link.documentId.in(documentIds),
    )
      .select("documentId", "tagId")
      .all();
    if (links.length === 0) return byDocument;

    const tags = await this.db.orm.public.Tag.where((tag) =>
      tag.id.in([...new Set(links.map((link) => link.tagId))]),
    )
      .select("id", "name")
      .all();
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    for (const link of links) {
      const tag = tagById.get(link.tagId);
      if (!tag) continue;
      const list = byDocument.get(link.documentId) ?? [];
      list.push(tag);
      byDocument.set(link.documentId, list);
    }
    return byDocument;
  }

  /** Etiket başına silinmemiş not sayısı. */
  async countDocumentsByTag(tagIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (tagIds.length === 0) return counts;
    const links = await this.db.orm.public.DocumentTag.where((link) =>
      link.tagId.in(tagIds),
    )
      .select("tagId", "documentId")
      .all();
    if (links.length === 0) return counts;
    const alive = await this.db.orm.public.Document.where((document) =>
      document.id.in([...new Set(links.map((link) => link.documentId))]),
    )
      .where((document) => document.deletedAt.isNull())
      .select("id")
      .all();
    const aliveIds = new Set(alive.map((document) => document.id));
    for (const link of links) {
      if (!aliveIds.has(link.documentId)) continue;
      counts.set(link.tagId, (counts.get(link.tagId) ?? 0) + 1);
    }
    return counts;
  }
}
