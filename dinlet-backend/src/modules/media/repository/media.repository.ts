import { Injectable } from "@nestjs/common";

import type { PageWindow } from "#/core/utils/paginator.js";
import type { Media, NewMedia } from "#/modules/media/types/index.js";
import { DatabaseService } from "#database/database.service.js";

const MEDIA_FIELDS = [
  "id",
  "storageKey",
  "fileName",
  "mimeType",
  "size",
  "uploaderId",
  "createdAt",
] as const;

/** Medya kayıtları. Sahiplik `uploaderId` ile belirlenir. */
@Injectable()
export class MediaRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  create(input: NewMedia): Promise<Media> {
    return this.db.orm.public.Media.select(...MEDIA_FIELDS).create(input);
  }

  findOwnedById(id: number, uploaderId: number): Promise<Media | null> {
    return this.db.orm.public.Media.where({ id })
      .where({ uploaderId })
      .select(...MEDIA_FIELDS)
      .first();
  }

  async countByUploader(uploaderId: number): Promise<number> {
    const { total } = await this.db.orm.public.Media.where({
      uploaderId,
    }).aggregate((aggregate) => ({ total: aggregate.count() }));
    return total;
  }

  async findPageByUploader(
    uploaderId: number,
    window: PageWindow,
  ): Promise<Media[]> {
    return await this.db.orm.public.Media.where({ uploaderId })
      .select(...MEDIA_FIELDS)
      .orderBy([(media) => media.createdAt.desc(), (media) => media.id.desc()])
      .offset(window.offset)
      .limit(window.limit)
      .all();
  }

  /** Kullanıcının kendi medyasını siler; kayıt yoksa `false` döner. */
  async deleteOwned(id: number, uploaderId: number): Promise<boolean> {
    const deleted = await this.db.orm.public.Media.where({ id })
      .where({ uploaderId })
      .deleteAndCount();
    return deleted > 0;
  }
}
