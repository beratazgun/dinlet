import type { AuditPayload } from "#/infra/audit/types/index.js";

export const REDACTED = "[REDACTED]";

/** Bir alanın değeri (key ismine göre) asla saklanmaz. */
const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|otp|^code$|^state$|csrf/i;

/** Tek bir gövde/başlık alanının JSON olarak kaplayabileceği azami karakter. */
export const MAX_PAYLOAD_LENGTH = 16_000;

const MAX_DEPTH = 8;

/**
 * Hassas anahtarları derinlemesine `[REDACTED]` ile değiştirir.
 * (parola, token, cookie, doğrulama kodu, OAuth code/state…)
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  const isDiffItem =
    typeof (value as { field?: unknown }).field === "string" &&
    SENSITIVE_KEY.test((value as { field: string }).field);

  for (const [key, entry] of Object.entries(value)) {
    if (isDiffItem && (key === "old" || key === "new")) {
      result[key] = entry !== null && entry !== undefined ? REDACTED : entry;
    } else {
      result[key] = SENSITIVE_KEY.test(key)
        ? REDACTED
        : redactSensitive(entry, depth + 1);
    }
  }
  return result;
}

/**
 * Denetime yazılacak bir parçayı hazırlar: redakte eder, JSON-güvenli hale
 * getirir ve `MAX_PAYLOAD_LENGTH`'i aşarsa kırpılmış bir önizlemeye çevirir.
 * Boş nesneler `null` olarak saklanır.
 *
 * `redact: false` yalnızca route parametreleri içindir (ör. `:code` bir job
 * kimliğidir, gizli değildir).
 */
export function toAuditPayload(
  value: unknown,
  options: { redact?: boolean } = {},
): AuditPayload {
  if (value === undefined || value === null || value === "") return null;

  let serialized: string;
  try {
    serialized = JSON.stringify(
      options.redact === false ? value : redactSensitive(value),
    );
  } catch {
    return "[SERİLEŞTİRİLEMEDİ]";
  }
  if (serialized === undefined || serialized === "{}") return null;

  if (serialized.length > MAX_PAYLOAD_LENGTH) {
    return {
      truncated: true,
      originalLength: serialized.length,
      preview: serialized.slice(0, MAX_PAYLOAD_LENGTH),
    };
  }
  return JSON.parse(serialized) as AuditPayload;
}
