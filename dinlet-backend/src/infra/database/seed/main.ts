import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "config/.env"), quiet: true });

export async function runSeeds(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL set değil — config/.env dosyasını kontrol edin.",
    );
  }

  const [
    { connectDatabase },
    { seedRoles },
    { seedPermissions },
    { seedRolePermissions },
    { seedUsers },
    { seedJobs },
    { seedNotificationTemplates },
    { seedStoreCategories },
  ] = await Promise.all([
    import("#database/db.js"),
    import("#database/seed/roles.seed.js"),
    import("#database/seed/permissions.seed.js"),
    import("#database/seed/role-permissions.seed.js"),
    import("#database/seed/users.seed.js"),
    import("#database/seed/jobs.seed.js"),
    import("#database/seed/notification-templates.seed.js"),
    import("#database/seed/store-categories.seed.js"),
  ]);

  await connectDatabase();
  console.log("Seeding...\n");

  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedUsers();
  await seedJobs();
  await seedNotificationTemplates();
  await seedStoreCategories();

  console.log("\nDone.");
}

async function main(): Promise<void> {
  try {
    await runSeeds();
  } catch (error: unknown) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    const { db } = await import("#database/db.js");
    await db.close();
  }
}

const entrypoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (entrypoint === import.meta.url) {
  await main();
}
