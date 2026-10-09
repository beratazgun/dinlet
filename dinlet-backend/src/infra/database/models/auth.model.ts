import { enumType, member } from "@prisma/orm-postgres/contract-builder";
import {
  autoIncrementId,
  type ModelHelpers,
} from "#database/models/model.types.js";

const pgText = { codecId: "pg/text@1", nativeType: "text" } as const;

export const UserStatus = enumType(
  "UserStatus",
  pgText,
  member("PENDING"),
  member("ACTIVE"),
  member("SUSPENDED"),
);

export const VerificationTokenType = enumType(
  "VerificationTokenType",
  pgText,
  member("EMAIL_VERIFICATION"),
  member("PASSWORD_RESET"),
);

export const AccountType = enumType(
  "AccountType",
  pgText,
  member("LOCAL"),
  member("GOOGLE"),
  member("APPLE"),
);

/** KVKK kapsamında alınan onay ve rızalar. */
export const ConsentType = enumType(
  "ConsentType",
  pgText,
  member("PRIVACY_NOTICE"),
  member("TERMS_OF_USE"),
  member("CROSS_BORDER_TRANSFER"),
);

export const authEnums = {
  UserStatus,
  VerificationTokenType,
  AccountType,
  ConsentType,
};

export function createAuthModels({ field, model }: ModelHelpers) {
  const User = model("User", {
    fields: {
      id: autoIncrementId(field),
      name: field.text().optional(),
      surname: field.text().optional(),
      username: field.text().unique(),
      email: field.text().unique(),
      isEmailVerified: field
        .boolean()
        .default(false)
        .column("is_email_verified"),
      bio: field.text().optional(),
      status: field.namedType(UserStatus).default(UserStatus.members.ACTIVE),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
      deletedAt: field.temporal
        .timestamptzString()
        .optional()
        .column("deleted_at"),
      lastLoginAt: field.temporal
        .timestamptzString()
        .optional()
        .column("last_login_at"),
      lastLoginMethod: field
        .namedType(AccountType)
        .optional()
        .column("last_login_method"),
      roleId: field.int().column("role_id"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "users",
    indexes: [
      constraints.index([cols.name]),
      constraints.index([cols.surname]),
      constraints.index([cols.email]),
      constraints.index([cols.username]),
    ],
  }));

  const Account = model("Account", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      type: field.namedType(AccountType),
      password: field.text().optional(),
      providerAccountId: field.text().column("provider_account_id"),
      accessToken: field.text().optional().column("access_token"),
      refreshToken: field.text().optional().column("refresh_token"),
      expiresAt: field.temporal
        .timestamptzString()
        .optional()
        .column("expires_at"),
      scope: field.text().optional(),
      tokenType: field.text().optional().column("token_type"),
      profileRaw: field.json().optional().column("profile_raw"),
      createdAt: field.temporal.createdAtString().column("created_at"),
      updatedAt: field.temporal.updatedAtString().column("updated_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.type, fields.providerAccountId])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "accounts",
      indexes: [constraints.index([cols.userId])],
    }));

  const VerificationToken = model("VerificationToken", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      token: field.nanoid({ size: 48 }).unique(),
      type: field.namedType(VerificationTokenType),
      expiresAt: field.temporal.timestamptzString().column("expires_at"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  })
    .attributes(({ fields, constraints }) => ({
      uniques: [constraints.unique([fields.userId, fields.type])],
    }))
    .sql(({ cols, constraints }) => ({
      table: "verification_tokens",
      indexes: [constraints.index([cols.token])],
    }));

  /**
   * Onay/rıza defteri: her kayıt, kullanıcının bir metnin belirli bir
   * sürümünü kabul ettiğini (veya rızasını geri çektiğini) kanıtlar. Güncel
   * durum, türe göre en son kayıttır.
   */
  const UserConsent = model("UserConsent", {
    fields: {
      id: autoIncrementId(field),
      userId: field.int().column("user_id"),
      type: field.namedType(ConsentType),
      version: field.text(),
      granted: field.boolean(),
      ipAddress: field.text().optional().column("ip_address"),
      userAgent: field.text().optional().column("user_agent"),
      createdAt: field.temporal.createdAtString().column("created_at"),
    },
  }).sql(({ cols, constraints }) => ({
    table: "user_consents",
    indexes: [constraints.index([cols.userId, cols.type, cols.createdAt])],
  }));

  return { User, Account, VerificationToken, UserConsent };
}
