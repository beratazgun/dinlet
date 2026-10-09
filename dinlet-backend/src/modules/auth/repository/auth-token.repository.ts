import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";
import { DateManager } from "#/core/utils/date-manager.js";
import { DatabaseService } from "#database/database.service.js";
import {
  AccountType,
  UserStatus,
  VerificationTokenType,
  type VerificationTokenType as VerificationTokenTypeValue,
} from "#database/enums.js";
import { asVerificationToken } from "#database/scalars.js";

@Injectable()
export class AuthTokenRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly dateManager: DateManager,
  ) {}

  private get db() {
    return this.database.client;
  }

  async findVerificationToken(token: string, type: VerificationTokenTypeValue) {
    const verificationToken = await this.db.orm.public.VerificationToken.where({
      token: asVerificationToken(token),
    })
      .select("id", "token", "userId", "type", "expiresAt")
      .first();

    return verificationToken?.type === type ? verificationToken : null;
  }

  async findActiveVerificationTokenByUserId(
    userId: number,
    type: VerificationTokenTypeValue,
  ) {
    const token = await this.db.orm.public.VerificationToken.where({
      userId: userId,
    })
      .where({ type })
      .select("id", "token", "userId", "type", "expiresAt")
      .first();

    return token && !this.dateManager.isExpired(token.expiresAt) ? token : null;
  }

  recreateVerificationToken(userId: number) {
    const expiresAt = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(24 * 60 * 60 * 1000),
    );

    return this.db.orm.public.VerificationToken.select(
      "id",
      "token",
      "userId",
      "type",
      "expiresAt",
    ).upsert({
      create: {
        userId: userId,
        token: asVerificationToken(nanoid(48)),
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt,
      },
      update: { token: asVerificationToken(nanoid(48)), expiresAt },
      conflictOn: {
        userId: userId,
        type: VerificationTokenType.EMAIL_VERIFICATION,
      },
    });
  }

  completeEmailVerification(userId: number, tokenId: number) {
    return this.db.transaction(async (tx) => {
      await tx.orm.public.User.where({ id: userId }).update({
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
      });
      await tx.orm.public.VerificationToken.where({
        id: tokenId,
      }).delete();
    });
  }

  createPasswordResetToken(userId: number) {
    const expiresAt = this.dateManager.toISOString(
      this.dateManager.addMilliseconds(15 * 60 * 1000),
    );

    return this.db.orm.public.VerificationToken.select(
      "id",
      "token",
      "userId",
      "type",
      "expiresAt",
    ).upsert({
      create: {
        userId: userId,
        token: asVerificationToken(nanoid(48)),
        type: VerificationTokenType.PASSWORD_RESET,
        expiresAt,
      },
      update: { token: asVerificationToken(nanoid(48)), expiresAt },
      conflictOn: {
        userId: userId,
        type: VerificationTokenType.PASSWORD_RESET,
      },
    });
  }

  completePasswordReset(
    userId: number,
    tokenId: number,
    hashedPassword: string,
  ) {
    return this.db.transaction(async (tx) => {
      const local = await tx.orm.public.Account.where({
        userId: userId,
      })
        .where({ type: AccountType.LOCAL })
        .select("id")
        .first();

      if (local) {
        await tx.orm.public.Account.where({ id: local.id }).update({
          password: hashedPassword,
        });
      } else {
        const user = await tx.orm.public.User.where({
          id: userId,
        })
          .select("email")
          .first();

        if (!user) throw new Error("Kullanıcı bulunamadı");

        await tx.orm.public.Account.create({
          userId: userId,
          type: AccountType.LOCAL,
          providerAccountId: user.email.toLowerCase(),
          password: hashedPassword,
        });
      }

      await tx.orm.public.VerificationToken.where({
        id: tokenId,
      }).delete();
    });
  }
}
