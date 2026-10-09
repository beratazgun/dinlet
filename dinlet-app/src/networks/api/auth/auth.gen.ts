/**
 * BU DOSYA OTOMATİK ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN.
 *
 * Kaynak : OpenAPI şeması
 * Üretici: scripts/generate-api-modules.mjs (pnpm api:modules)
 *
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) için
 * bu dosyanın yanındaki elle yazılan modül dosyasını kullanın.
 */

import { networkManager } from "@/lib/network-manager"
import type { ApiEndpoint } from "@/types/api/api.types"
import { defineMutation, defineQuery, defineQueryFactory } from "@tanstack-query-craft"

// ===============================
// 1. MODELS
// ===============================
export type ChangePasswordApiResponse = ApiEndpoint<"/api/v1/auth/change-password", "patch">
export type DeleteAccountApiResponse = ApiEndpoint<"/api/v1/auth/account", "delete">
export type ForgotPasswordApiResponse = ApiEndpoint<"/api/v1/auth/forgot-password", "post">
export type GetMeApiResponse = ApiEndpoint<"/api/v1/auth/me", "get">
export type ListSessionsApiResponse = ApiEndpoint<"/api/v1/auth/sessions", "get">
export type LoginApiResponse = ApiEndpoint<"/api/v1/auth/login", "post">
export type LoginWithAppleApiResponse = ApiEndpoint<"/api/v1/auth/apple/mobile", "post">
export type LoginWithGoogleApiResponse = ApiEndpoint<"/api/v1/auth/google/mobile", "post">
export type LogoutApiResponse = ApiEndpoint<"/api/v1/auth/logout", "post">
export type OpenPasswordResetLinkApiResponse = ApiEndpoint<"/api/v1/auth/reset-password/open", "get">
export type OpenVerificationLinkApiResponse = ApiEndpoint<"/api/v1/auth/verify-email/open", "get">
export type RegisterApiResponse = ApiEndpoint<"/api/v1/auth/register", "post">
export type RequestAccountDeletionApiResponse = ApiEndpoint<"/api/v1/auth/account/delete-request", "post">
export type ResendVerificationApiResponse = ApiEndpoint<"/api/v1/auth/resend-verification", "post">
export type ResetPasswordApiResponse = ApiEndpoint<"/api/v1/auth/reset-password", "post">
export type TerminateSessionsApiResponse = ApiEndpoint<"/api/v1/auth/sessions", "delete">
export type UnlinkAccountApiResponse = ApiEndpoint<"/api/v1/auth/linked-accounts/{accountId}", "delete">
export type VerifyEmailApiResponse = ApiEndpoint<"/api/v1/auth/verify-email", "post">

// ===============================
// 2. API METHODS
// ===============================
/** Şifre değiştir */
export async function changePasswordApi(body: ChangePasswordApiResponse["Body"], signal?: AbortSignal): Promise<ChangePasswordApiResponse["SuccessResponse"]> {
  return networkManager.patch("/auth/change-password", body, { signal })
}

/** Hesabı soft delete ile sil */
export async function deleteAccountApi(body: DeleteAccountApiResponse["Body"], signal?: AbortSignal): Promise<DeleteAccountApiResponse["SuccessResponse"]> {
  return networkManager.delete("/auth/account", { data: body, signal })
}

/** Şifre sıfırlama bağlantısı gönder */
export async function forgotPasswordApi(body: ForgotPasswordApiResponse["Body"], signal?: AbortSignal): Promise<ForgotPasswordApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/forgot-password", body, { signal })
}

/** Aktif kullanıcı bilgilerini getir */
export async function getMeApi(signal?: AbortSignal): Promise<GetMeApiResponse["SuccessResponse"]> {
  return networkManager.get("/auth/me", { signal })
}

/** Açık oturumları listele */
export async function listSessionsApi(query?: ListSessionsApiResponse["Query"], signal?: AbortSignal): Promise<ListSessionsApiResponse["SuccessResponse"]> {
  return networkManager.get("/auth/sessions", { params: query, signal })
}

/** Giriş */
export async function loginApi(body: LoginApiResponse["Body"], signal?: AbortSignal): Promise<LoginApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/login", body, { signal })
}

/** Apple ile giriş (mobil) */
export async function loginWithAppleApi(body: LoginWithAppleApiResponse["Body"], signal?: AbortSignal): Promise<LoginWithAppleApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/apple/mobile", body, { signal })
}

/** Google ile giriş (mobil) */
export async function loginWithGoogleApi(body: LoginWithGoogleApiResponse["Body"], signal?: AbortSignal): Promise<LoginWithGoogleApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/google/mobile", body, { signal })
}

/** Çıkış */
export async function logoutApi(signal?: AbortSignal): Promise<LogoutApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/logout", {}, { signal })
}

/** Şifre sıfırlama bağlantısını uygulamada aç (yönlendirme) */
export async function openPasswordResetLinkApi(query: OpenPasswordResetLinkApiResponse["Query"], signal?: AbortSignal): Promise<OpenPasswordResetLinkApiResponse["SuccessResponse"]> {
  return networkManager.get("/auth/reset-password/open", { params: query, signal })
}

/** Onay bağlantısını uygulamada aç (yönlendirme) */
export async function openVerificationLinkApi(query: OpenVerificationLinkApiResponse["Query"], signal?: AbortSignal): Promise<OpenVerificationLinkApiResponse["SuccessResponse"]> {
  return networkManager.get("/auth/verify-email/open", { params: query, signal })
}

/** Yeni kullanıcı kaydı */
export async function registerApi(body: RegisterApiResponse["Body"], signal?: AbortSignal): Promise<RegisterApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/register", body, { signal })
}

/** Hesap silme doğrulama kodu gönder */
export async function requestAccountDeletionApi(signal?: AbortSignal): Promise<RequestAccountDeletionApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/account/delete-request", {}, { signal })
}

/** Doğrulama emailini tekrar gönder */
export async function resendVerificationApi(body: ResendVerificationApiResponse["Body"], signal?: AbortSignal): Promise<ResendVerificationApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/resend-verification", body, { signal })
}

/** Şifre sıfırlama */
export async function resetPasswordApi(body: ResetPasswordApiResponse["Body"], signal?: AbortSignal): Promise<ResetPasswordApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/reset-password", body, { signal })
}

/** Seçili oturumları sonlandır */
export async function terminateSessionsApi(body: TerminateSessionsApiResponse["Body"], signal?: AbortSignal): Promise<TerminateSessionsApiResponse["SuccessResponse"]> {
  return networkManager.delete("/auth/sessions", { data: body, signal })
}

/** Bağlı hesabı kaldır */
export async function unlinkAccountApi(params: UnlinkAccountApiResponse["PathParams"], signal?: AbortSignal): Promise<UnlinkAccountApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/auth/linked-accounts/${encodeURIComponent(String(params.accountId))}`, { signal })
}

/** E-posta doğrulama */
export async function verifyEmailApi(body: VerifyEmailApiResponse["Body"], signal?: AbortSignal): Promise<VerifyEmailApiResponse["SuccessResponse"]> {
  return networkManager.post("/auth/verify-email", body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const authGenQueries = {
  getMe: defineQuery({
    queryKey: ["auth", "me"],
    queryFn: async ({ signal }) => getMeApi(signal),
  }),
  listSessions: defineQueryFactory(["auth", "sessions"], (query?: ListSessionsApiResponse["Query"]) => defineQuery({
    queryKey: ["auth", "sessions", query],
    queryFn: async ({ signal }) => listSessionsApi(query, signal),
  })),
  openPasswordResetLink: defineQueryFactory(["auth", "reset-password", "open"], (query: OpenPasswordResetLinkApiResponse["Query"]) => defineQuery({
    queryKey: ["auth", "reset-password", "open", query],
    queryFn: async ({ signal }) => openPasswordResetLinkApi(query, signal),
  })),
  openVerificationLink: defineQueryFactory(["auth", "verify-email", "open"], (query: OpenVerificationLinkApiResponse["Query"]) => defineQuery({
    queryKey: ["auth", "verify-email", "open", query],
    queryFn: async ({ signal }) => openVerificationLinkApi(query, signal),
  })),
}

export const authGenMutations = {
  changePassword: defineMutation({
    mutationKey: ["auth", "change-password", "patch"],
    mutationFn: async (variables: ChangePasswordApiResponse["Body"]) => changePasswordApi(variables),
  }),
  deleteAccount: defineMutation({
    mutationKey: ["auth", "account", "delete"],
    mutationFn: async (variables: DeleteAccountApiResponse["Body"]) => deleteAccountApi(variables),
  }),
  forgotPassword: defineMutation({
    mutationKey: ["auth", "forgot-password", "post"],
    mutationFn: async (variables: ForgotPasswordApiResponse["Body"]) => forgotPasswordApi(variables),
  }),
  login: defineMutation({
    mutationKey: ["auth", "login", "post"],
    mutationFn: async (variables: LoginApiResponse["Body"]) => loginApi(variables),
  }),
  loginWithApple: defineMutation({
    mutationKey: ["auth", "apple", "mobile", "post"],
    mutationFn: async (variables: LoginWithAppleApiResponse["Body"]) => loginWithAppleApi(variables),
  }),
  loginWithGoogle: defineMutation({
    mutationKey: ["auth", "google", "mobile", "post"],
    mutationFn: async (variables: LoginWithGoogleApiResponse["Body"]) => loginWithGoogleApi(variables),
  }),
  logout: defineMutation({
    mutationKey: ["auth", "logout", "post"],
    mutationFn: async () => logoutApi(),
  }),
  register: defineMutation({
    mutationKey: ["auth", "register", "post"],
    mutationFn: async (variables: RegisterApiResponse["Body"]) => registerApi(variables),
  }),
  requestAccountDeletion: defineMutation({
    mutationKey: ["auth", "account", "delete-request", "post"],
    mutationFn: async () => requestAccountDeletionApi(),
  }),
  resendVerification: defineMutation({
    mutationKey: ["auth", "resend-verification", "post"],
    mutationFn: async (variables: ResendVerificationApiResponse["Body"]) => resendVerificationApi(variables),
  }),
  resetPassword: defineMutation({
    mutationKey: ["auth", "reset-password", "post"],
    mutationFn: async (variables: ResetPasswordApiResponse["Body"]) => resetPasswordApi(variables),
  }),
  terminateSessions: defineMutation({
    mutationKey: ["auth", "sessions", "delete"],
    mutationFn: async (variables: TerminateSessionsApiResponse["Body"]) => terminateSessionsApi(variables),
  }),
  unlinkAccount: defineMutation({
    mutationKey: ["auth", "linked-accounts", ":accountId", "delete"],
    mutationFn: async (variables: UnlinkAccountApiResponse["PathParams"]) => unlinkAccountApi(variables),
  }),
  verifyEmail: defineMutation({
    mutationKey: ["auth", "verify-email", "post"],
    mutationFn: async (variables: VerifyEmailApiResponse["Body"]) => verifyEmailApi(variables),
  }),
}
