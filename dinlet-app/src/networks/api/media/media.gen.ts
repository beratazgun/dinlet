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
export type CompleteUploadApiResponse = ApiEndpoint<"/api/v1/media/uploads/{uploadId}/complete", "post">
export type CreateUploadApiResponse = ApiEndpoint<"/api/v1/media/uploads", "post">
export type DeleteItemApiResponse = ApiEndpoint<"/api/v1/media/{id}", "delete">
export type GetMediaApiResponse = ApiEndpoint<"/api/v1/media/{id}", "get">
export type ListMediaApiResponse = ApiEndpoint<"/api/v1/media", "get">

// ===============================
// 2. API METHODS
// ===============================
/** Yüklemeyi tamamla */
export async function completeUploadApi(params: CompleteUploadApiResponse["PathParams"], signal?: AbortSignal): Promise<CompleteUploadApiResponse["SuccessResponse"]> {
  return networkManager.post(`/media/uploads/${encodeURIComponent(String(params.uploadId))}/complete`, {}, { signal })
}

/** Yükleme URL'i al */
export async function createUploadApi(body: CreateUploadApiResponse["Body"], signal?: AbortSignal): Promise<CreateUploadApiResponse["SuccessResponse"]> {
  return networkManager.post("/media/uploads", body, { signal })
}

/** Medyayı sil */
export async function deleteItemApi(params: DeleteItemApiResponse["PathParams"], signal?: AbortSignal): Promise<DeleteItemApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/media/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Medyayı getir */
export async function getMediaApi(params: GetMediaApiResponse["PathParams"], signal?: AbortSignal): Promise<GetMediaApiResponse["SuccessResponse"]> {
  return networkManager.get(`/media/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Medyalarımı listele */
export async function listMediaApi(query?: ListMediaApiResponse["Query"], signal?: AbortSignal): Promise<ListMediaApiResponse["SuccessResponse"]> {
  return networkManager.get("/media", { params: query, signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const mediaGenQueries = {
  getMedia: defineQueryFactory(["media"], (params: GetMediaApiResponse["PathParams"]) => defineQuery({
    queryKey: ["media", params.id],
    queryFn: async ({ signal }) => getMediaApi(params, signal),
  })),
  listMedia: defineQueryFactory(["media"], (query?: ListMediaApiResponse["Query"]) => defineQuery({
    queryKey: ["media", query],
    queryFn: async ({ signal }) => listMediaApi(query, signal),
  })),
}

export const mediaGenMutations = {
  completeUpload: defineMutation({
    mutationKey: ["media", "uploads", ":uploadId", "complete", "post"],
    mutationFn: async (variables: CompleteUploadApiResponse["PathParams"]) => completeUploadApi(variables),
  }),
  createUpload: defineMutation({
    mutationKey: ["media", "uploads", "post"],
    mutationFn: async (variables: CreateUploadApiResponse["Body"]) => createUploadApi(variables),
  }),
  deleteItem: defineMutation({
    mutationKey: ["media", ":id", "delete"],
    mutationFn: async (variables: DeleteItemApiResponse["PathParams"]) => deleteItemApi(variables),
  }),
}
