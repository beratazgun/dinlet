import type { ComposedAuthoringHelpers } from "@prisma/orm-postgres/contract-builder";
import sqlFamily from "@prisma/orm-postgres/family";
import postgresTarget from "@prisma/orm-postgres/target";

export type ContractHelpers = ComposedAuthoringHelpers<
  typeof sqlFamily,
  typeof postgresTarget,
  undefined
>;

export type ModelHelpers = Pick<ContractHelpers, "field" | "model" | "type">;

/**
 * Tüm modellerin standart birincil anahtarı: otomatik artan integer.
 *
 * Postgres tarafında `autoincrement()` default'u SERIAL pseudo-type'a
 * çevrilir. Sihirli ifade tek yerde dursun diye helper'a alındı.
 */
export function autoIncrementId(field: ModelHelpers["field"]) {
  return field.int().id().defaultSql("autoincrement()");
}
