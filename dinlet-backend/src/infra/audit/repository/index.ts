import { AuditLogRepository } from "#/infra/audit/repository/audit-log.repository.js";
import { EntitySnapshotRepository } from "#/infra/audit/repository/entity-snapshot.repository.js";

export const AuditRepositories = [AuditLogRepository, EntitySnapshotRepository];

export { AuditLogRepository, EntitySnapshotRepository };
