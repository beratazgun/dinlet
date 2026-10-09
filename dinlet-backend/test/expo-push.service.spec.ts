import type { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpoPushService } from "#/modules/notification/services/expo-push.service.js";
import type { EnvType } from "#config/env.validation.js";

const config = (delivery: "send" | "log") =>
  ({
    get: (key: string) => (key === "PUSH_DELIVERY" ? delivery : undefined),
  }) as unknown as ConfigService<EnvType>;

describe("ExpoPushService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("cihazı kayıtlı olmayan token'ları ayıklar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: "ok", id: "1" },
          { status: "error", details: { error: "DeviceNotRegistered" } },
          { status: "error", details: { error: "MessageRateExceeded" } },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const invalid = await new ExpoPushService(config("send")).send(
      ["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"],
      { title: "t", body: "b" },
    );

    expect(invalid).toEqual(["ExponentPushToken[b]"]);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(sent[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "t", sound: "default" });
  });

  it("5xx yanıtta hata fırlatır (kuyruk yeniden dener)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "down" }),
    );
    await expect(
      new ExpoPushService(config("send")).send(["ExponentPushToken[a]"], {
        title: "t",
        body: "b",
      }),
    ).rejects.toThrow("503");
  });

  it("log modunda dışarı çıkmaz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await new ExpoPushService(config("log")).send(["ExponentPushToken[a]"], {
      title: "t",
      body: "b",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
