import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
} from "./support/test-app.js";

describe("Kuyruk paneli (e2e)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const board = (client: HttpClient) =>
    fetch(`${testApp.baseUrl}/admin/queues`, {
      headers: { cookie: client.cookieHeader, "x-forwarded-for": client.ip },
    });

  it("oturumsuz ve admin olmayan kullanıcıya 404 döner", async () => {
    expect((await fetch(`${testApp.baseUrl}/admin/queues`)).status).toBe(404);

    const user = await createActiveUser(testApp.app);
    const client = await new HttpClient(testApp.baseUrl).login(user.email, user.password);
    expect((await board(client)).status).toBe(404);
  });

  it("süper admine paneli açar", async () => {
    const admin = await new HttpClient(testApp.baseUrl).login(
      // Geliştirme seed'inin süper yöneticisi (SEED_ADMIN_EMAIL verilmediğinde).
      "admin@dinlet.test",
      process.env.SEED_USER_PASSWORD!,
    );
    const response = await board(admin);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<html");
  });
});
