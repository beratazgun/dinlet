import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
} from "./support/test-app.js";

interface NotificationItem {
  type: { raw: string };
}

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const CHROME_MAC_UPDATED =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36";
const FIREFOX_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

describe("Giriş güvenliği (e2e)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  async function notificationTypes(client: HttpClient): Promise<string[]> {
    const list = await client.get<NotificationItem[]>("/notifications");
    return list.body.data!.map((item) => item.type.raw);
  }

  describe("hesap kilitleme", () => {
    it("5 başarısız denemeden sonra doğru şifreyi de 429 ile reddeder", async () => {
      const user = await createActiveUser(testApp.app);
      // Her deneme farklı IP'den: IP throttler'ını değil e-posta kilidini ölçüyoruz.
      const attempt = async (password: string) => {
        const client = new HttpClient(testApp.baseUrl);
        return client.post("/auth/login", { email: user.email, password });
      };

      for (let i = 1; i <= 4; i++) {
        expect((await attempt("Yanlis-Sifre-1")).status).toBe(422);
      }
      const fifth = await attempt("Yanlis-Sifre-1");
      expect(fifth.status).toBe(429);
      expect(Number(fifth.headers.get("retry-after"))).toBeGreaterThan(0);

      const correct = await attempt(user.password);
      expect(correct.status).toBe(429);
      expect(correct.body.message).toMatch(/dakika sonra/);
    });

    it("kayıtlı olmayan e-postayı da aynı şekilde kilitler (hesap varlığını sızdırmaz)", async () => {
      const email = `yok-${Date.now()}@example.com`;
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const client = new HttpClient(testApp.baseUrl);
        statuses.push((await client.post("/auth/login", { email, password: "x" })).status);
      }
      expect(statuses).toEqual([422, 422, 422, 422, 429]);
    });

    it("kilit kullanıcıya uygulama içi bildirim olarak düşer; şifre değişince kalkar", async () => {
      const user = await createActiveUser(testApp.app);
      // Önce bir oturum açılır (kilitlenmeden önce).
      const session = await new HttpClient(testApp.baseUrl).login(user.email, user.password);

      for (let i = 0; i < 5; i++) {
        const client = new HttpClient(testApp.baseUrl);
        await client.post("/auth/login", { email: user.email, password: "Yanlis-Sifre-1" });
      }
      await expect.poll(() => notificationTypes(session)).toContain("ACCOUNT_LOCKED");

      const newPassword = "YeniSifre123!";
      const changed = await session.patch("/auth/change-password", {
        currentPassword: user.password,
        newPassword,
        confirmPassword: newPassword,
      });
      expect(changed.status).toBe(200);

      // Kilit kaldırıldı: yeni şifreyle giriş hemen mümkün.
      await expect
        .poll(async () => {
          const client = new HttpClient(testApp.baseUrl);
          return (await client.post("/auth/login", { email: user.email, password: newPassword })).status;
        })
        .toBe(200);
    });

    it("başarılı giriş sayacı sıfırlar", async () => {
      const user = await createActiveUser(testApp.app);
      const attempt = async (password: string) => {
        const client = new HttpClient(testApp.baseUrl);
        return (await client.post("/auth/login", { email: user.email, password })).status;
      };

      for (let i = 0; i < 4; i++) expect(await attempt("Yanlis-Sifre-1")).toBe(422);
      expect(await attempt(user.password)).toBe(200);
      for (let i = 0; i < 4; i++) expect(await attempt("Yanlis-Sifre-1")).toBe(422);
    });
  });

  describe("yeni cihaz uyarısı", () => {
    it("ilk girişte uyarmaz, sürüm güncellemesini aynı cihaz sayar, yeni cihazda uyarır", async () => {
      const user = await createActiveUser(testApp.app);
      const login = (userAgent: string) =>
        new HttpClient(testApp.baseUrl, { userAgent }).login(user.email, user.password);

      const first = await login(CHROME_MAC);
      expect(await notificationTypes(first)).not.toContain("NEW_DEVICE_LOGIN");

      const updated = await login(CHROME_MAC_UPDATED);
      expect(await notificationTypes(updated)).not.toContain("NEW_DEVICE_LOGIN");

      const other = await login(FIREFOX_WINDOWS);
      await expect.poll(() => notificationTypes(other)).toContain("NEW_DEVICE_LOGIN");

      // Artık bilinen cihaz: ikinci girişte yeni uyarı yok.
      await login(FIREFOX_WINDOWS);
      const alerts = (await notificationTypes(first)).filter((type) => type === "NEW_DEVICE_LOGIN");
      expect(alerts).toHaveLength(1);
    });
  });

  describe("IP bazlı hız sınırı", () => {
    it("aynı IP'den dakikada 5'ten fazla giriş denemesini 429 ile keser", async () => {
      // Ortak IP, ama her çalıştırmada farklı: önceki koşunun sayacı karışmasın.
      const ip = new HttpClient(testApp.baseUrl).ip;
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        // Her denemede farklı e-posta: e-posta kilidi devreye girmesin.
        const client = new HttpClient(testApp.baseUrl, { ip });
        const response = await client.post("/auth/login", {
          email: `rate-${Date.now()}-${i}@example.com`,
          password: "x",
        });
        statuses.push(response.status);
      }
      expect(statuses.slice(0, 5)).toEqual([422, 422, 422, 422, 422]);
      expect(statuses[5]).toBe(429);
    });
  });
});
