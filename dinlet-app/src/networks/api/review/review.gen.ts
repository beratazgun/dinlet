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
import { defineMutation, defineQuery } from "@tanstack-query-craft"

// ===============================
// 1. MODELS
// ===============================
export type GetReviewSessionApiResponse = ApiEndpoint<"/api/v1/me/review/session", "get">
export type GetReviewSummaryApiResponse = ApiEndpoint<"/api/v1/me/review", "get">
export type SubmitReviewApiResponse = ApiEndpoint<"/api/v1/me/review/sections/{sectionId}", "post">

export type SubmitReviewVariables = {
  params: SubmitReviewApiResponse["PathParams"]
  body: SubmitReviewApiResponse["Body"]
}

// ===============================
// 2. API METHODS
// ===============================
/** Tekrar oturumu */
export async function getReviewSessionApi(signal?: AbortSignal): Promise<GetReviewSessionApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/review/session", { signal })
}

/** Bugünkü tekrar */
export async function getReviewSummaryApi(signal?: AbortSignal): Promise<GetReviewSummaryApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/review", { signal })
}

/** Bölümün tekrar sonucunu gönder */
export async function submitReviewApi(params: SubmitReviewApiResponse["PathParams"], body: SubmitReviewApiResponse["Body"], signal?: AbortSignal): Promise<SubmitReviewApiResponse["SuccessResponse"]> {
  return networkManager.post(`/me/review/sections/${encodeURIComponent(String(params.sectionId))}`, body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const reviewGenQueries = {
  getReviewSession: defineQuery({
    queryKey: ["me", "review", "session"],
    queryFn: async ({ signal }) => getReviewSessionApi(signal),
  }),
  getReviewSummary: defineQuery({
    queryKey: ["me", "review"],
    queryFn: async ({ signal }) => getReviewSummaryApi(signal),
  }),
}

export const reviewGenMutations = {
  submitReview: defineMutation({
    mutationKey: ["me", "review", "sections", ":sectionId", "post"],
    mutationFn: async (variables: SubmitReviewVariables) => submitReviewApi(variables.params, variables.body),
  }),
}
