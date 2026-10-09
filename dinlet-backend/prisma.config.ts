import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  skills: {
    agents: ["claude", "agents"],
  },
  orm: ormConfig({
    contract: "./src/infra/database/contract.ts",
    output: "./src/infra/database/generated",
    migrations: {
      dir: "./src/infra/database/migrations",
    },
    db: {
      connection: process.env.DATABASE_URL!,
    },
  }),
});
