import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

export const JobCategory = enumType(
  "JobCategory",
  pgText,
  member("MAINTENANCE"),
  member("NOTIFICATION"),
  member("DATA_SYNC"),
  member("CLEANUP"),
  member("OTHER"),
);

export const JobStatusEnum = enumType(
  "JobStatusEnum",
  pgText,
  member("PENDING"),
  member("RUNNING"),
  member("SUCCESS"),
  member("FAILED"),
  member("TIMEOUT"),
  member("CANCELLED"),
);

export const jobEnums = { JobCategory, JobStatusEnum };

export function createJobModels({ field, model, type }: ModelHelpers) {
  const JobCode = type.sql.String(100);
  const JobName = type.sql.String(200);
  const CronPattern = type.sql.String(50);

  const Job = model("Job", {
    fields: {
      id: autoIncrementId(field),
      code: field.namedType(JobCode).unique(),
      name: field.namedType(JobName),
      description: field.text().optional(),
      category: field
        .namedType(JobCategory)
        .default(JobCategory.members.MAINTENANCE),
      cronPattern: field.namedType(CronPattern).column("cron_pattern"),
      isActive: field.boolean().default(true).column("is_active"),
      retryLimit: field.int().default(3).column("retry_limit"),
      params: field.json().optional(),
      lastExecutionAt: field.temporal
        .timestamptzString()
        .optional()
        .column("last_execution_at"),
      lastSuccessAt: field.temporal
        .timestamptzString()
        .optional()
        .column("last_success_at"),
      lastFailureAt: field.temporal
        .timestamptzString()
        .optional()
        .column("last_failure_at"),
      consecutiveFailures: field
        .int()
        .default(0)
        .column("consecutive_failures"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "jobs",
    indexes: [
      constraints.index([cols.isActive]),
      constraints.index([cols.code]),
      constraints.index([cols.category, cols.isActive]),
      constraints.index([cols.lastExecutionAt]),
    ],
  }));

  const JobExecution = model("JobExecution", {
    fields: {
      id: autoIncrementId(field),
      jobId: field.int().column("job_id"),
      status: field
        .namedType(JobStatusEnum)
        .default(JobStatusEnum.members.PENDING),
      startTime: field.temporal.createdAtString().column("start_time"),
      endTime: field.temporal.timestamptzString().optional().column("end_time"),
      duration: field.int().optional(),
      affectedRows: field.int().optional().column("affected_rows"),
      errorMessage: field.text().optional().column("error_message"),
      metadata: field.json().optional(),
      retryCount: field.int().default(0).column("retry_count"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "job_executions",
    indexes: [
      constraints.index([cols.jobId, cols.status, cols.startTime]),
      constraints.index([cols.status, cols.startTime]),
      // Çalıştırma geçmişi keyset sayfalaması: jobId + (createdAt, id) sırası.
      constraints.index([cols.jobId, cols.createdAt]),
    ],
  }));

  return {
    Job,
    JobExecution,
    types: { JobCode, JobName, CronPattern },
  };
}
