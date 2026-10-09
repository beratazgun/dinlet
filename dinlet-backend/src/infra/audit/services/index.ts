import { AuditContextService } from "#/infra/audit/services/audit-context.service.js";
import { AuditLogService } from "#/infra/audit/services/audit-log.service.js";
import { AuditRecorderService } from "#/infra/audit/services/audit-recorder.service.js";

export const AuditServices = [
  AuditContextService,
  AuditRecorderService,
  AuditLogService,
];

export { AuditContextService, AuditLogService, AuditRecorderService };
