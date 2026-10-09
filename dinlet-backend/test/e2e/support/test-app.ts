import "reflect-metadata";
import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { createApp } from "#/app.factory.js";
import { AccountType, UserStatus } from "#database/enums.js";
import { hashPassword } from "#/core/utils/hash.js";
import { DatabaseService } from "#database/database.service.js";

export interface TestApp {
  app: NestFastifyApplication;
  baseUrl: string;
  close: () => Promise<void>;
}

/** `main.ts` ile aynı kurulumu rastgele bir portta ayağa kaldırır. */
export async function startTestApp(): Promise<TestApp> {
  // Hata ayıklarken `E2E_LOG=1 pnpm test:e2e` ile request logları açılır.
  const app = await createApp({ logger: process.env.E2E_LOG === "1" });
  await app.listen(0, "127.0.0.1");
  return {
    app,
    baseUrl: (await app.getUrl()).replace("[::1]", "127.0.0.1"),
    close: () => app.close(),
  };
}

export interface TestUser {
  id: number;
  email: string;
  password: string;
}

/**
 * E-postası doğrulanmış, aktif bir USER oluşturur. Her test kendi
 * kullanıcısıyla çalışır; böylece spec'ler birbirinin verisini görmez.
 */
export async function createActiveUser(
  app: NestFastifyApplication,
  password = "E2ePassword123!",
): Promise<TestUser> {
  const db = app.get(DatabaseService).client;
  const suffix = randomUUID().slice(0, 8);
  const email = `e2e-${suffix}@example.com`;

  const role = await db.orm.public.Role.where({ code: "USER" })
    .select("id")
    .first();
  if (!role) throw new Error("USER rolü yok; seed çalıştı mı?");

  const user = await db.orm.public.User.select("id").create({
    name: "E2E",
    surname: "Kullanıcı",
    username: `e2e_${suffix}`,
    email,
    isEmailVerified: true,
    status: UserStatus.ACTIVE,
    roleId: role.id,
  });
  await db.orm.public.Account.create({
    userId: user.id,
    type: AccountType.LOCAL,
    providerAccountId: email,
    password: await hashPassword(password),
  });

  return { id: user.id, email, password };
}
