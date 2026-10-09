import { db } from "#database/db.js";
import { PERMISSIONS } from "#database/seed/permissions.seed.js";

type PermissionName = (typeof PERMISSIONS)[number]["name"];
type RolePermissionMap = Record<string, "*" | PermissionName[]>;

/**
 * Süper yönetici `isSuper` olduğu için zaten her şeyi yapabilir. Yönetici
 * (destek/operasyon) işleri izler, elle çalıştırır ve durdurur; iş
 * tanımlarını (cron, parametre) oluşturup değiştirmek koda bağlı olduğundan
 * yalnızca süper yöneticidedir. Mağazada yönetici içerikleri görür, destek
 * için içerik tanımlar ve kullanıcıların paylaştığı notları inceler; katalog
 * düzenleme süper yöneticidedir. Öğrencinin
 * yönetim izni yoktur.
 */
const ROLE_PERMISSIONS: RolePermissionMap = {
  SUPER_ADMIN: "*",
  ADMIN: [
    "job.list",
    "job.read",
    "job.run",
    "job.toggle",
    "audit-log.list",
    "audit-log.read",
    "store.list",
    "store.grant",
    "store.review",
  ],
  USER: [],
};

export async function seedRolePermissions(): Promise<void> {
  console.log("🔗 Rol izinleri bağlanıyor...");

  const [roles, permissions] = await Promise.all([
    db.orm.public.Role.select("id", "code").all(),
    db.orm.public.Permission.select("id", "name").all(),
  ]);

  const roleByCode = new Map(roles.map((role) => [role.code, role.id]));
  const permissionByName = new Map(
    permissions.map((permission) => [permission.name, permission.id]),
  );

  let linkCount = 0;

  for (const [roleCode, grant] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleByCode.get(roleCode);
    if (!roleId) {
      console.warn(`   ⚠️  '${roleCode}' rolü bulunamadı, atlanıyor`);
      continue;
    }

    const permissionIds =
      grant === "*"
        ? permissions.map((permission) => permission.id)
        : grant.flatMap((name) => {
            const permissionId = permissionByName.get(name);
            if (!permissionId) {
              console.warn(
                `   ⚠️  '${name}' izni bulunamadı ('${roleCode}' için atlanıyor)`,
              );
              return [];
            }
            return [permissionId];
          });

    // Seed doğruluk kaynağıdır: listeden çıkarılan izinler rolden de kalkar.
    const roleLinks = db.orm.public.RolePermission.where({ roleId });
    const removed =
      permissionIds.length > 0
        ? await roleLinks
            .where((link) => link.permissionId.notIn(permissionIds))
            .deleteAndCount()
        : await roleLinks.deleteAndCount();
    if (removed > 0) console.log(`   🧹 ${roleCode} → ${removed} eski izin kaldırıldı`);

    for (const permissionId of permissionIds) {
      await db.orm.public.RolePermission.upsert({
        create: { roleId, permissionId },
        update: {},
        conflictOn: { roleId, permissionId },
      });
      linkCount++;
    }

    console.log(`   ✅ ${roleCode} → ${permissionIds.length} izin`);
  }

  console.log(`✅ Toplam ${linkCount} rol-izin bağı hazır`);
}
