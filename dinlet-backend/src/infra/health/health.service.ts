import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Redis } from "ioredis";

import { OkResponse } from "#/core/http/index.js";
import { DatabaseService } from "#database/database.service.js";
import { REDIS_CONNECTION } from "#/infra/redis/redis.constants.js";

type CheckStatus = "up" | "down";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
  ) {}

  async checkReadiness(): Promise<OkResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const checks = { database, redis };

    if (database !== "up" || redis !== "up") {
      throw new ServiceUnavailableException({ status: "down", checks });
    }

    return new OkResponse("ready", { status: "up", checks });
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await this.database.client.orm.public.Job.select("id").limit(1).all();
      return "up";
    } catch (error: unknown) {
      this.logger.error(
        `DB health kontrolü başarısız: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "down";
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      return (await this.redis.ping()) === "PONG" ? "up" : "down";
    } catch (error: unknown) {
      this.logger.error(
        `Redis health kontrolü başarısız: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "down";
    }
  }
}
