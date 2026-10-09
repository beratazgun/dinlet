import { Transform, plainToInstance } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from "class-validator";

const NodeEnvironment = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

type NodeEnvironment = (typeof NodeEnvironment)[keyof typeof NodeEnvironment];

const ToInteger = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string" || value.trim() === "") return value;

    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) ? parsedValue : value;
  });

/** `.env`'de boş bırakılan (`KEY=`) isteğe bağlı değer tanımsız sayılır. */
const EmptyToUndefined = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  );

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV!: NodeEnvironment;

  @IsString()
  @IsNotEmpty()
  APP_NAME!: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @ToInteger()
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT!: number;

  // İstek zaman aşımı (ms). Verilmezse 10 sn varsayılır.
  @ToInteger()
  @IsInt()
  @Min(1)
  @IsOptional()
  REQUEST_TIMEOUT_MS: number = 10_000;

  @IsString()
  @IsNotEmpty()
  SERVICE_DOMAIN!: string;

  // Mobil uygulamanın URL şeması (app.json `scheme`). E-postadaki onay
  // bağlantısı `<şema>://verify-email?token=…` adresine yönlenir.
  @IsString()
  @IsOptional()
  APP_DEEP_LINK_SCHEME: string = "dinletapp";

  // @fastify/session cookie imzalama anahtarı. Plugin 32 karakterden kısa
  // secret'ı reddettiği için minimum uzunluk burada da zorunlu tutulur.
  @IsString()
  @MinLength(32, {
    message: "SESSION_SECRET en az 32 karakter olmalıdır",
  })
  SESSION_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  SESSION_COOKIE_NAME!: string;

  // Oturum ömrü (saniye). `rolling: true` sayesinde her istekte sıfırlanır.
  @ToInteger()
  @IsInt()
  @Min(1)
  SESSION_MAX_AGE!: number;

  // Mobil oturum ömrü (saniye). Kullanıcı sık sık yeniden giriş yapmasın diye
  // web'den uzun tutulur. Verilmezse 30 gün.
  @ToInteger()
  @IsInt()
  @Min(1)
  @IsOptional()
  SESSION_MAX_AGE_MOBILE: number = 2_592_000;

  @IsString()
  @IsNotEmpty()
  R2_ACCESS_KEY_ID!: string;

  @IsString()
  @IsNotEmpty()
  R2_SECRET_ACCESS_KEY!: string;

  @IsString()
  @IsNotEmpty()
  R2_ACCOUNT_ID!: string;

  @IsString()
  @IsNotEmpty()
  R2_BUCKET_NAME!: string;

  @IsString()
  @IsNotEmpty()
  R2_ENDPOINT!: string;

  // Browser'a sunulan presigned URL'lerin hostname'i için. Boşsa R2_ENDPOINT kullanılır.
  @IsString()
  @IsOptional()
  R2_PUBLIC_ENDPOINT?: string;

  @IsString()
  @IsNotEmpty()
  R2_CDN_BASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  MAX_MEDIA_SIZE!: string;

  @IsString()
  @IsNotEmpty()
  BREVO_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  BREVO_FROM_EMAIL!: string;

  @IsString()
  @IsOptional()
  BREVO_FROM_NAME?: string;

  @IsEmail()
  @IsOptional()
  BREVO_MAIL_FOR_DEV_ENV?: string;

  // `log`: e-postalar sağlayıcıya gönderilmez, yalnızca loglanır (test/yerel).
  @IsIn(["send", "log"])
  @IsOptional()
  EMAIL_DELIVERY: "send" | "log" = "send";

  // `log`: push bildirimleri Expo'ya gönderilmez, yalnızca loglanır (test/yerel).
  @IsIn(["send", "log"])
  @IsOptional()
  PUSH_DELIVERY: "send" | "log" = "send";

  // Expo push erişim token'ı (projede "enhanced security" açıksa zorunlu).
  @IsString()
  @IsOptional()
  EXPO_ACCESS_TOKEN?: string;

  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  RESEND_FROM_EMAIL!: string;

  @IsEmail()
  @IsOptional()
  RESEND_MAIL_FOR_DEV_ENV?: string;

  // Mobil Google Sign-In `idToken`'larının kabul edilen `aud` değerleri
  // (iOS, Android ve web client ID'leri; virgülle ayrılır).
  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_IDS!: string;

  // Sign in with Apple `identityToken`'larının kabul edilen `aud` değerleri
  // (uygulamanın bundle ID'si; birden fazlaysa virgülle).
  @IsString()
  @IsNotEmpty()
  APPLE_CLIENT_IDS!: string;

  // LLM sağlayıcı zinciri (Pro planda akıcı anlatım). Sırayla denenir;
  // kotası biten/hata veren sağlayıcıdan sonrakine geçilir. Anahtarı boş
  // sağlayıcı zincirden düşer; hepsi boşsa Pro notlar da LLM'siz işlenir.
  @IsString()
  @IsOptional()
  LLM_PROVIDER_CHAIN: string = "gemini,mistral,anthropic";

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  // Sağlayıcı içinde sırayla denenecek modeller (virgülle).
  @IsString()
  @IsOptional()
  GEMINI_LLM_MODELS: string =
    "gemini-flash-lite-latest,gemini-2.5-flash-lite,gemini-flash-latest,gemini-2.5-flash";

  @IsString()
  @IsOptional()
  MISTRAL_API_KEY?: string;

  @IsString()
  @IsOptional()
  MISTRAL_LLM_MODELS: string = "mistral-small-latest,mistral-medium-latest";

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_LLM_MODELS: string = "claude-haiku-5-5";

  // Kota (429) dolan model, sağlayıcı süre bildirmezse bu kadar dinlendirilir.
  @ToInteger()
  @IsInt()
  @Min(1)
  @IsOptional()
  LLM_QUOTA_COOLDOWN_SECONDS: number = 60;

  // Yalnızca Claude için (low | medium | high | xhigh | max).
  @IsIn(["low", "medium", "high", "xhigh", "max"])
  @IsOptional()
  LLM_EFFORT: "low" | "medium" | "high" | "xhigh" | "max" = "low";

  @ToInteger()
  @IsInt()
  @Min(1_024)
  @IsOptional()
  LLM_MAX_TOKENS: number = 16_000;

  // Bir belgenin bölümleri için aynı anda yapılan LLM çağrısı sayısı.
  @ToInteger()
  @IsInt()
  @Min(1)
  @IsOptional()
  LLM_CONCURRENCY: number = 3;

  // RevenueCat webhook'unun `Authorization` başlığına yazılan gizli değer.
  // Boşsa webhook tüm istekleri reddeder.
  @IsString()
  @IsOptional()
  REVENUECAT_WEBHOOK_AUTH?: string;

  // Verilirse webhook sonrası abonenin güncel durumu REST API'den okunur.
  @IsString()
  @IsOptional()
  REVENUECAT_API_KEY?: string;

  // Pro planı veren RevenueCat entitlement kimliği.
  @IsString()
  @IsOptional()
  REVENUECAT_PRO_ENTITLEMENT: string = "pro";

  // KVKK metinlerindeki veri sorumlusu (GET /legal/:document). Boşsa metinde
  // köşeli parantezli yer tutucu görünür; production'dan önce doldurulmalı.
  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  LEGAL_CONTROLLER_NAME?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  LEGAL_CONTROLLER_ADDRESS?: string;

  @EmptyToUndefined()
  @IsEmail()
  @IsOptional()
  LEGAL_CONTACT_EMAIL?: string;

  // Kuyruk alarmlarının (DLQ, uzun bekleme) gideceği adres. Boşsa alarm kapalı.
  @EmptyToUndefined()
  @IsEmail()
  @IsOptional()
  ALERT_EMAIL?: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_PORT!: string;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // NestJS Observe — ikisi de verilirse observability açılır.
  @IsString()
  @IsOptional()
  OBSERVE_APP_KEY?: string;

  @IsString()
  @IsOptional()
  OBSERVE_APP_SECRET?: string;

  // Panelde servisi ayırt eden ad. Verilmezse APP_NAME kullanılır.
  @IsString()
  @IsOptional()
  OBSERVE_SERVICE_ID?: string;

  // Gönderilecek trace oranı (0–1). Verilmezse 1 (hepsi).
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && value.trim() !== "" ? Number(value) : value,
  )
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  OBSERVE_TRACES_SAMPLE_RATE?: number;
}

export function validateEnv(config: Record<string, unknown>): EnvType {
  const environment = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(environment, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const details = errors.map(({ property, constraints }) => ({
      property,
      messages: constraints ? Object.values(constraints) : [],
    }));
    throw new Error(`Env validation error ---> ${JSON.stringify(details)}`);
  }

  return environment;
}

export type EnvType = EnvironmentVariables;
