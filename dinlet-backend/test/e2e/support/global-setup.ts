import { execFileSync } from "node:child_process";

import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import "./setup-env.js";

/**
 * Testlerden önce bir kez: test veritabanının şemasını contract'a getirir,
 * seed'i çalıştırır (idempotent) ve S3 bucket'ını açar.
 * Gerekli servisler: `docker compose up -d dinlet-postgres dinlet-redis dinlet-localstack`.
 */
export default async function globalSetup(): Promise<void> {
  const databaseName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  const run = (args: string[]) =>
    execFileSync("pnpm", args, { stdio: "inherit", env: process.env });

  run([
    "exec",
    "prisma",
    "db",
    "update",
    "--no-interactive",
    "--confirm",
    databaseName,
    "--quiet",
  ]);
  run(["db:seed"]);

  const s3 = new S3Client({
    // LocalStack CreateBucket'ta R2'nin "auto" bölgesini kabul etmez.
    region: "us-east-1",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  try {
    await s3.send(
      new CreateBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }),
    );
  } catch (error) {
    if (!(error instanceof BucketAlreadyOwnedByYou)) throw error;
  } finally {
    s3.destroy();
  }
}
