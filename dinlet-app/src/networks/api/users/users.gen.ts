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
import { defineMutation } from "@tanstack-query-craft"

// ===============================
// 1. MODELS
// ===============================
export type AcceptConsentsApiResponse = ApiEndpoint<"/api/v1/users/me/consents", "post">
export type DeleteMeApiResponse = ApiEndpoint<"/api/v1/users/me", "delete">
export type RequestAccountDeletionApiResponse = ApiEndpoint<"/api/v1/users/me/delete-request", "post">

// ===============================
// 2. API METHODS
// ===============================
/** KVKK onaylarını kaydet */
export async function acceptConsentsApi(body: AcceptConsentsApiResponse["Body"], signal?: AbortSignal): Promise<AcceptConsentsApiResponse["SuccessResponse"]> {
  return networkManager.post("/users/me/consents", body, { signal })
}

/** Hesabımı ve tüm verilerimi sil */
export async function deleteMeApi(signal?: AbortSignal): Promise<DeleteMeApiResponse["SuccessResponse"]> {
  return networkManager.delete("/users/me", { signal })
}

/** Hesap silme doğrulama kodu gönder */
export async function requestAccountDeletionApi(signal?: AbortSignal): Promise<RequestAccountDeletionApiResponse["SuccessResponse"]> {
  return networkManager.post("/users/me/delete-request", {}, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const usersGenQueries = {

}

export const usersGenMutations = {
  acceptConsents: defineMutation({
    mutationKey: ["users", "me", "consents", "post"],
    mutationFn: async (variables: AcceptConsentsApiResponse["Body"]) => acceptConsentsApi(variables),
  }),
  deleteMe: defineMutation({
    mutationKey: ["users", "me", "delete"],
    mutationFn: async () => deleteMeApi(),
  }),
  requestAccountDeletion: defineMutation({
    mutationKey: ["users", "me", "delete-request", "post"],
    mutationFn: async () => requestAccountDeletionApi(),
  }),
}
