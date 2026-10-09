import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./support/test-app.js";

interface SubscriptionBody {
  plan: { raw: string };
  status: { raw: string | null };
  usage: { monthlyPages: number; remainingPages: number };
  limits: { rewriteMode: { raw: string } };
}

describe("Subscription + RevenueCat webhook (e2e)", () => {
  let testApp: TestApp;
  let user: TestUser;
  let client: HttpClient;
  const DAY = 24 * 60 * 60 * 1_000;

  beforeAll(async () => {
    testApp = await startTestApp();
    user = await createActiveUser(testApp.app);
    client = await new HttpClient(testApp.baseUrl, { deviceId: randomUUID() }).login(
      user.email,
      user.password,
    );
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const webhook = (
    type: string,
    timestamp: number,
    auth = process.env.REVENUECAT_WEBHOOK_AUTH!,
    id = randomUUID(),
  ) =>
    fetch(`${testApp.baseUrl}/api/v1/webhooks/revenuecat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify({
        api_version: "1.0",
        event: {
          id,
          type,
          app_user_id: String(user.id),
          product_id: "dinlet_pro_monthly",
          entitlement_ids: ["pro"],
          event_timestamp_ms: timestamp,
          expiration_at_ms: Date.now() + 30 * DAY,
          store: "APP_STORE",
        },
      }),
    });

  const subscription = async () =>
    (await client.get<SubscriptionBody>("/me/subscription")).body.data!;

  it("abonelik yokken Free planı ve kotasını döner", async () => {
    expect(await subscription()).toMatchObject({
      plan: { raw: "FREE" },
      status: { raw: null },
      usage: { monthlyPages: 30, remainingPages: 30 },
      limits: { rewriteMode: { raw: "RAW" } },
    });
  });

  it("yanlış imzalı webhook'u reddeder", async () => {
    expect((await webhook("INITIAL_PURCHASE", Date.now(), "Bearer yanlis")).status).toBe(401);
  });

  it("satın alma Pro yapar; tekrar gelen ve eski olaylar yok sayılır", async () => {
    const now = Date.now();
    const id = randomUUID();
    expect((await webhook("INITIAL_PURCHASE", now, undefined, id)).status).toBe(200);
    expect(await subscription()).toMatchObject({
      plan: { raw: "PRO" },
      status: { raw: "ACTIVE" },
      usage: { monthlyPages: 500 },
      limits: { rewriteMode: { raw: "FLUENT" } },
    });

    // Aynı olay tekrar gelirse işlenmez.
    const duplicate = await webhook("EXPIRATION", now + 1, undefined, id);
    expect(duplicate.status).toBe(200);
    expect((await subscription()).plan.raw).toBe("PRO");

    // Sırası karışmış eski bir olay durumu geri almaz.
    await webhook("EXPIRATION", now - 60_000);
    expect((await subscription()).plan.raw).toBe("PRO");
  });

  it("iptal dönem sonuna kadar Pro bırakır, sona erme Free yapar", async () => {
    await webhook("CANCELLATION", Date.now() + 1_000);
    expect(await subscription()).toMatchObject({
      plan: { raw: "PRO" },
      status: { raw: "CANCELLED" },
    });

    await webhook("EXPIRATION", Date.now() + 2_000);
    expect(await subscription()).toMatchObject({
      plan: { raw: "FREE" },
      status: { raw: "EXPIRED" },
    });
  });
});
