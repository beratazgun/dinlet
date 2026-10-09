import { DateManager } from "#/core/utils/date-manager.js";
import { hashPassword } from "#/core/utils/hash.js";
import { db } from "#database/db.js";
import {
  AccountType,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionStore,
  UserStatus,
  type SubscriptionPlan as SubscriptionPlanValue,
  type SubscriptionStatus as SubscriptionStatusValue,
  type SubscriptionStore as SubscriptionStoreValue,
} from "#database/enums.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

interface SubscriptionSeed {
  plan: SubscriptionPlanValue;
  status: SubscriptionStatusValue;
  store: SubscriptionStoreValue;
  productId: string;
  /** Dönem sonu, bugünden itibaren gün. */
  periodEndsInDays: number;
}

interface UserSeed {
  name: string;
  surname: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  subscription?: SubscriptionSeed;
}

/**
 * Production'da yalnızca süper admin oluşturulur (e-posta `SEED_ADMIN_EMAIL`).
 * Geliştirmede Dinlet'in gerçek kullanıcı tiplerini temsil eden hesaplar da
 * açılır: destek ekibi ve KPSS / YKS / ALES'e hazırlanan öğrenciler, farklı
 * abonelik durumlarıyla. E-postalar gerçek kişilere gitmesin diye ayrılmış
 * `.test` alan adındadır.
 */
const SUPER_ADMIN: UserSeed = {
  name: "Dinlet",
  surname: "Yönetim",
  username: "dinlet",
  email: "admin@dinlet.test",
  role: "SUPER_ADMIN",
};

const DEVELOPMENT_USERS: UserSeed[] = [
  {
    name: "Zeynep",
    surname: "Arslan",
    username: "zeynep.destek",
    email: "destek@dinlet.test",
    role: "ADMIN",
  },
  {
    // KPSS'ye çalışan, Free planda: LLM'siz okuma, aylık 30 sayfa.
    name: "Mert",
    surname: "Kaya",
    username: "mertkaya",
    email: "mert.kaya@dinlet.test",
    role: "USER",
  },
  {
    // YKS'ye hazırlanan, App Store'dan aylık Pro abonesi.
    name: "Elif",
    surname: "Yılmaz",
    username: "elifyilmaz",
    email: "elif.yilmaz@dinlet.test",
    role: "USER",
    subscription: {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      store: SubscriptionStore.APP_STORE,
      productId: "dinlet_pro_monthly",
      periodEndsInDays: 21,
    },
  },
  {
    // ALES'e çalışan; Pro'yu iptal etmiş, dönem sonuna kadar Pro kalır.
    name: "Selin",
    surname: "Demir",
    username: "selindemir",
    email: "selin.demir@dinlet.test",
    role: "USER",
    subscription: {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.CANCELLED,
      store: SubscriptionStore.PLAY_STORE,
      productId: "dinlet_pro_monthly",
      periodEndsInDays: 6,
    },
  },
];

function usersToSeed(isProduction: boolean): UserSeed[] {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  if (isProduction && !adminEmail) {
    throw new Error("Production seed'i için SEED_ADMIN_EMAIL tanımlı olmalı.");
  }
  const superAdmin = adminEmail
    ? { ...SUPER_ADMIN, email: adminEmail }
    : SUPER_ADMIN;
  return isProduction ? [superAdmin] : [superAdmin, ...DEVELOPMENT_USERS];
}

export async function seedUsers(): Promise<void> {
  console.log("👥 Kullanıcı seed'i başlatılıyor...");

  // Seed parolası env'den gelir; production'da zorunlu ve güçlü olmalıdır.
  const password = process.env.SEED_USER_PASSWORD;
  const isProduction = process.env.NODE_ENV === "production";
  if (!password || (isProduction && password.length < 16)) {
    throw new Error(
      "SEED_USER_PASSWORD tanımlı olmalı (production'da en az 16 karakter).",
    );
  }
  const hashedPassword = await hashPassword(password);
  const dateManager = new DateManager();
  const roles = await db.orm.public.Role.select("id", "code").all();
  const roleByCode = new Map(roles.map((role) => [role.code, role.id]));

  for (const user of usersToSeed(isProduction)) {
    const roleId = roleByCode.get(user.role);
    if (!roleId) {
      throw new Error(
        `'${user.role}' rolü bulunamadı. Önce roles seed'ini çalıştırın.`,
      );
    }

    // SEED_ADMIN_EMAIL değiştiyse aynı yönetici (kullanıcı adıyla bulunur)
    // yeni e-postaya taşınır; yoksa upsert yeni kayıt açmaya çalışır ve
    // kullanıcı adı çakışır.
    const existing = await db.orm.public.User.where({
      username: user.username,
    })
      .select("id", "email")
      .first();
    if (existing && existing.email !== user.email) {
      await db.orm.public.User.where({ id: existing.id }).updateAndCount({
        email: user.email,
      });
      await db.orm.public.Account.where({
        userId: existing.id,
        type: AccountType.LOCAL,
      }).updateAndCount({ providerAccountId: user.email });
    }

    const profile = {
      name: user.name,
      surname: user.surname,
      username: user.username,
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      roleId,
    };
    const createdUser = await db.orm.public.User.upsert({
      create: { ...profile, email: user.email },
      update: profile,
      conflictOn: { email: user.email },
    });

    await db.orm.public.Account.upsert({
      create: {
        userId: createdUser.id,
        type: AccountType.LOCAL,
        providerAccountId: user.email,
        password: hashedPassword,
      },
      update: {
        userId: createdUser.id,
        password: hashedPassword,
      },
      conflictOn: {
        type: AccountType.LOCAL,
        providerAccountId: user.email,
      },
    });

    if (user.subscription) {
      const subscription = {
        plan: user.subscription.plan,
        status: user.subscription.status,
        store: user.subscription.store,
        productId: user.subscription.productId,
        // Mobil uygulama RevenueCat'i `appUserID = users.id` ile başlatır.
        rcAppUserId: String(createdUser.id),
        currentPeriodEnd: dateManager.toISOString(
          dateManager.addMilliseconds(
            user.subscription.periodEndsInDays * DAY_MS,
          ),
        ),
        lastEventAt: dateManager.toISOString(),
      };
      await db.orm.public.Subscription.upsert({
        create: { userId: createdUser.id, ...subscription },
        update: subscription,
        conflictOn: { userId: createdUser.id },
      });
    }

    const plan = user.subscription
      ? ` · ${user.subscription.plan}/${user.subscription.status}`
      : "";
    console.log(
      `   ✅ ${user.name} ${user.surname} <${user.email}> — ${user.role}${plan}`,
    );
  }

  console.log("✅ Kullanıcı seed'i tamamlandı");
}
