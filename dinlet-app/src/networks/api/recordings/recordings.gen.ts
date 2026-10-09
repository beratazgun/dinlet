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
export type GetRecordingApiResponse = ApiEndpoint<"/api/v1/sections/{id}/recording", "get">
export type GetVoiceApiResponse = ApiEndpoint<"/api/v1/me/voice", "get">
export type ListRecordingsApiResponse = ApiEndpoint<"/api/v1/me/recordings", "get">
export type RecordingSummaryApiResponse = ApiEndpoint<"/api/v1/me/recordings/summary", "get">
export type RemoveRecordingApiResponse = ApiEndpoint<"/api/v1/sections/{id}/recording", "delete">
export type SaveClipApiResponse = ApiEndpoint<"/api/v1/sections/{id}/recording/clips/{position}", "put">
export type UpdateRecordingApiResponse = ApiEndpoint<"/api/v1/sections/{id}/recording", "patch">
export type UpdateVoiceApiResponse = ApiEndpoint<"/api/v1/me/voice", "put">

export type SaveClipVariables = {
  params: SaveClipApiResponse["PathParams"]
  body: SaveClipApiResponse["Body"]
  query: SaveClipApiResponse["Query"]
}

export type UpdateRecordingVariables = {
  params: UpdateRecordingApiResponse["PathParams"]
  body: UpdateRecordingApiResponse["Body"]
}

// ===============================
// 2. API METHODS
// ===============================
/** Bölüm kaydı */
export async function getRecordingApi(params: GetRecordingApiResponse["PathParams"], signal?: AbortSignal): Promise<GetRecordingApiResponse["SuccessResponse"]> {
  return networkManager.get(`/sections/${encodeURIComponent(String(params.id))}/recording`, { signal })
}

/** Ses tercihi */
export async function getVoiceApi(signal?: AbortSignal): Promise<GetVoiceApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/voice", { signal })
}

/** Kayıtlarım */
export async function listRecordingsApi(query?: ListRecordingsApiResponse["Query"], signal?: AbortSignal): Promise<ListRecordingsApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/recordings", { params: query, signal })
}

/** Kayıtlarım özeti */
export async function recordingSummaryApi(signal?: AbortSignal): Promise<RecordingSummaryApiResponse["SuccessResponse"]> {
  return networkManager.get("/me/recordings/summary", { signal })
}

/** Kaydı sil */
export async function removeRecordingApi(params: RemoveRecordingApiResponse["PathParams"], signal?: AbortSignal): Promise<RemoveRecordingApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/sections/${encodeURIComponent(String(params.id))}/recording`, { signal })
}

/** Paragraf kaydını yükle */
export async function saveClipApi(params: SaveClipApiResponse["PathParams"], body: SaveClipApiResponse["Body"], query: SaveClipApiResponse["Query"], signal?: AbortSignal): Promise<SaveClipApiResponse["SuccessResponse"]> {
  return networkManager.put(`/sections/${encodeURIComponent(String(params.id))}/recording/clips/${encodeURIComponent(String(params.position))}`, body, { params: query, signal })
}

/** Kaydı kaydet / bu bölümde hangi ses çalsın */
export async function updateRecordingApi(params: UpdateRecordingApiResponse["PathParams"], body: UpdateRecordingApiResponse["Body"], signal?: AbortSignal): Promise<UpdateRecordingApiResponse["SuccessResponse"]> {
  return networkManager.patch(`/sections/${encodeURIComponent(String(params.id))}/recording`, body, { signal })
}

/** Ses tercihini değiştir */
export async function updateVoiceApi(body: UpdateVoiceApiResponse["Body"], signal?: AbortSignal): Promise<UpdateVoiceApiResponse["SuccessResponse"]> {
  return networkManager.put("/me/voice", body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const recordingsGenQueries = {
  getRecording: defineQueryFactory(["sections"], (params: GetRecordingApiResponse["PathParams"]) => defineQuery({
    queryKey: ["sections", params.id, "recording"],
    queryFn: async ({ signal }) => getRecordingApi(params, signal),
  })),
  getVoice: defineQuery({
    queryKey: ["me", "voice"],
    queryFn: async ({ signal }) => getVoiceApi(signal),
  }),
  listRecordings: defineQueryFactory(["me", "recordings"], (query?: ListRecordingsApiResponse["Query"]) => defineQuery({
    queryKey: ["me", "recordings", query],
    queryFn: async ({ signal }) => listRecordingsApi(query, signal),
  })),
  recordingSummary: defineQuery({
    queryKey: ["me", "recordings", "summary"],
    queryFn: async ({ signal }) => recordingSummaryApi(signal),
  }),
}

export const recordingsGenMutations = {
  removeRecording: defineMutation({
    mutationKey: ["sections", ":id", "recording", "delete"],
    mutationFn: async (variables: RemoveRecordingApiResponse["PathParams"]) => removeRecordingApi(variables),
  }),
  saveClip: defineMutation({
    mutationKey: ["sections", ":id", "recording", "clips", ":position", "put"],
    mutationFn: async (variables: SaveClipVariables) => saveClipApi(variables.params, variables.body, variables.query),
  }),
  updateRecording: defineMutation({
    mutationKey: ["sections", ":id", "recording", "patch"],
    mutationFn: async (variables: UpdateRecordingVariables) => updateRecordingApi(variables.params, variables.body),
  }),
  updateVoice: defineMutation({
    mutationKey: ["me", "voice", "put"],
    mutationFn: async (variables: UpdateVoiceApiResponse["Body"]) => updateVoiceApi(variables),
  }),
}
