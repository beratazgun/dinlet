import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

const MNEMONIC_FIELDS = [
  "id",
  "documentId",
  "sectionId",
  "position",
  "topic",
  "hook",
  "explanation",
  "kept",
  "audioKey",
  "durationMs",
] as const;

export interface NewMnemonic {
  sectionId: number | null;
  topic: string;
  hook: string;
  explanation: string;
}

/** Hafıza kancası önerileri ve saklananlar. */
@Injectable()
export class MnemonicRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  /** Kaldırılmamış öneriler, sırasıyla. */
  listVisible(documentId: number) {
    return this.db.orm.public.Mnemonic.where({ documentId, dismissed: false })
      .select(...MNEMONIC_FIELDS)
      .orderBy([
        (mnemonic) => mnemonic.position.asc(),
        (mnemonic) => mnemonic.id.asc(),
      ])
      .all();
  }

  /** Bölüm sonunda okunacak, sesi hazır saklanmış kancalar. */
  listKeptForSection(sectionId: number) {
    return this.db.orm.public.Mnemonic.where({
      sectionId,
      kept: true,
      dismissed: false,
    })
      .where((mnemonic) => mnemonic.audioKey.isNotNull())
      .select(...MNEMONIC_FIELDS)
      .orderBy([(mnemonic) => mnemonic.position.asc()])
      .all();
  }

  /** Kullanıcının notuna ait kanca (sahiplik belge üzerinden). */
  async findOwned(id: number, userId: number) {
    const mnemonic = await this.db.orm.public.Mnemonic.where({ id })
      .select(...MNEMONIC_FIELDS)
      .first();
    if (!mnemonic) return null;
    const document = await this.db.orm.public.Document.where({
      id: mnemonic.documentId,
      userId,
    })
      .where((row) => row.deletedAt.isNull())
      .select("id", "userId", "storagePrefix")
      .first();
    return document ? { ...mnemonic, document } : null;
  }

  findById(id: number) {
    return this.db.orm.public.Mnemonic.where({ id })
      .select(...MNEMONIC_FIELDS)
      .first();
  }

  /**
   * Yeni öneriler: saklanmamış eski öneriler silinir, saklananlar kalır;
   * yeniler onların ardına eklenir.
   */
  replaceSuggestions(
    documentId: number,
    suggestions: NewMnemonic[],
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.Mnemonic.where({
        documentId,
        kept: false,
      }).deleteAndCount();
      const kept = await tx.orm.public.Mnemonic.where({ documentId })
        .select("position")
        .all();
      const start = kept.reduce(
        (max, row) => Math.max(max, row.position + 1),
        0,
      );
      if (suggestions.length > 0) {
        await tx.orm.public.Mnemonic.createAll(
          suggestions.map((suggestion, index) => ({
            documentId,
            position: start + index,
            ...suggestion,
          })),
        );
      }
    });
  }

  async update(
    id: number,
    patch: {
      kept?: boolean;
      dismissed?: boolean;
      audioKey?: string | null;
      durationMs?: number | null;
    },
  ): Promise<void> {
    await this.db.orm.public.Mnemonic.where({ id }).updateAndCount(patch);
  }
}
