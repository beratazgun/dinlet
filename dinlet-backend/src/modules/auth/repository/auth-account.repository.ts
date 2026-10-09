import { Injectable } from "@nestjs/common";
import { AccountType } from "#database/enums.js";
import { DatabaseService } from "#database/database.service.js";

@Injectable()
export class AuthAccountRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  async findUserAccountsForUnlink(userId: number) {
    const user = await this.db.orm.public.User.where({ id: userId })
      .where((candidate) => candidate.deletedAt.isNull())
      .select("id")
      .include("accounts", (accounts) =>
        accounts.select("id", "type", "password"),
      )
      .first();

    return (user?.accounts ?? []).map((account) => ({
      id: account.id,
      type: account.type,
      hasPassword: Boolean(account.password),
    }));
  }

  deleteAccountById(accountId: number, userId: number) {
    return this.db.orm.public.Account.where({ id: accountId })
      .where({ userId: userId })
      .delete();
  }

  createLocalAccount(userId: number, email: string, hashedPassword: string) {
    return this.db.orm.public.Account.select("id").create({
      userId: userId,
      type: AccountType.LOCAL,
      providerAccountId: email.toLowerCase(),
      password: hashedPassword,
    });
  }

  updatePassword(userId: number, hashedPassword: string) {
    return this.db.orm.public.Account.where({ userId: userId })
      .where({ type: AccountType.LOCAL })
      .update({ password: hashedPassword });
  }
}
