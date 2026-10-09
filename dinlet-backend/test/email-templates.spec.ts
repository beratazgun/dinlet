import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "react-email";
import { getEmailTemplate } from "#/infra/notifications/templates/index.js";

describe("Email Templates", () => {
  const templatesToTest = [
    {
      name: "verification-email.template",
      props: {
        name: "Elif",
        surname: "Yılmaz",
        confirmUrl: "https://dinlet.app/auth/verify?token=123",
      },
      expectedContent: ["E-postanı onayla", "Elif Yılmaz"],
    },
    {
      name: "email-updated-verification",
      props: {
        name: "Elif",
        surname: "Yılmaz",
        confirmUrl: "https://dinlet.app/auth/verify?token=123",
      },
      expectedContent: ["Yeni e-posta adresini onayla", "Elif Yılmaz"],
    },
    {
      name: "welcome",
      props: {
        name: "Elif",
        surname: "Yılmaz",
      },
      expectedContent: ["Notların artık kulağında!", "PDF Notunu Yükle"],
    },
    {
      name: "password-reset-email",
      props: {
        userName: "Elif",
        resetLink: "https://dinlet.app/auth/reset?token=123",
        expiresIn: "15 dakika",
      },
      expectedContent: ["Şifre Sıfırlama Talebi", "Elif", "15 dakika"],
    },
    {
      name: "password-changed.template",
      props: {
        name: "Elif",
        surname: "Yılmaz",
      },
      expectedContent: ["Şifreniz Başarıyla Güncellendi", "Şifre Güncelleme"],
    },
    {
      name: "account-deletion-email",
      props: {
        name: "Elif",
        surname: "Yılmaz",
        code: "849201",
        expiresIn: "10 dakika",
      },
      expectedContent: ["Hesap Silme Onayı", "849201", "10 dakika"],
    },
    {
      name: "account-locked.template",
      props: {
        name: "Elif",
        surname: "Yılmaz",
        lockedForMinutes: 30,
        ipAddress: "176.240.112.45",
        resetLink: "https://dinlet.app/auth/unlock?hash=123",
      },
      expectedContent: [
        "Hesabınız Geçici Olarak Kilitlendi",
        "30 dakika",
        "176.240.112.45",
      ],
    },
    {
      name: "new-device-login.template",
      props: {
        name: "Elif",
        surname: "Yılmaz",
        ipAddress: "88.241.52.19",
        userAgent: "Dinlet iOS 2.4.0",
        loggedInAt: "2025-11-12T11:32:00Z",
        sessionsLink: "https://dinlet.app/settings/sessions",
      },
      expectedContent: [
        "Yeni Cihazdan Giriş Yapıldı",
        "88.241.52.19",
        "Dinlet iOS 2.4.0",
      ],
    },
    {
      name: "ops-alert.template",
      props: {
        title: "TTS Worker Memory Alert",
        details: "Memory usage 92%",
        checkedAt: "14:45 TSİ",
      },
      expectedContent: [
        "Dinlet Ops Sentry",
        "P1 UYARI",
        "TTS Worker Memory Alert",
        "Memory usage 92%",
      ],
    },
  ];

  for (const { name, props, expectedContent } of templatesToTest) {
    it(`renders ${name} cleanly with expected design elements`, async () => {
      const Template = getEmailTemplate(name);
      expect(Template).toBeDefined();

      const html = await render(React.createElement(Template!, props));
      expect(html).toContain("<!DOCTYPE html");
      expect(html).toContain("Dinlet");

      for (const expected of expectedContent) {
        expect(html).toContain(expected);
      }
    });
  }
});
