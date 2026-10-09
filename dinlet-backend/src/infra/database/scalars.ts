import type { Char, Varchar } from "@prisma/orm-postgres/target/codec-types";

/** Boundary helpers for contract-level fixed-length and varchar branded scalars. */
export const asVerificationToken = (value: string): Char<48> =>
  value as Char<48>;
export const asJobCode = (value: string): Varchar<100> => value as Varchar<100>;
export const asJobName = (value: string): Varchar<200> => value as Varchar<200>;
export const asCronPattern = (value: string): Varchar<50> =>
  value as Varchar<50>;
