/**
 * Merkezi Redis key tanımları.
 *
 * Yeni bir cache eklemek için sadece iki yere birer satır ekle:
 * `REDIS_KEY_PREFIX` (key öneki) ve `REDIS_KEY_TTL` (saniye cinsinden TTL).
 */

export const REDIS_KEY_PREFIX = {
  PUBLIC_ME: "public:me",
  ROLE_PERMISSIONS: "role:permissions",
  ACCOUNT_DELETION_CODE: "account:deletion:code",
  /** `@fastify/session` store kaydı: `session:<sessionId>`. */
  SESSION: "session",
  /** Kullanıcının açık oturum id'lerini tutan set: `user:sessions:<userId>`. */
  USER_SESSIONS: "user:sessions",
  /** Tamamlanmamış medya yüklemesi: `media:upload:<uploadId>`. */
  PENDING_MEDIA_UPLOAD: "media:upload",
  /** Başarısız giriş sayacı: `auth:login:failures:<emailHash>`. */
  LOGIN_FAILURES: "auth:login:failures",
  /** Geçici giriş kilidi: `auth:login:lock:<emailHash>`. */
  LOGIN_LOCK: "auth:login:lock",
  /** Kullanıcının daha önce giriş yaptığı cihazlar: `user:devices:<userId>`. */
  KNOWN_DEVICES: "user:devices",
  /** Kullanıcı başına kota kilidi (eşzamanlı yüklemeler): `quota:lock:<userId>`. */
  QUOTA_LOCK: "quota:lock",
  /** Kuyruk sağlığı kontrolünün son çalıştığı an (ms): `ops:queue-alert:checked:<scope>`. */
  QUEUE_ALERT_CHECKED: "ops:queue-alert:checked",
  /** Aynı bekleme uyarısının tekrarını susturur: `ops:queue-alert:wait:<queue>`. */
  QUEUE_ALERT_WAIT: "ops:queue-alert:wait",
} as const;

export const REDIS_KEY_TTL: Record<RedisKeyName, number> = {
  PUBLIC_ME: 5 * 60,
  ROLE_PERMISSIONS: 24 * 60 * 60,
  ACCOUNT_DELETION_CODE: 5 * 60,
  // Oturum TTL'i cookie'nin kalan ömründen hesaplanır; buradaki değer
  // yalnızca hesaplama yapılamadığında devreye giren güvenli tavandır.
  SESSION: 7 * 24 * 60 * 60,
  USER_SESSIONS: 7 * 24 * 60 * 60,
  PENDING_MEDIA_UPLOAD: 60 * 60,
  // Sayaç ve kilit süreleri `login-lockout.policy.ts`'ten verilir; bunlar tavandır.
  LOGIN_FAILURES: 15 * 60,
  LOGIN_LOCK: 15 * 60,
  // Her girişte tazelenir; 180 gün görülmeyen cihaz yeniden "yeni" sayılır.
  KNOWN_DEVICES: 180 * 24 * 60 * 60,
  // Kilit tutan istek çökerse kilit en geç bu sürede kendiliğinden düşer.
  QUOTA_LOCK: 30,
  QUEUE_ALERT_CHECKED: 24 * 60 * 60,
  // Uzun bekleme uyarısı en fazla saatte bir gider.
  QUEUE_ALERT_WAIT: 60 * 60,
};

export type RedisKeyName = keyof typeof REDIS_KEY_PREFIX;

/**
 * Her key ailesi için beklenen structured parametreler.
 * `RedisService.clear` bu sayede yanlış key/param eşleşmesini derleme
 * zamanında yakalar.
 */
export interface RedisKeyParams {
  PUBLIC_ME: { userId: number };
  ROLE_PERMISSIONS: { roleId: number };
  ACCOUNT_DELETION_CODE: { userId: number };
  SESSION: { sessionId: string };
  USER_SESSIONS: { userId: number };
  PENDING_MEDIA_UPLOAD: { uploadId: string };
  LOGIN_FAILURES: { emailHash: string };
  LOGIN_LOCK: { emailHash: string };
  KNOWN_DEVICES: { userId: number };
  QUOTA_LOCK: { userId: number };
  QUEUE_ALERT_CHECKED: { scope: string };
  QUEUE_ALERT_WAIT: { queue: string };
}

/** Structured params → key suffix dönüşümü (key üretiminin tek merkezi). */
export const REDIS_KEY_SUFFIX: {
  [K in RedisKeyName]: (params: RedisKeyParams[K]) => string | number;
} = {
  PUBLIC_ME: (p) => p.userId,
  ROLE_PERMISSIONS: (p) => p.roleId,
  ACCOUNT_DELETION_CODE: (p) => p.userId,
  SESSION: (p) => p.sessionId,
  USER_SESSIONS: (p) => p.userId,
  PENDING_MEDIA_UPLOAD: (p) => p.uploadId,
  LOGIN_FAILURES: (p) => p.emailHash,
  LOGIN_LOCK: (p) => p.emailHash,
  KNOWN_DEVICES: (p) => p.userId,
  QUOTA_LOCK: (p) => p.userId,
  QUEUE_ALERT_CHECKED: (p) => p.scope,
  QUEUE_ALERT_WAIT: (p) => p.queue,
};

/**
 * Tip-güvenli cache silme girdisi: seçilen `key`'e göre `params` tipi zorunlu
 * olarak eşleşir (ör. `PUBLIC_ME` → `{ userId }`).
 */
export type RedisCacheClearEntry = {
  [K in RedisKeyName]: { key: K; params: RedisKeyParams[K] };
}[RedisKeyName];

/**
 * Tip-güvenli Redis key. `RedisService.createKey` üzerinden üretilir.
 */
export class RedisKey {
  private constructor(
    readonly name: RedisKeyName,
    readonly full: string,
    readonly ttl: number,
  ) {}

  static create(name: RedisKeyName, suffix: string | number): RedisKey {
    return new RedisKey(
      name,
      `${REDIS_KEY_PREFIX[name]}:${suffix}`,
      REDIS_KEY_TTL[name],
    );
  }

  toString(): string {
    return this.full;
  }
}

/**
 * Bir key ailesinin tamamını hedefleyen glob pattern'i döndürür
 * (ör. `deleteByPattern` ile toplu silme için).
 */
export function redisKeyPattern(name: RedisKeyName): string {
  return `${REDIS_KEY_PREFIX[name]}:*`;
}
