import { Module } from "@nestjs/common";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { AuthControllers } from "#/modules/auth/controllers/index.js";
import { AuthEventHandler } from "#/modules/auth/event/auth.event-handler.js";
import { AuthRepositories } from "#/modules/auth/repository/index.js";
import { AuthServices } from "#/modules/auth/services/index.js";

const AuthProviders = [DateManager, Paginator, AuthEventHandler];

@Module({
  controllers: [...AuthControllers],
  providers: [...AuthRepositories, ...AuthServices, ...AuthProviders],
  exports: [...AuthRepositories, ...AuthServices],
})
export class AuthModule {}
