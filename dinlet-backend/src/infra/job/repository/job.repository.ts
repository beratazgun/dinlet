import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";
import { asJobCode } from "#database/scalars.js";

@Injectable()
export class JobRepository {
  constructor(private readonly database: DatabaseService) {}

  findAll() {
    return this.database.client.orm.public.Job.include(
      "jobExecutions",
      (executions) => executions.count(),
    )
      .orderBy((job) => job.createdAt.desc())
      .all();
  }

  findByCode(code: string) {
    return this.database.client.orm.public.Job.where({ code: asJobCode(code) })
      .include("jobExecutions", (executions) =>
        executions.orderBy((execution) => execution.createdAt.desc()).limit(10),
      )
      .first();
  }

  findExecutionsByJobId(jobId: number, limit = 50) {
    return this.database.client.orm.public.JobExecution.where({
      jobId: jobId,
    })
      .orderBy((execution) => execution.createdAt.desc())
      .limit(limit)
      .all();
  }
}
