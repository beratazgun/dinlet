export interface NotificationTemplateDefinition {
  code: string;
  name: string;
  subject: string;
  template: string;
  params: string[];
  sampleVariables: Record<string, unknown>;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    code: "OPS_ALERT",
    name: "Operasyon uyarısı",
    subject: "[Dinlet] {{title}}",
    template: "ops-alert.template",
    params: ["title", "details", "checkedAt"],
    sampleVariables: {
      title: "TTS Kuyruğu Uyarısı",
      details: "TTS kuyruğunda 3 iş 120 dakikadan uzun süredir bekliyor.",
      checkedAt: "09.10.2026 14:30",
    },
  },
  {
    code: "VERIFICATION_EMAIL",
    name: "E-posta doğrulama",
    subject: "Dinlet: e-posta adresinizi doğrulayın",
    template: "verification-email.template",
    params: ["name", "surname", "confirmUrl"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
      confirmUrl: "https://dinlet.app/api/v1/auth/verify-email/open?token=sample-token",
    },
  },
  {
    code: "WELCOME",
    name: "Hoş geldiniz",
    subject: "Dinlet'e hoş geldiniz, {{name}}",
    template: "welcome",
    params: ["name", "surname"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
    },
  },
  {
    code: "PASSWORD_RESET_EMAIL",
    name: "Şifre sıfırlama",
    subject: "Dinlet şifre sıfırlama talebiniz",
    template: "password-reset-email",
    params: ["userName", "resetLink", "expiresIn"],
    sampleVariables: {
      userName: "Elif Yılmaz",
      resetLink: "https://dinlet.app/api/v1/auth/reset-password/open?token=sample-token",
      expiresIn: "15 dakika",
    },
  },
  {
    code: "PASSWORD_CHANGED",
    name: "Şifre değişti",
    subject: "Dinlet şifreniz değiştirildi",
    template: "password-changed.template",
    params: ["name", "surname"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
    },
  },
  {
    code: "ACCOUNT_DELETION_EMAIL",
    name: "Hesap silme doğrulama",
    subject: "Dinlet hesap silme doğrulama kodunuz",
    template: "account-deletion-email",
    params: ["name", "surname", "code", "expiresIn"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
      code: "849201",
      expiresIn: "5 dakika",
    },
  },
  {
    code: "ACCOUNT_LOCKED",
    name: "Hesap kilitlendi",
    subject: "Dinlet hesabınız geçici olarak kilitlendi",
    template: "account-locked.template",
    params: ["name", "surname", "lockedForMinutes", "ipAddress", "resetLink"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
      lockedForMinutes: 15,
      ipAddress: "192.168.1.100",
      resetLink: "https://dinlet.app/forgot-password",
    },
  },
  {
    code: "NEW_DEVICE_LOGIN",
    name: "Yeni cihazdan giriş",
    subject: "Dinlet hesabınıza yeni bir cihazdan giriş yapıldı",
    template: "new-device-login.template",
    params: ["name", "surname", "ipAddress", "userAgent", "loggedInAt", "sessionsLink"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      loggedInAt: new Date().toISOString(),
      sessionsLink: "https://dinlet.app/settings/sessions",
    },
  },
  {
    code: "EMAIL_UPDATED_VERIFICATION",
    name: "E-posta değişikliği doğrulama",
    subject: "Dinlet: yeni e-posta adresinizi doğrulayın",
    template: "email-updated-verification",
    params: ["name", "surname", "confirmUrl"],
    sampleVariables: {
      name: "Elif",
      surname: "Yılmaz",
      confirmUrl: "https://dinlet.app/api/v1/auth/verify-email/open?token=sample-token",
    },
  },
];

export const NOTIFICATION_TEMPLATES_BY_CODE = new Map<string, NotificationTemplateDefinition>(
  NOTIFICATION_TEMPLATES.map((t) => [t.code, t]),
);
