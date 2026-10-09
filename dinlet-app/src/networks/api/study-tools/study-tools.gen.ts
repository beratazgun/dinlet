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
export type ListMnemonicsApiResponse = ApiEndpoint<"/api/v1/documents/{id}/mnemonics", "get">
export type RequestMnemonicsApiResponse = ApiEndpoint<"/api/v1/documents/{id}/mnemonics", "post">
export type RequestQuickApiResponse = ApiEndpoint<"/api/v1/documents/{id}/quick", "post">
export type UpdateMnemonicApiResponse = ApiEndpoint<"/api/v1/mnemonics/{id}", "patch">

export type UpdateMnemonicVariables = {
  params: UpdateMnemonicApiResponse["PathParams"]
  body: UpdateMnemonicApiResponse["Body"]
}

// ===============================
// 2. API METHODS
// ===============================
/** Hafıza kancaları */
export async function listMnemonicsApi(params: ListMnemonicsApiResponse["PathParams"], signal?: AbortSignal): Promise<ListMnemonicsApiResponse["SuccessResponse"]> {
  return networkManager.get(`/documents/${encodeURIComponent(String(params.id))}/mnemonics`, { signal })
}

/** Hafıza kancası öner */
export async function requestMnemonicsApi(params: RequestMnemonicsApiResponse["PathParams"], signal?: AbortSignal): Promise<RequestMnemonicsApiResponse["SuccessResponse"]> {
  return networkManager.post(`/documents/${encodeURIComponent(String(params.id))}/mnemonics`, {}, { signal })
}

/** Hızlı tekrar sürümünü hazırla */
export async function requestQuickApi(params: RequestQuickApiResponse["PathParams"], signal?: AbortSignal): Promise<RequestQuickApiResponse["SuccessResponse"]> {
  return networkManager.post(`/documents/${encodeURIComponent(String(params.id))}/quick`, {}, { signal })
}

/** Hafıza kancasını sakla / kaldır */
export async function updateMnemonicApi(params: UpdateMnemonicApiResponse["PathParams"], body: UpdateMnemonicApiResponse["Body"], signal?: AbortSignal): Promise<UpdateMnemonicApiResponse["SuccessResponse"]> {
  return networkManager.patch(`/mnemonics/${encodeURIComponent(String(params.id))}`, body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const studyToolsGenQueries = {
  listMnemonics: defineQueryFactory(["documents"], (params: ListMnemonicsApiResponse["PathParams"]) => defineQuery({
    queryKey: ["documents", params.id, "mnemonics"],
    queryFn: async ({ signal }) => listMnemonicsApi(params, signal),
  })),
}

export const studyToolsGenMutations = {
  requestMnemonics: defineMutation({
    mutationKey: ["documents", ":id", "mnemonics", "post"],
    mutationFn: async (variables: RequestMnemonicsApiResponse["PathParams"]) => requestMnemonicsApi(variables),
  }),
  requestQuick: defineMutation({
    mutationKey: ["documents", ":id", "quick", "post"],
    mutationFn: async (variables: RequestQuickApiResponse["PathParams"]) => requestQuickApi(variables),
  }),
  updateMnemonic: defineMutation({
    mutationKey: ["mnemonics", ":id", "patch"],
    mutationFn: async (variables: UpdateMnemonicVariables) => updateMnemonicApi(variables.params, variables.body),
  }),
}
