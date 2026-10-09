import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

const FOLDER_FIELDS = ["id", "name", "color", "position", "createdAt"] as const;

/** Kullanıcının klasörleri. */
@Injectable()
export class FolderRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  listByUser(userId: number) {
    return this.db.orm.public.Folder.where({ userId })
      .select(...FOLDER_FIELDS)
      .orderBy([(folder) => folder.position.asc(), (folder) => folder.id.asc()])
      .all();
  }

  findOwned(id: number, userId: number) {
    return this.db.orm.public.Folder.where({ id, userId })
      .select(...FOLDER_FIELDS)
      .first();
  }

  findByName(userId: number, name: string) {
    return this.db.orm.public.Folder.where({ userId, name })
      .select("id")
      .first();
  }

  async countByUser(userId: number): Promise<number> {
    const { total } = await this.db.orm.public.Folder.where({
      userId,
    }).aggregate((aggregate) => ({ total: aggregate.count() }));
    return total;
  }

  async nextPosition(userId: number): Promise<number> {
    const { last } = await this.db.orm.public.Folder.where({
      userId,
    }).aggregate((aggregate) => ({ last: aggregate.max("position") }));
    return (last ?? -1) + 1;
  }

  create(input: {
    userId: number;
    name: string;
    color: string;
    position: number;
  }) {
    return this.db.orm.public.Folder.select(...FOLDER_FIELDS).create(input);
  }

  async update(
    id: number,
    userId: number,
    patch: { name?: string; color?: string },
  ): Promise<void> {
    await this.db.orm.public.Folder.where({ id, userId }).updateAndCount(patch);
  }

  /** Klasörü siler; içindeki notlar klasörsüz kalır (FK `SET NULL`). */
  async delete(id: number, userId: number): Promise<boolean> {
    return (
      (await this.db.orm.public.Folder.where({ id, userId }).deleteAndCount()) >
      0
    );
  }
}
