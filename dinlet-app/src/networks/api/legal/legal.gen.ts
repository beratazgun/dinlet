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
import { defineQuery, defineQueryFactory } from "@tanstack-query-craft"

// ===============================
// 1. MODELS
// ===============================
export type GetDocumentApiResponse = ApiEndpoint<"/api/v1/legal/{document}", "get">

// ===============================
// 2. API METHODS
// ===============================
/** KVKK / kullanım metni */
export async function getDocumentApi(params: GetDocumentApiResponse["PathParams"], signal?: AbortSignal): Promise<GetDocumentApiResponse["SuccessResponse"]> {
  return networkManager.get(`/legal/${encodeURIComponent(String(params.document))}`, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const legalGenQueries = {
  getDocument: defineQueryFactory(["legal"], (params: GetDocumentApiResponse["PathParams"]) => defineQuery({
    queryKey: ["legal", params.document],
    queryFn: async ({ signal }) => getDocumentApi(params, signal),
  })),
}

export const legalGenMutations = {

}
