import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

@Injectable()
export class UtilsRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Media var mı kontrol et */
  findMediaById(mediaId: number) {
    return this.db.orm.public.Media.where({ id: mediaId }).first();
  }
}
