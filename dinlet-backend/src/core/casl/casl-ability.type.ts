import type { Ability } from '@casl/ability';

/**
 * CASL subject birimi. Prisma model adıyla birebir eşleşir (ör. 'Job' → Job
 * modeli), böylece ileride `accessibleBy(ability).ofType('Job')` ile
 * resource-scoped Prisma sorguları üretilebilir. Yeni bir modülün izinleri
 * CASL'a taşındıkça bu union'a eklenir.
 */
export type AppSubjects = 'Job' | 'AuditLog' | 'Store' | 'all';

export type AppAbility = Ability<[string, AppSubjects]>;

/**
 * Bir rolün DB'den okunan / Redis'te cache'lenen izin kuralı.
 * `subject`, `Permission.module`; `action`, `Permission.action` kolonuna karşılık gelir.
 */
export interface AppRule {
  action: string;
  subject: AppSubjects;
}
