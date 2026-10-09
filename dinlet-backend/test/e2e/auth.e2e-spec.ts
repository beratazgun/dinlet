import { randomUUID } from "node:crypto";

import { io } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./support/test-app.js";

describe("Auth (e2e)", () => {
  let testApp: TestApp;
  let user: TestUser;

  beforeAll(async () => {
    testApp = await startTestApp();
    user = await createActiveUser(testApp.app);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("cookie ile giriş yapar, /auth/me döner ve çıkış yapar", async () => {
    const client = new HttpClient(testApp.baseUrl);

    const login = await client.post<{ accessToken?: string }>("/auth/login", {
      email: user.email,
      password: user.password,
    });
    expect(login.status).toBe(200);
    // Tarayıcıda oturum kimliği gövdede dönmez.
    expect(login.body.data!.accessToken).toBeUndefined();

    const me = await client.get<{ id: number; email: string }>("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: user.id, email: user.email });

    const logout = await client.post("/auth/logout");
    expect(logout.status).toBe(200);

    const afterLogout = await client.get("/auth/me");
    expect(afterLogout.status).toBe(401);
  });

  describe("mobil (Bearer)", () => {
    it("X-Client: mobile ile accessToken döner ve Bearer ile oturum açılır", async () => {
      const client = await new HttpClient(testApp.baseUrl, {
        deviceId: randomUUID(),
      }).login(user.email, user.password);
      expect(client.accessToken).toBeTruthy();

      const me = await client.get<{ id: number }>("/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.data!.id).toBe(user.id);

      const logout = await client.post("/auth/logout");
      expect(logout.status).toBe(200);
      expect((await client.get("/auth/me")).status).toBe(401);
    });

    it("cihaz kimliği olmadan mobil girişi reddeder", async () => {
      const response = await new HttpClient(testApp.baseUrl).request(
        "POST",
        "/auth/login",
        { email: user.email, password: user.password },
      );
      expect(response.status).toBe(200);

      const mobileWithoutDevice = await fetch(
        `${testApp.baseUrl}/api/v1/auth/login`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-client": "mobile",
            "x-forwarded-for": "10.9.9.9",
          },
          body: JSON.stringify({ email: user.email, password: user.password }),
        },
      );
      expect(mobileWithoutDevice.status).toBe(400);
    });

    it("token başka bir cihazda kullanılırsa oturumu düşürür", async () => {
      const owner = await new HttpClient(testApp.baseUrl, {
        deviceId: randomUUID(),
      }).login(user.email, user.password);

      const thief = new HttpClient(testApp.baseUrl, { deviceId: randomUUID() });
      thief.accessToken = owner.accessToken;

      expect((await thief.get("/auth/me")).status).toBe(401);
      // Oturum store'dan silindiği için sahibi de artık giremez.
      expect((await owner.get("/auth/me")).status).toBe(401);
    });

    it("Socket.IO'ya auth.token + deviceId ile bağlanır, başka cihazla bağlanamaz", async () => {
      const client = await new HttpClient(testApp.baseUrl, {
        deviceId: randomUUID(),
      }).login(user.email, user.password);

      const outcome = (deviceId: string) =>
        new Promise<"connect" | "connect_error">((resolve) => {
          const socket = io(`${testApp.baseUrl}/notifications`, {
            transports: ["websocket"],
            reconnection: false,
            auth: { token: client.accessToken, deviceId },
          });
          socket.once("connect", () => {
            socket.disconnect();
            resolve("connect");
          });
          socket.once("connect_error", () => {
            socket.disconnect();
            resolve("connect_error");
          });
        });

      expect(await outcome(client.deviceId!)).toBe("connect");
      expect(await outcome(randomUUID())).toBe("connect_error");
    });

    it("geçersiz imzalı token'ı kabul etmez", async () => {
      const client = new HttpClient(testApp.baseUrl, {
        deviceId: randomUUID(),
      });
      client.accessToken = "sahte.token";
      expect((await client.get("/auth/me")).status).toBe(401);
    });
  });
});
