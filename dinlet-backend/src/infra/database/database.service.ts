import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";

import { connectDatabase, db } from "#database/db.js";

/**
 * Nest yaşam döngüsünü Prisma 8'in contract-first istemcisine bağlar.
 * Uygulama kodu sorgular için `client.orm` yüzeyini kullanır.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  readonly client = db;

  async onModuleInit(): Promise<void> {
    await connectDatabase();
  }

  async onApplicationShutdown(): Promise<void> {
    await db.close();
  }
}
