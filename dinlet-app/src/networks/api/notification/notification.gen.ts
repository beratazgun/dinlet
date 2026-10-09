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
export type ListNotificationApiResponse = ApiEndpoint<"/api/v1/notifications", "get">
export type ReadApiResponse = ApiEndpoint<"/api/v1/notifications/{id}/read", "patch">
export type ReadAllApiResponse = ApiEndpoint<"/api/v1/notifications/read-all", "patch">
export type RegisterApiResponse = ApiEndpoint<"/api/v1/me/push-tokens", "post">
export type RemovePushTokenApiResponse = ApiEndpoint<"/api/v1/me/push-tokens/{token}", "delete">
export type UnreadCountApiResponse = ApiEndpoint<"/api/v1/notifications/unread-count", "get">

// ===============================
// 2. API METHODS
// ===============================
/** Bildirimlerimi listele */
export async function listNotificationApi(query?: ListNotificationApiResponse["Query"], signal?: AbortSignal): Promise<ListNotificationApiResponse["SuccessResponse"]> {
  return networkManager.get("/notifications", { params: query, signal })
}

/** Bildirimi okundu işaretle */
export async function readApi(params: ReadApiResponse["PathParams"], signal?: AbortSignal): Promise<ReadApiResponse["SuccessResponse"]> {
  return networkManager.patch(`/notifications/${encodeURIComponent(String(params.id))}/read`, {}, { signal })
}

/** Tüm bildirimleri okundu işaretle */
export async function readAllApi(signal?: AbortSignal): Promise<ReadAllApiResponse["SuccessResponse"]> {
  return networkManager.patch("/notifications/read-all", {}, { signal })
}

/** Push token kaydet */
export async function registerApi(body: RegisterApiResponse["Body"], signal?: AbortSignal): Promise<RegisterApiResponse["SuccessResponse"]> {
  return networkManager.post("/me/push-tokens", body, { signal })
}

/** Push token kaldır */
export async function removePushTokenApi(params: RemovePushTokenApiResponse["PathParams"], signal?: AbortSignal): Promise<RemovePushTokenApiResponse["SuccessResponse"]> {
  return networkManager.delete(`/me/push-tokens/${encodeURIComponent(String(params.token))}`, { signal })
}

/** Okunmamış bildirim sayısı */
export async function unreadCountApi(signal?: AbortSignal): Promise<UnreadCountApiResponse["SuccessResponse"]> {
  return networkManager.get("/notifications/unread-count", { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const notificationGenQueries = {
  listNotification: defineQueryFactory(["notifications"], (query?: ListNotificationApiResponse["Query"]) => defineQuery({
    queryKey: ["notifications", query],
    queryFn: async ({ signal }) => listNotificationApi(query, signal),
  })),
  unreadCount: defineQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async ({ signal }) => unreadCountApi(signal),
  }),
}

export const notificationGenMutations = {
  read: defineMutation({
    mutationKey: ["notifications", ":id", "read", "patch"],
    mutationFn: async (variables: ReadApiResponse["PathParams"]) => readApi(variables),
  }),
  readAll: defineMutation({
    mutationKey: ["notifications", "read-all", "patch"],
    mutationFn: async () => readAllApi(),
  }),
  register: defineMutation({
    mutationKey: ["me", "push-tokens", "post"],
    mutationFn: async (variables: RegisterApiResponse["Body"]) => registerApi(variables),
  }),
  removePushToken: defineMutation({
    mutationKey: ["me", "push-tokens", ":token", "delete"],
    mutationFn: async (variables: RemovePushTokenApiResponse["PathParams"]) => removePushTokenApi(variables),
  }),
}
