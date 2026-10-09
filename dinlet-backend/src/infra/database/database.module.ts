import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "#database/database.service.js";

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
