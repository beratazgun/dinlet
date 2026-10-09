import { Injectable } from "@nestjs/common";
import { DateManager } from "#/core/utils/date-manager.js";
import { Generator } from "#/core/utils/generator.js";
import { DatabaseService } from "#database/database.service.js";
import {
  AccountType,
  type AccountType as AccountTypeValue,
  UserStatus,
  VerificationTokenType,
} from "#database/enums.js";
import type { SocialProfile } from "#/modules/auth/types/index.js";
import type { ConsentRecord } from "#/modules/auth/repository/auth-consent.repository.js";
import { asVerificationToken } from "#database/scalars.js";
import { nanoid } from "nanoid";

@Injectable()
export class AuthUserRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly dateManager: DateManager,
  ) {}

  private get db() {
    return this.database.client;
  }

  findLoginUserByEmail(email: string) {
    return this.db.orm.public.User.where((user) =>
      user.email.eq(email.toLowerCase()),
    )
      .where((user) => user.deletedAt.isNull())
      .select("id", "isEmailVerified", "status")
      .include("role", (role) => role.select("id", "code", "isSuper"))
      .include("accounts", (accounts) => accounts.select("type", "password"))
      .first();
  }

  findByEmail(email: string) {
    return this.db.orm.public.User.where((user) =>
      user.email.eq(email.toLowerCase()),
    )
      .where((user) => user.deletedAt.isNull())
      .select("id", "isEmailVerified", "name", "surname")
      .include("accounts", (accounts) => accounts.select("type"))
      .first();
  }

  async findByUsername(username: string) {
    const exactMatch = await this.db.orm.public.User.where({ username })
      .where((user) => user.deletedAt.isNull())
      .select("id")
      .first();

    if (exactMatch) return exactMatch;

    return this.db.orm.public.User.where((user) =>
      user.username.ilike(username),
    )
      .where((user) => user.deletedAt.isNull())
      .select("id")
      .first();
  }

  findById(id: number) {
    return this.db.orm.public.User.where({ id: id })
      .where((user) => user.deletedAt.isNull())
      .select("id", "email", "name", "surname", "isEmailVerified", "status")
      .first();
  }

  findUserForPasswordChange(id: number) {
    return this.db.orm.public.User.where({ id: id })
      .where((user) => user.deletedAt.isNull())
      .select("id", "email", "name", "surname")
      .include("accounts", (accounts) => accounts.select("type", "password"))
      .first();
  }

  updateLastLogin(userId: number, method: AccountTypeValue) {
    return this.db.orm.public.User.where({ id: userId }).update({
      lastLoginAt: this.dateManager.toISOString(),
      lastLoginMethod: method,
    });
  }

  /**
   * E-posta ile kayıt: kullanıcı `PENDING` açılır, yerel hesap ve 24 saatlik
   * doğrulama token'ı aynı transaction'da yazılır. Kullanıcı adı formda
   * istenmez; e-postanın yerel kısmından benzersiz olarak üretilir.
   */
  async createUser(input: {
    name: string;
    surname?: string;
    email: string;
    /** Hash'lenmiş parola. */
    password: string;
    /** KVKK onayları; kullanıcıyla aynı transaction'da yazılır. */
    consents: ConsentRecord[];
  }) {
    const expiresAt = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(24 * 60 * 60 * 1000),
    );

    return this.db.transaction(async (tx) => {
      const defaultRole = await tx.orm.public.Role.where({ code: "USER" })
        .select("id")
        .first();

      if (!defaultRole) throw new Error("Varsayılan USER rolü bulunamadı");

      const normalizedEmail = input.email.toLowerCase();
      const base = usernameBase(normalizedEmail);
      let username = base;
      for (let attempt = 0; attempt < 5; attempt++) {
        const taken = await tx.orm.public.User.where({ username })
          .select("id")
          .first();
        if (!taken) break;
        username = `${base}${Generator.random(4, "textAndNumber").toLowerCase()}`;
      }

      const user = await tx.orm.public.User.select("id").create({
        name: input.name,
        surname: input.surname || null,
        email: normalizedEmail,
        username,
        status: UserStatus.PENDING,
        isEmailVerified: false,
        roleId: defaultRole.id,
      });

      await tx.orm.public.Account.create({
        userId: user.id,
        type: AccountType.LOCAL,
        password: input.password,
        providerAccountId: normalizedEmail,
      });

      if (input.consents.length > 0) {
        await tx.orm.public.UserConsent.createAll(
          input.consents.map((consent) => ({ userId: user.id, ...consent })),
        );
      }

      const verificationToken = await tx.orm.public.VerificationToken.select(
        "token",
      ).create({
        userId: user.id,
        token: asVerificationToken(nanoid(48)),
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt,
      });

      return { user, verificationToken };
    });
  }

  /** Oturum açmak için gereken kimlik (kullanıcı + rol). */
  findSessionUser(userId: number) {
    return this.db.orm.public.User.where({ id: userId })
      .where((user) => user.deletedAt.isNull())
      .select("id", "status")
      .include("role", (role) => role.select("id", "code", "isSuper"))
      .first();
  }

  findUserWithDetails(userId: number) {
    return this.db.orm.public.User.where({ id: userId })
      .where((user) => user.deletedAt.isNull())
      .select(
        "id",
        "email",
        "name",
        "surname",
        "username",
        "bio",
        "status",
        "isEmailVerified",
        "lastLoginAt",
        "lastLoginMethod",
      )
      .include("role", (role) => role.select("id", "code", "isSuper", "name"))
      .include("accounts", (accounts) =>
        accounts.select("id", "type", "createdAt"),
      )
      .first();
  }

  findUserWithLocalAccount(userId: number) {
    return this.db.orm.public.User.where({ id: userId })
      .where((user) => user.deletedAt.isNull())
      .select("id")
      .include("accounts", (accounts) =>
        accounts
          .where({ type: AccountType.LOCAL })
          .select("type", "password")
          .limit(1),
      )
      .first();
  }

  /**
   * Hesabı siler: giriş hesapları (yerel/Google/Apple) kalkar, kişisel
   * bilgiler anonimleştirilir ve kullanıcı soft delete edilir. E-posta ve
   * kullanıcı adı hemen serbest kalır; satır ve bağlı veriler zamanlanmış
   * temizlikte kalıcı silinir. Açık oturumlar Redis tarafındadır
   * (`AuthSessionService.terminateAllSessions`).
   */
  anonymizeAndSoftDelete(userId: number) {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.Account.where({ userId }).deleteAndCount();
      await tx.orm.public.VerificationToken.where({ userId }).deleteAndCount();
      await tx.orm.public.User.where({ id: userId }).updateAndCount({
        email: `deleted-${userId}@deleted.invalid`,
        username: `deleted_${userId}`,
        name: null,
        surname: null,
        bio: null,
        deletedAt: this.dateManager.toISOString(),
        status: UserStatus.SUSPENDED,
      });
    });
  }

  /**
   * Sosyal girişte kullanıcıyı bulur, gerekirse e-postayla eşleştirir veya
   * oluşturur. Sıra: sağlayıcı hesabı → doğrulanmış e-postayla mevcut
   * kullanıcı → yeni kullanıcı. Eşleştirilemiyorsa `null` döner.
   *
   * E-postası doğrulanmamış mevcut bir kullanıcıya bağlanırken yerel hesabın
   * parolası silinir: e-posta sahibi olmayan biri o adresle önceden kayıt
   * açmışsa (pre-hijacking) hesaba parolayla girmeye devam edemez.
   */
  findOrCreateSocialUser(profile: SocialProfile) {
    const userFields = ["id", "status", "deletedAt"] as const;

    return this.db.transaction(async (tx) => {
      const account = await tx.orm.public.Account.where({
        type: profile.provider,
        providerAccountId: profile.providerAccountId,
      })
        .select("id")
        .include("user", (user) =>
          user
            .select(...userFields)
            .include("role", (role) => role.select("id", "code", "isSuper")),
        )
        .first();
      if (account?.user) return { ...account.user, isNewUser: false };

      if (!profile.email || !profile.isEmailVerified) return null;
      const email = profile.email.toLowerCase();

      const existing = await tx.orm.public.User.where({ email })
        .where((candidate) => candidate.deletedAt.isNull())
        .select(...userFields, "isEmailVerified")
        .include("role", (role) => role.select("id", "code", "isSuper"))
        .first();

      if (existing) {
        if (!existing.isEmailVerified) {
          await tx.orm.public.Account.where({
            userId: existing.id,
            type: AccountType.LOCAL,
          }).deleteAndCount();
          await tx.orm.public.User.where({ id: existing.id }).update({
            isEmailVerified: true,
            status: UserStatus.ACTIVE,
          });
        }
        await tx.orm.public.Account.create({
          userId: existing.id,
          type: profile.provider,
          providerAccountId: profile.providerAccountId,
        });
        const { isEmailVerified: _verified, ...user } = existing;
        return { ...user, status: UserStatus.ACTIVE, isNewUser: false };
      }

      const role = await tx.orm.public.Role.where({ code: "USER" })
        .select("id", "code", "isSuper")
        .first();
      if (!role) throw new Error("Varsayılan USER rolü bulunamadı");

      const baseUsername = (email.split("@")[0] || "user").slice(0, 24);
      const taken = await tx.orm.public.User.where({ username: baseUsername })
        .select("id")
        .first();
      const username = taken
        ? `${baseUsername}${Generator.random(5, "textAndNumber").toLowerCase()}`
        : baseUsername;

      const created = await tx.orm.public.User.select(...userFields).create({
        email,
        name: profile.name,
        surname: profile.surname,
        username,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        roleId: role.id,
      });
      await tx.orm.public.Account.create({
        userId: created.id,
        type: profile.provider,
        providerAccountId: profile.providerAccountId,
      });

      return { ...created, role, isNewUser: true };
    });
  }

  /**
   * Kalıcı silinmeye hazır kullanıcılar: soft delete'i `before`'dan eski ve
   * notlarının tamamı temizlenmiş olanlar.
   */
  async findPurgeable(before: string, limit: number) {
    const users = await this.db.orm.public.User.where((user) =>
      user.deletedAt.isNotNull(),
    )
      .where((user) => user.deletedAt.lt(before))
      .select("id")
      .include("documents", (documents) => documents.count())
      .limit(limit)
      .all();
    return users.filter((user) => user.documents === 0).map((user) => user.id);
  }

  /** Kullanıcının nota bağlanmamış yüklemeleri (kalıcı silme öncesi). */
  findUploadKeys(userId: number) {
    return this.db.orm.public.Media.where({ uploaderId: userId })
      .select("id", "storageKey")
      .all();
  }

  /** Kullanıcıyı ve FK ile bağlı tüm kayıtlarını kalıcı siler. */
  hardDelete(userId: number) {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.Media.where({ uploaderId: userId }).deleteAndCount();
      await tx.orm.public.User.where({ id: userId }).deleteAndCount();
    });
  }
}

/** "elif.yilmaz+not@ornek.com" → "elif.yilmaz" (en fazla 15 karakter). */
function usernameBase(email: string): string {
  const local = (email.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/\+.*$/, "")
    .replace(/[^a-z0-9._]/g, "");
  const base = local.slice(0, 15);
  return base.length >= 3 ? base : `ogrenci${base}`;
}
