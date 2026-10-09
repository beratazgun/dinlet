import { Injectable } from "@nestjs/common";
import type { JsonValue } from "@prisma/orm-postgres/target/codec-types";

import type { PageWindow } from "#/core/utils/paginator.js";
import { DatabaseService } from "#database/database.service.js";
import {
  SubmissionStatus,
  type SubmissionStatus as SubmissionStatusValue,
} from "#database/enums.js";

const SUBMISSION_FIELDS = [
  "id",
  "userId",
  "documentId",
  "title",
  "description",
  "categoryIds",
  "status",
  "rightsConfirmedAt",
  "rejectionReason",
  "reviewedBy",
  "reviewedAt",
  "storeItemId",
  "createdAt",
  "updatedAt",
] as const;

export interface StoreSubmissionFilter {
  userId?: number;
  documentId?: number;
  status?: SubmissionStatusValue;
}

export interface StoreSubmissionPatch {
  status?: SubmissionStatusValue;
  rejectionReason?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  storeItemId?: number | null;
}

/** "Mağazada paylaş" başvuruları. */
@Injectable()
export class StoreSubmissionRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  private filtered(filter: StoreSubmissionFilter) {
    let query = this.db.orm.public.StoreSubmission.where((row) => row.id.gt(0));
    if (filter.userId !== undefined)
      query = query.where({ userId: filter.userId });
    if (filter.documentId !== undefined) {
      query = query.where({ documentId: filter.documentId });
    }
    if (filter.status !== undefined)
      query = query.where({ status: filter.status });
    return query;
  }

  async count(filter: StoreSubmissionFilter): Promise<number> {
    const { total } = await this.filtered(filter).aggregate((aggregate) => ({
      total: aggregate.count(),
    }));
    return total;
  }

  async findPage(
    filter: StoreSubmissionFilter,
    window: PageWindow,
    oldestFirst = false,
  ) {
    const rows = await this.filtered(filter)
      .select(...SUBMISSION_FIELDS)
      .orderBy(
        oldestFirst
          ? [(row) => row.createdAt.asc(), (row) => row.id.asc()]
          : [(row) => row.createdAt.desc(), (row) => row.id.desc()],
      )
      .limit(window.limit)
      .offset(window.offset)
      .all();
    return rows.map(withCategoryIds);
  }

  async findById(id: number) {
    const row = await this.db.orm.public.StoreSubmission.where({ id })
      .select(...SUBMISSION_FIELDS)
      .first();
    return row ? withCategoryIds(row) : null;
  }

  /** Notun incelemede veya yayında olan başvurusu (aynı not ikinci kez paylaşılmaz). */
  findActiveForDocument(documentId: number) {
    return this.db.orm.public.StoreSubmission.where({ documentId })
      .where((row) =>
        row.status.in([SubmissionStatus.PENDING, SubmissionStatus.APPROVED]),
      )
      .select("id", "status")
      .first();
  }

  async countPending(userId: number): Promise<number> {
    return this.count({ userId, status: SubmissionStatus.PENDING });
  }

  async create(input: {
    userId: number;
    documentId: number;
    title: string;
    description: string;
    categoryIds: number[];
    rightsConfirmedAt: string;
  }) {
    const row = await this.db.orm.public.StoreSubmission.select(
      ...SUBMISSION_FIELDS,
    ).create({ ...input, categoryIds: input.categoryIds as JsonValue });
    return withCategoryIds(row);
  }

  /**
   * Durumu yalnızca beklenen durumdaysa değiştirir (iki editör aynı anda
   * karar verirse biri kazanır). Değiştiyse `true`.
   */
  async transition(
    id: number,
    from: SubmissionStatusValue,
    patch: StoreSubmissionPatch,
  ): Promise<boolean> {
    const updated = await this.db.orm.public.StoreSubmission.where({ id })
      .where((row) => row.status.eq(from))
      .updateAndCount(patch);
    return updated > 0;
  }

  /** Liste için başvuranların adı ve e-postası. */
  async findUsers(userIds: number[]) {
    if (userIds.length === 0) return new Map<number, UserSummary>();
    const users = await this.db.orm.public.User.where((user) =>
      user.id.in(userIds),
    )
      .select("id", "name", "surname", "email")
      .all();
    return new Map(users.map((user) => [user.id, user]));
  }
}

type UserSummary = {
  id: number;
  name: string | null;
  surname: string | null;
  email: string;
};

function withCategoryIds<T extends { categoryIds: unknown }>(row: T) {
  return {
    ...row,
    categoryIds: Array.isArray(row.categoryIds)
      ? (row.categoryIds as number[])
      : [],
  };
}
