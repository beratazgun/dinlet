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
export type CreateFolderApiResponse = ApiEndpoint<"/api/v1/folders", "post">
export type CreateTagApiResponse = ApiEndpoint<"/api/v1/tags", "post">
export type GetCollectionsApiResponse = ApiEndpoint<"/api/v1/collections", "get">
export type RemoveFolderApiResponse = ApiEndpoint<"/api/v1/folders/{id}", "delete">
export type RemoveStudyGoalApiResponse = ApiEndpoint<"/api/v1/me/study-goal", "delete">
export type RemoveTagApiResponse = ApiEndpoint<"/api/v1/tags/{id}", "delete">
export type RenameTagApiResponse = ApiEndpoint<"/api/v1/tags/{id}", "patch">
export type SetDocumentTagsApiResponse = ApiEndpoint<"/api/v1/documents/{id}/tags", "put">
export type UpdateFolderApiResponse = ApiEndpoint<"/api/v1/folders/{id}", "patch">
export type UpsertStudyGoalApiResponse = ApiEndpoint<"/api/v1/me/study-goal", "put">

export type RenameTagVariables = {
  params: RenameTagApiResponse["PathParams"]
  body: RenameTagApiResponse["Body"]
}

export type SetDocumentTagsVariables = {
  params: SetDocumentTagsApiResponse["PathParams"]
  body: SetDocumentTagsApiResponse["Body"]
}

export type UpdateFolderVariables = {
  params: UpdateFolderApiResponse["PathParams"]
  body: UpdateFolderApiResponse["Body"]
}

// ===============================
// 2. API METHODS
// ===============================
/** Klasör oluştur */
export async function createFolderApi(body: CreateFolderApiResponse["Body"], signal?: AbortSignal): Promise<CreateFolderApiResponse["SuccessResponse"]> {
  return networkManager.post("/folders", body, { signal })
}

/** Etiket oluştur */
export async function createTagApi(body: CreateTagApiResponse["Body"], signal?: AbortSignal): Promise<CreateTagApiResponse["SuccessResponse"]> {
  return networkManager.post("/tags", body, { signal })
}

/** Klasörlerim, etiketlerim ve sınav hedefim */
export async function getCollectionsApi(signal?: AbortSignal): Promise<GetCollectionsApiResponse["SuccessResponse"]> {
  return networkManager.get("/collections", { signal })
}

/** Klasörü sil */
export async function removeFolderApi(params: RemoveFolderApiResponse["PathParams"], signal?: AbortSignal): Promise<RemoveFolderApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/folders/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Sınav hedefini kaldır */
export async function removeStudyGoalApi(signal?: AbortSignal): Promise<RemoveStudyGoalApiResponse["SuccessResponse"]> {
  return networkManager.delete("/me/study-goal", { signal })
}

/** Etiketi sil */
export async function removeTagApi(params: RemoveTagApiResponse["PathParams"], signal?: AbortSignal): Promise<RemoveTagApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/tags/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Etiketi yeniden adlandır */
export async function renameTagApi(params: RenameTagApiResponse["PathParams"], body: RenameTagApiResponse["Body"], signal?: AbortSignal): Promise<RenameTagApiResponse["SuccessResponse"]> {
  return networkManager.patch(`/tags/${encodeURIComponent(String(params.id))}`, body, { signal })
}

/** Notun etiketlerini ayarla */
export async function setDocumentTagsApi(params: SetDocumentTagsApiResponse["PathParams"], body: SetDocumentTagsApiResponse["Body"], signal?: AbortSignal): Promise<SetDocumentTagsApiResponse["SuccessResponse"]> {
  return networkManager.put(`/documents/${encodeURIComponent(String(params.id))}/tags`, body, { signal })
}

/** Klasörü yeniden adlandır veya rengini değiştir */
export async function updateFolderApi(params: UpdateFolderApiResponse["PathParams"], body: UpdateFolderApiResponse["Body"], signal?: AbortSignal): Promise<UpdateFolderApiResponse["SuccessResponse"]> {
  return networkManager.patch(`/folders/${encodeURIComponent(String(params.id))}`, body, { signal })
}

/** Sınav hedefini ayarla */
export async function upsertStudyGoalApi(body: UpsertStudyGoalApiResponse["Body"], signal?: AbortSignal): Promise<UpsertStudyGoalApiResponse["SuccessResponse"]> {
  return networkManager.put("/me/study-goal", body, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const studyGenQueries = {
  getCollections: defineQuery({
    queryKey: ["collections"],
    queryFn: async ({ signal }) => getCollectionsApi(signal),
  }),
}

export const studyGenMutations = {
  createFolder: defineMutation({
    mutationKey: ["folders", "post"],
    mutationFn: async (variables: CreateFolderApiResponse["Body"]) => createFolderApi(variables),
  }),
  createTag: defineMutation({
    mutationKey: ["tags", "post"],
    mutationFn: async (variables: CreateTagApiResponse["Body"]) => createTagApi(variables),
  }),
  removeFolder: defineMutation({
    mutationKey: ["folders", ":id", "delete"],
    mutationFn: async (variables: RemoveFolderApiResponse["PathParams"]) => removeFolderApi(variables),
  }),
  removeStudyGoal: defineMutation({
    mutationKey: ["me", "study-goal", "delete"],
    mutationFn: async () => removeStudyGoalApi(),
  }),
  removeTag: defineMutation({
    mutationKey: ["tags", ":id", "delete"],
    mutationFn: async (variables: RemoveTagApiResponse["PathParams"]) => removeTagApi(variables),
  }),
  renameTag: defineMutation({
    mutationKey: ["tags", ":id", "patch"],
    mutationFn: async (variables: RenameTagVariables) => renameTagApi(variables.params, variables.body),
  }),
  setDocumentTags: defineMutation({
    mutationKey: ["documents", ":id", "tags", "put"],
    mutationFn: async (variables: SetDocumentTagsVariables) => setDocumentTagsApi(variables.params, variables.body),
  }),
  updateFolder: defineMutation({
    mutationKey: ["folders", ":id", "patch"],
    mutationFn: async (variables: UpdateFolderVariables) => updateFolderApi(variables.params, variables.body),
  }),
  upsertStudyGoal: defineMutation({
    mutationKey: ["me", "study-goal", "put"],
    mutationFn: async (variables: UpsertStudyGoalApiResponse["Body"]) => upsertStudyGoalApi(variables),
  }),
}
