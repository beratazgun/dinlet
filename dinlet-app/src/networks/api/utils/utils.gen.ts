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
export type GetEnumOptionsApiResponse = ApiEndpoint<"/api/v1/utils/enums", "get">
export type SendTestEmailApiResponse = ApiEndpoint<"/api/v1/utils/test-email", "post">

// ===============================
// 2. API METHODS
// ===============================
/** Enum değerlerini select option formatında getirir */
export async function getEnumOptionsApi(query: GetEnumOptionsApiResponse["Query"], signal?: AbortSignal): Promise<GetEnumOptionsApiResponse["SuccessResponse"]> {
  return networkManager.get("/utils/enums", { params: query, signal })
}

/** E-posta şablonunu test et (kuyruğa ekler) */
export async function sendTestEmailApi(body: SendTestEmailApiResponse["Body"], signal?: AbortSignal): Promise<SendTestEmailApiResponse["SuccessResponse"]> {
  return networkManager.post("/utils/test-email", body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const utilsGenQueries = {
  getEnumOptions: defineQueryFactory(["utils", "enums"], (query: GetEnumOptionsApiResponse["Query"]) => defineQuery({
    queryKey: ["utils", "enums", query],
    queryFn: async ({ signal }) => getEnumOptionsApi(query, signal),
  })),
}

export const utilsGenMutations = {
  sendTestEmail: defineMutation({
    mutationKey: ["utils", "test-email", "post"],
    mutationFn: async (variables: SendTestEmailApiResponse["Body"]) => sendTestEmailApi(variables),
  }),
}
