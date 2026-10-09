import { isAxiosError } from "axios";
import type { ApiSchema } from "@/types/api/api.types";

type ErrorBody = ApiSchema<"ErrorResDto">;

const NETWORK_ERROR_MESSAGE =
  "Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.";
const UNKNOWN_ERROR_MESSAGE = "Bir şeyler ters gitti. Lütfen tekrar dene.";

function errorBody(error: unknown): ErrorBody | undefined {
  if (!isAxiosError(error)) return undefined;
  return error.response?.data as ErrorBody | undefined;
}

/** Backend'in `data.code` alanı (ör. `EMAIL_NOT_VERIFIED`, `EMAIL_TAKEN`). */
export function getApiErrorCode(error: unknown): string | undefined {
  const code = errorBody(error)?.data?.code;
  return typeof code === "string" ? code : undefined;
}

/** Alan bazlı doğrulama hataları: `{ email: "..." }`. */
export function getApiFieldErrors(error: unknown): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const item of errorBody(error)?.errors ?? []) {
    fieldErrors[item.field] ??= item.message;
  }
  return fieldErrors;
}

/** Kullanıcıya gösterilecek tek satırlık hata mesajı. */
export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error) && !error.response) return NETWORK_ERROR_MESSAGE;
  return errorBody(error)?.message ?? UNKNOWN_ERROR_MESSAGE;
}
