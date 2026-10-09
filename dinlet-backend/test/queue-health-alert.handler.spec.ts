import type { ConfigService } from "@nestjs/config";
import type { ModuleRef } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { DateManager } from "#/core/utils/date-manager.js";
import { QueueHealthAlertHandler } from "#/infra/job/handlers/queue-health-alert.handler.js";
import type { EmailQueueService } from "#/infra/queue/queues/email/index.js";
import type { RedisService } from "#/infra/redis/redis.service.js";
import type { EnvType } from "#config/env.validation.js";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const MINUTE = 60_000;

function setup(options: {
  failed?: Record<string, { finishedOn: number; failedReason: string }[]>;
  ttsWaiting?: { timestamp: number }[];
  lastChecked?: number;
  alertEmail?: string;
}) {
  const store = new Map<string, string>();
  if (options.lastChecked) store.set("ops:queue-alert:checked:all", String(options.lastChecked));
  const redis = {
    createKey: (name: string, suffix: string) => ({
      toString: () =>
        `${name === "QUEUE_ALERT_CHECKED" ? "ops:queue-alert:checked" : "ops:queue-alert:wait"}:${suffix}`,
    }),
    get: vi.fn(async (key: { toString(): string }) => store.get(key.toString()) ?? null),
    set: vi.fn(async (key: { toString(): string }, value: string) => {
      store.set(key.toString(), value);
    }),
  };
  const queueFor = (name: string) => ({
    getJobs: vi.fn(async (types: string[]) =>
      types.includes("failed")
        ? (options.failed?.[name] ?? [])
        : name === "tts"
          ? (options.ttsWaiting ?? [])
          : [],
    ),
    getJobCounts: vi.fn(async () => ({ waiting: 7, prioritized: 3 })),
  });
  const queues = new Map<string, ReturnType<typeof queueFor>>();
  const moduleRef = {
    get: (token: string) => {
      const name = token.replace(/^BullQueue_/, "");
      if (!queues.has(name)) queues.set(name, queueFor(name));
      return queues.get(name);
    },
  };
  const dateManager = new DateManager();
  vi.spyOn(dateManager, "utcNow").mockReturnValue(new Date(NOW));
  const emailQueue = { enqueueEmail: vi.fn() };
  const handler = new QueueHealthAlertHandler(
    moduleRef as unknown as ModuleRef,
    emailQueue as unknown as EmailQueueService,
    redis as unknown as RedisService,
    dateManager,
    { get: () => options.alertEmail } as unknown as ConfigService<EnvType>,
  );
  return { handler, emailQueue };
}

describe("QueueHealthAlertHandler", () => {
  it("sorun yoksa e-posta göndermez", async () => {
    const { handler, emailQueue } = setup({ alertEmail: "ops@dinlet.app" });
    expect((await handler.execute()).affectedRows).toBe(0);
    expect(emailQueue.enqueueEmail).not.toHaveBeenCalled();
  });

  it("son kontrolden sonra DLQ'ya düşen işi ve uzun beklemeyi bildirir", async () => {
    const { handler, emailQueue } = setup({
      alertEmail: "ops@dinlet.app",
      lastChecked: NOW - 10 * MINUTE,
      failed: {
        tts: [
          { finishedOn: NOW - 2 * MINUTE, failedReason: "ffmpeg başarısız" },
          { finishedOn: NOW - 60 * MINUTE, failedReason: "eski" },
        ],
      },
      ttsWaiting: [{ timestamp: NOW - 150 * MINUTE }, { timestamp: NOW - 5 * MINUTE }],
    });

    const result = await handler.execute({ maxWaitMinutes: 120 });

    expect(result.affectedRows).toBe(2);
    const email = emailQueue.enqueueEmail.mock.calls[0]![0];
    expect(email).toMatchObject({ to: "ops@dinlet.app", code: "OPS_ALERT" });
    expect(email.variables.details).toContain("tts: 1 iş DLQ'ya düştü (son hata: ffmpeg başarısız)");
    expect(email.variables.details).toContain("tts: 10 iş bekliyor; en eskisi 150 dakikadır sırada");

    // Aynı bekleme uyarısı bir saat susturulur.
    const again = await handler.execute({ maxWaitMinutes: 120 });
    expect(again.affectedRows).toBe(0);
  });
});
