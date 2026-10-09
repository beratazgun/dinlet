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
export type CreateDocumentApiResponse = ApiEndpoint<"/api/v1/documents", "post">
export type DeleteItemApiResponse = ApiEndpoint<"/api/v1/documents/{id}", "delete">
export type GetCoverageApiResponse = ApiEndpoint<"/api/v1/documents/{id}/coverage", "get">
export type GetDocumentApiResponse = ApiEndpoint<"/api/v1/documents/{id}", "get">
export type ListDocumentApiResponse = ApiEndpoint<"/api/v1/documents", "get">
export type PreflightApiResponse = ApiEndpoint<"/api/v1/documents/preflight", "post">
export type RenameApiResponse = ApiEndpoint<"/api/v1/documents/{id}", "patch">
export type RetryApiResponse = ApiEndpoint<"/api/v1/documents/{id}/retry", "post">

export type RenameVariables = {
  params: RenameApiResponse["PathParams"]
  body: RenameApiResponse["Body"]
}

// ===============================
// 2. API METHODS
// ===============================
/** Notu işleme al */
export async function createDocumentApi(body: CreateDocumentApiResponse["Body"], signal?: AbortSignal): Promise<CreateDocumentApiResponse["SuccessResponse"]> {
  return networkManager.post("/documents", body, { signal })
}

/** Notu sil */
export async function deleteItemApi(params: DeleteItemApiResponse["PathParams"], signal?: AbortSignal): Promise<DeleteItemApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/documents/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Kapsam güvencesi */
export async function getCoverageApi(params: GetCoverageApiResponse["PathParams"], signal?: AbortSignal): Promise<GetCoverageApiResponse["SuccessResponse"]> {
  return networkManager.get(`/documents/${encodeURIComponent(String(params.id))}/coverage`, { signal })
}

/** Not detayı, bölümler ve ilerleme */
export async function getDocumentApi(params: GetDocumentApiResponse["PathParams"], signal?: AbortSignal): Promise<GetDocumentApiResponse["SuccessResponse"]> {
  return networkManager.get(`/documents/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Notlarımı listele */
export async function listDocumentApi(query?: ListDocumentApiResponse["Query"], signal?: AbortSignal): Promise<ListDocumentApiResponse["SuccessResponse"]> {
  return networkManager.get("/documents", { params: query, signal })
}

/** Yüklenen PDF'i ön kontrol et */
export async function preflightApi(body: PreflightApiResponse["Body"], signal?: AbortSignal): Promise<PreflightApiResponse["SuccessResponse"]> {
  return networkManager.post("/documents/preflight", body, { signal })
}

/** Not başlığını değiştir */
export async function renameApi(params: RenameApiResponse["PathParams"], body: RenameApiResponse["Body"], signal?: AbortSignal): Promise<RenameApiResponse["SuccessResponse"]> {
  return networkManager.patch(`/documents/${encodeURIComponent(String(params.id))}`, body, { signal })
}

/** Başarısız bölümleri yeniden dene */
export async function retryApi(params: RetryApiResponse["PathParams"], signal?: AbortSignal): Promise<RetryApiResponse["SuccessResponse"]> {
  return networkManager.post(`/documents/${encodeURIComponent(String(params.id))}/retry`, {}, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const documentsGenQueries = {
  getCoverage: defineQueryFactory(["documents"], (params: GetCoverageApiResponse["PathParams"]) => defineQuery({
    queryKey: ["documents", params.id, "coverage"],
    queryFn: async ({ signal }) => getCoverageApi(params, signal),
  })),
  getDocument: defineQueryFactory(["documents"], (params: GetDocumentApiResponse["PathParams"]) => defineQuery({
    queryKey: ["documents", params.id],
    queryFn: async ({ signal }) => getDocumentApi(params, signal),
  })),
  listDocument: defineQueryFactory(["documents"], (query?: ListDocumentApiResponse["Query"]) => defineQuery({
    queryKey: ["documents", query],
    queryFn: async ({ signal }) => listDocumentApi(query, signal),
  })),
}

export const documentsGenMutations = {
  createDocument: defineMutation({
    mutationKey: ["documents", "post"],
    mutationFn: async (variables: CreateDocumentApiResponse["Body"]) => createDocumentApi(variables),
  }),
  deleteItem: defineMutation({
    mutationKey: ["documents", ":id", "delete"],
    mutationFn: async (variables: DeleteItemApiResponse["PathParams"]) => deleteItemApi(variables),
  }),
  preflight: defineMutation({
    mutationKey: ["documents", "preflight", "post"],
    mutationFn: async (variables: PreflightApiResponse["Body"]) => preflightApi(variables),
  }),
  rename: defineMutation({
    mutationKey: ["documents", ":id", "patch"],
    mutationFn: async (variables: RenameVariables) => renameApi(variables.params, variables.body),
  }),
  retry: defineMutation({
    mutationKey: ["documents", ":id", "retry", "post"],
    mutationFn: async (variables: RetryApiResponse["PathParams"]) => retryApi(variables),
  }),
}
