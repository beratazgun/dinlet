import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";

/** Kullanıcının sınav hedefi (kullanıcı başına bir tane). */
@Injectable()
export class StudyGoalRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  findByUser(userId: number) {
    return this.db.orm.public.StudyGoal.where({ userId })
      .select("examName", "examDate", "updatedAt")
      .first();
  }

  async upsert(userId: number, input: { examName: string; examDate: string }) {
    await this.db.orm.public.StudyGoal.upsert({
      create: { userId, ...input },
      update: input,
      conflictOn: { userId },
    });
  }

  async delete(userId: number): Promise<boolean> {
    return (
      (await this.db.orm.public.StudyGoal.where({ userId }).deleteAndCount()) >
      0
    );
  }
}
