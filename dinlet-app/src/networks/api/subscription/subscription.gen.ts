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
import { defineQuery } from "@tanstack-query-craft"

// ===============================
// 1. MODELS
// ===============================
export type GetMineApiResponse = ApiEndpoint<"/api/v1/me/subscription", "get">

// ===============================
// 2. API METHODS
// ===============================
/** Aboneliğim ve kotam */
export async function getMineApi(signal?: AbortSignal): Promise<GetMineApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/subscription", { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const subscriptionGenQueries = {
  getMine: defineQuery({
    queryKey: ["me", "subscription"],
    queryFn: async ({ signal }) => getMineApi(signal),
  }),
}

export const subscriptionGenMutations = {

}
