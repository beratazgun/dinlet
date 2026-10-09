import postgres from "@prisma/orm-postgres/runtime";

import "temporal-polyfill/global";

import type { Contract } from "#database/generated/contract.d.js";
import contractJson from "#database/generated/contract.json" with { type: "json" };

const databaseUrl = process.env.DATABASE_URL;

export const db = databaseUrl
  ? postgres<Contract>({
      contractJson,
      url: databaseUrl,
    })
  : postgres<Contract>({ contractJson });

let connection: Promise<void> | undefined;

export function connectDatabase(): Promise<void> {
  connection ??= db
    .connect()
    .then(() => undefined)
    .catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
  return connection;
}
