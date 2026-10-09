import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

/** Sayfa kotası defteri: pozitif kayıt düşüm, negatif kayıt iadedir. */
@Injectable()
export class UsageLedgerRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Dönemde net harcanan sayfa (iadeler düşülmüş). */
  async sumPages(userId: number, periodKey: string): Promise<number> {
    const { total } = await this.db.orm.public.UsageLedger.where({
      userId,
      periodKey,
    }).aggregate((aggregate) => ({ total: aggregate.sum("pages") }));
    return total ?? 0;
  }

  /** Belge için net düşülmüş sayfa (iade edildiyse 0). */
  async sumPagesForDocument(documentId: number): Promise<number> {
    const { total } = await this.db.orm.public.UsageLedger.where({
      documentId,
    }).aggregate((aggregate) => ({ total: aggregate.sum("pages") }));
    return total ?? 0;
  }

  async create(entry: {
    userId: number;
    documentId: number;
    pages: number;
    periodKey: string;
  }): Promise<void> {
    await this.db.orm.public.UsageLedger.create(entry);
  }
}
