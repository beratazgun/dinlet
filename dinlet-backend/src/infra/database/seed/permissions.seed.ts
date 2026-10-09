import { db } from "#database/db.js";

/**
 * Kodda `@CheckPolicies` ile denetlenen izinler (`job.controller.ts`,
 * `audit-log.controller.ts`, `store-admin.controller.ts`). Yeni bir yönetim ucu eklenince izni buraya da
 * eklenir; denetlenmeyen izin tanımlanmaz.
 */
export const PERMISSIONS = [
  { name: "job.list", module: "Job", action: "list" },
  { name: "job.read", module: "Job", action: "read" },
  { name: "job.create", module: "Job", action: "create" },
  { name: "job.update", module: "Job", action: "update" },
  { name: "job.run", module: "Job", action: "run" },
  { name: "job.toggle", module: "Job", action: "toggle" },
  { name: "audit-log.list", module: "AuditLog", action: "list" },
  { name: "audit-log.read", module: "AuditLog", action: "read" },
  { name: "store.list", module: "Store", action: "list" },
  { name: "store.create", module: "Store", action: "create" },
  { name: "store.update", module: "Store", action: "update" },
  { name: "store.delete", module: "Store", action: "delete" },
  { name: "store.grant", module: "Store", action: "grant" },
  { name: "store.review", module: "Store", action: "review" },
] as const;

export async function seedPermissions(): Promise<void> {
  console.log("🔐 İzinler yükleniyor...");

  for (const permission of PERMISSIONS) {
    await db.orm.public.Permission.upsert({
      create: permission,
      update: { name: permission.name },
      conflictOn: {
        module: permission.module,
        action: permission.action,
      },
    });
  }

  console.log(`✅ ${PERMISSIONS.length} izin hazır`);
}
