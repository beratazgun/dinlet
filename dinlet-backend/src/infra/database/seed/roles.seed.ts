import { db } from "#database/db.js";

interface RoleSeed {
  code: string;
  name: string;
  description: string;
  isSuper?: boolean;
  isSystem?: boolean;
  rank: number;
}

/**
 * Kodlar sabittir (sosyal girişte yeni hesaplar `USER` alır); adlar ve
 * açıklamalar Dinlet'teki karşılıklarıdır.
 */
const ROLES: RoleSeed[] = [
  {
    code: "SUPER_ADMIN",
    name: "Süper Yönetici",
    description:
      "Kurucu ve teknik ekip. Tüm yetkiler; zamanlanmış işleri tanımlar ve değiştirir.",
    isSuper: true,
    isSystem: true,
    rank: 100,
  },
  {
    code: "ADMIN",
    name: "Yönetici",
    description:
      "Destek ve operasyon ekibi. Kuyruk panelini ve denetim kayıtlarını görür, zamanlanmış işleri elle çalıştırır veya durdurur.",
    isSystem: true,
    rank: 90,
  },
  {
    code: "USER",
    name: "Öğrenci",
    description:
      "Uygulamayı kullanan öğrenci. Kendi notlarını yükler, dinler ve aboneliğini yönetir.",
    isSystem: true,
    rank: 1,
  },
];

export async function seedRoles(): Promise<void> {
  console.log("👤 Roller yükleniyor...");

  for (const role of ROLES) {
    await db.orm.public.Role.upsert({
      create: {
        ...role,
        isSuper: role.isSuper ?? false,
        isSystem: role.isSystem ?? false,
      },
      update: {
        name: role.name,
        description: role.description,
        isSuper: role.isSuper ?? false,
        isSystem: role.isSystem ?? false,
        rank: role.rank,
      },
      conflictOn: { code: role.code },
    });
  }

  console.log(`✅ ${ROLES.length} rol hazır`);
}
