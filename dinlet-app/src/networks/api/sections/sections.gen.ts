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
export type GetSectionApiResponse = ApiEndpoint<"/api/v1/sections/{id}", "get">
export type ListContinueApiResponse = ApiEndpoint<"/api/v1/me/continue", "get">
export type RegenerateApiResponse = ApiEndpoint<"/api/v1/sections/{id}/regenerate", "post">
export type SaveProgressApiResponse = ApiEndpoint<"/api/v1/sections/{id}/progress", "put">

export type SaveProgressVariables = {
  params: SaveProgressApiResponse["PathParams"]
  body: SaveProgressApiResponse["Body"]
}

// ===============================
// 2. API METHODS
// ===============================
/** Bölüm detayı */
export async function getSectionApi(params: GetSectionApiResponse["PathParams"], signal?: AbortSignal): Promise<GetSectionApiResponse["SuccessResponse"]> {
  return networkManager.get(`/sections/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Kaldığın yerden devam et */
export async function listContinueApi(query?: ListContinueApiResponse["Query"], signal?: AbortSignal): Promise<ListContinueApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/continue", { params: query, signal })
}

/** Bölümü yeniden üret */
export async function regenerateApi(params: RegenerateApiResponse["PathParams"], signal?: AbortSignal): Promise<RegenerateApiResponse["SuccessResponse"]> {
  return networkManager.post(`/sections/${encodeURIComponent(String(params.id))}/regenerate`, {}, { signal })
}

/** Dinleme konumunu kaydet */
export async function saveProgressApi(params: SaveProgressApiResponse["PathParams"], body: SaveProgressApiResponse["Body"], signal?: AbortSignal): Promise<SaveProgressApiResponse["SuccessResponse"]> {
  return networkManager.put(`/sections/${encodeURIComponent(String(params.id))}/progress`, body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const sectionsGenQueries = {
  getSection: defineQueryFactory(["sections"], (params: GetSectionApiResponse["PathParams"]) => defineQuery({
    queryKey: ["sections", params.id],
    queryFn: async ({ signal }) => getSectionApi(params, signal),
  })),
  listContinue: defineQueryFactory(["me", "continue"], (query?: ListContinueApiResponse["Query"]) => defineQuery({
    queryKey: ["me", "continue", query],
    queryFn: async ({ signal }) => listContinueApi(query, signal),
  })),
}

export const sectionsGenMutations = {
  regenerate: defineMutation({
    mutationKey: ["sections", ":id", "regenerate", "post"],
    mutationFn: async (variables: RegenerateApiResponse["PathParams"]) => regenerateApi(variables),
  }),
  saveProgress: defineMutation({
    mutationKey: ["sections", ":id", "progress", "put"],
    mutationFn: async (variables: SaveProgressVariables) => saveProgressApi(variables.params, variables.body),
  }),
}
