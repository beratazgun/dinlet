import "reflect-metadata";
import { ConfigService } from "@nestjs/config";

import { createApp } from "#/app.factory.js";
import type { EnvType } from "#config/env.validation.js";

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = app.get(ConfigService<EnvType>).get("PORT", { infer: true });
  await app.listen(port ?? 3_000, "0.0.0.0");
}
await bootstrap();
