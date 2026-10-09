/**
 * E2E ortam değişkenleri. Yalnızca tanımlı olmayanlar doldurulur; CI veya
 * yerel ortam aynı adları export ederek hepsini ezebilir. Nest ConfigModule
 * process.env'i `config/.env`'den önce okuduğu için testler geliştirme
 * veritabanına dokunmaz.
 */
const defaults: Record<string, string> = {
  NODE_ENV: "test",
  APP_NAME: "Dinlet E2E",
  // Doğrulamadan geçmesi için; testler `listen(0)` ile rastgele port kullanır.
  PORT: "3999",
  FRONTEND_URL: "http://localhost:3001",
  SERVICE_DOMAIN: "http://localhost:3000",
  DATABASE_URL:
    "postgresql://dinlet-user:dinlet-pass@localhost:5432/dinlet-test",
  SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
  SESSION_COOKIE_NAME: "sid",
  SESSION_MAX_AGE: "3600",
  REDIS_HOST: "localhost",
  REDIS_PORT: "6379",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_ACCOUNT_ID: "000000000000",
  R2_BUCKET_NAME: "dinlet-e2e",
  R2_ENDPOINT: "http://localhost:4566",
  R2_PUBLIC_ENDPOINT: "http://localhost:4566",
  R2_CDN_BASE_URL: "http://localhost:4566/dinlet-e2e",
  MAX_MEDIA_SIZE: "5242880",
  // Testler dış e-posta sağlayıcısına çıkmaz.
  EMAIL_DELIVERY: "log",
  PUSH_DELIVERY: "log",
  SEED_USER_PASSWORD: "e2e-seed-password",
  // Testler gerçek LLM'e çıkmasın (maliyet ve dış bağımlılık): anahtarsız
  // sağlayıcı zincire girmez, anlatım kural tabanlı yola düşer.
  GEMINI_API_KEY: "",
  MISTRAL_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  // Geliştiricinin `config/.env`'deki kişisel adresi testlere sızmasın.
  SEED_ADMIN_EMAIL: "admin@dinlet.test",
  REVENUECAT_WEBHOOK_AUTH: "Bearer e2e-revenuecat-secret",
  BREVO_API_KEY: "e2e-dummy",
  BREVO_FROM_EMAIL: "noreply@example.com",
  RESEND_API_KEY: "e2e-dummy",
  RESEND_FROM_EMAIL: "noreply@example.com",
  GOOGLE_CLIENT_IDS: "e2e-dummy",
  APPLE_CLIENT_IDS: "e2e-dummy",
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
