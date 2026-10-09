/** Denetim kuyruğundaki job adları. */
export const AuditLogJobName = {
  STORE: "store-audit-log",
} as const;

export type AuditLogJobName =
  (typeof AuditLogJobName)[keyof typeof AuditLogJobName];

/**
 * Toplu yazım ayarı: en fazla bu kadar kayıt tek INSERT'te yazılır.
 * Worker eşzamanlılığı da bu değerdir — grubun dolabilmesi için gerekli.
 */
export const AUDIT_LOG_BATCH_SIZE = 100;

/** Grup dolmasa da ilk kayıttan en geç bu kadar ms sonra yazılır. */
export const AUDIT_LOG_BATCH_WAIT_MS = 1_000;
