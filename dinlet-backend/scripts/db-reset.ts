/**
 * Veritabanını tamamen boşaltır: uygulama tabloları (`public`) ve Prisma'nın
 * contract imzası (`prisma_contract`) silinir. Şemayı geri kurmak ve seed'i
 * çalıştırmak `pnpm db:reset` script'inin sonraki adımlarıdır.
 *
 * Prisma 8'de `migrate reset` karşılığı olmadığı için bu betik vardır.
 * `NODE_ENV=production` iken çalışmaz.
 */
import { resolve } from "node:path";

import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "config/.env"), quiet: true });

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset production ortamında çalıştırılamaz.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL set değil — config/.env dosyasını kontrol edin.");
  }

  const databaseName = new URL(process.env.DATABASE_URL).pathname.slice(1);
  console.log(`🧨 '${databaseName}' veritabanı sıfırlanıyor...`);

  const { connectDatabase, db } = await import("#database/db.js");
  await connectDatabase();
  try {
    for (const statement of [
      db.raw.sql`DROP SCHEMA IF EXISTS prisma_contract CASCADE`,
      db.raw.sql`DROP SCHEMA IF EXISTS public CASCADE`,
      db.raw.sql`CREATE SCHEMA public`,
    ]) {
      await db.runtime().execute(statement.affectedCount().build());
    }
  } finally {
    await db.close();
  }

  console.log("✅ Şemalar silindi.");
}

main().catch((error: unknown) => {
  console.error("db:reset başarısız:", error);
  process.exitCode = 1;
});
