import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseService } from "#database/database.service.js";

import { HttpClient } from "./support/http-client.js";
import { startTestApp, type TestApp } from "./support/test-app.js";

describe("Kayıt + e-posta onayı (e2e)", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const form = (overrides: Record<string, unknown> = {}) => ({
    name: "Elif",
    email: `elif-${randomUUID().slice(0, 8)}@ornek.com`,
    password: "dinletdinlet",
    privacyNoticeAccepted: true,
    termsAccepted: true,
    crossBorderTransferConsent: true,
    ...overrides,
  });

  it("zorunlu onaylar ve kısa şifre olmadan kaydı reddeder", async () => {
    const client = new HttpClient(testApp.baseUrl);
    expect((await client.post("/auth/register", form({ termsAccepted: false }))).status).toBe(400);
    expect((await client.post("/auth/register", form({ password: "kisa" }))).status).toBe(400);
  });

  it("kayıt → onay bekler → bağlantı uygulamaya yönlenir → doğrulama oturum açar", async () => {
    const body = form({ crossBorderTransferConsent: false });
    const mobile = new HttpClient(testApp.baseUrl, { deviceId: randomUUID() });

    expect((await mobile.post("/auth/register", body)).status).toBe(201);
    // Aynı e-posta ikinci kez kaydolamaz.
    const duplicate = await mobile.post("/auth/register", body);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.data).toMatchObject({ code: "EMAIL_TAKEN" });

    // Onaylanmadan giriş: uygulamanın onay ekranına yönlendirdiği kod.
    const login = await mobile.post("/auth/login", {
      email: body.email,
      password: body.password,
    });
    expect(login.status).toBe(400);
    expect(login.body.data).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    // E-postadaki https bağlantısı uygulamanın derin bağlantısına yönlenir.
    const db = testApp.app.get(DatabaseService).client;
    const user = (await db.orm.public.User.where({ email: body.email })
      .select("id", "username")
      .first())!;
    expect(user.username).toMatch(/^elif[a-z0-9]+$/);
    const token = (await db.orm.public.VerificationToken.where({ userId: user.id })
      .select("token")
      .first())!.token;
    const open = await fetch(
      `${testApp.baseUrl}/api/v1/auth/verify-email/open?token=${token}`,
      { redirect: "manual" },
    );
    expect(open.status).toBe(302);
    expect(open.headers.get("location")).toBe(`dinletapp://verify-email?token=${token}`);

    // Uygulama token'ı doğrular ve doğrudan oturum açar.
    const verified = await mobile.post<{ accessToken: string }>("/auth/verify-email", {
      token,
    });
    expect(verified.status).toBe(200);
    mobile.accessToken = verified.body.data!.accessToken;

    const me = await mobile.get<{
      email: string;
      consents: Record<string, boolean>;
    }>("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({
      email: body.email,
      consents: {
        privacyNotice: true,
        termsOfUse: true,
        crossBorderTransfer: false,
      },
    });

    // Bağlantı tek kullanımlıktır.
    expect((await mobile.post("/auth/verify-email", { token })).status).toBe(400);

    // Onaylar kayıt dışında da verilebilir (Apple / Google hesapları);
    // zorunlu metinler yine kabul edilmeli.
    expect(
      (
        await mobile.post("/users/me/consents", {
          privacyNoticeAccepted: false,
          termsAccepted: true,
          crossBorderTransferConsent: true,
        })
      ).status,
    ).toBe(400);
    const consents = await mobile.post<Record<string, boolean>>("/users/me/consents", {
      privacyNoticeAccepted: true,
      termsAccepted: true,
      crossBorderTransferConsent: true,
    });
    expect(consents.status).toBe(200);
    expect(consents.body.data).toMatchObject({ crossBorderTransfer: true });
    const meAfter = await mobile.get<{ consents: Record<string, boolean> }>("/auth/me");
    expect(meAfter.body.data?.consents.crossBorderTransfer).toBe(true);
  });

  it("şifre sıfırlama bağlantısı uygulamaya yönlenir; yeni şifre kayıtla aynı kurala uyar", async () => {
    const body = form();
    const client = new HttpClient(testApp.baseUrl, { deviceId: randomUUID() });
    expect((await client.post("/auth/register", body)).status).toBe(201);

    const db = testApp.app.get(DatabaseService).client;
    const userId = (await db.orm.public.User.where({ email: body.email })
      .select("id")
      .first())!.id;
    const verificationToken = (await db.orm.public.VerificationToken.where({
      userId,
      type: "EMAIL_VERIFICATION",
    })
      .select("token")
      .first())!.token;
    const verified = await client.post<{ accessToken: string }>("/auth/verify-email", {
      token: verificationToken,
    });
    expect(verified.status).toBe(200);
    // Sıfırlamadan önce açılmış bir oturum (ör. hesabı ele geçiren kişininki).
    const oldSession = new HttpClient(testApp.baseUrl, { deviceId: client.deviceId! });
    oldSession.accessToken = verified.body.data!.accessToken;
    expect((await oldSession.get("/auth/me")).status).toBe(200);

    expect(
      (await client.post("/auth/forgot-password", { email: body.email })).status,
    ).toBe(200);
    const token = (await db.orm.public.VerificationToken.where({
      userId,
      type: "PASSWORD_RESET",
    })
      .select("token")
      .first())!.token;

    const open = await fetch(
      `${testApp.baseUrl}/api/v1/auth/reset-password/open?token=${token}`,
      { redirect: "manual" },
    );
    expect(open.status).toBe(302);
    expect(open.headers.get("location")).toBe(`dinletapp://reset-password?token=${token}`);

    // Kayıttaki kural: 8+ karakter, karakter sınıfı zorunluluğu yok.
    const tooShort = await client.post("/auth/reset-password", {
      token,
      newPassword: "kisa",
      confirmPassword: "kisa",
    });
    expect(tooShort.status).toBe(400);
    const reset = await client.post("/auth/reset-password", {
      token,
      newPassword: "yenisifrem",
      confirmPassword: "yenisifrem",
    });
    expect(reset.status).toBe(200);
    // Sıfırlama açık oturumların hepsini kapatır.
    expect((await oldSession.get("/auth/me")).status).toBe(401);

    const login = await client.post<{ accessToken: string }>("/auth/login", {
      email: body.email,
      password: "yenisifrem",
    });
    expect(login.status).toBe(200);
    expect(login.body.data?.accessToken).toBeTruthy();
  });

  it("KVKK metinlerini onay sürümüyle sunar", async () => {
    const client = new HttpClient(testApp.baseUrl);
    const notice = await client.get<{
      title: string;
      version: string;
      sections: { heading: string; body: string[] }[];
    }>("/legal/privacy-notice");
    expect(notice.status).toBe(200);
    expect(notice.body.data).toMatchObject({
      title: "Aydınlatma Metni",
      version: "2026-10-01",
    });
    expect(notice.body.data!.sections.length).toBeGreaterThan(3);
    expect((await client.get("/legal/terms-of-use")).status).toBe(200);
    expect((await client.get("/legal/cross-border-transfer")).status).toBe(200);
    expect((await client.get("/legal/bilinmeyen")).status).toBe(400);
  });
});
