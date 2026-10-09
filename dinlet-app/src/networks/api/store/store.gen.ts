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
export type AddBundleApiResponse = ApiEndpoint<"/api/v1/store/bundles/{id}/library", "post">
export type AddItemApiResponse = ApiEndpoint<"/api/v1/store/items/{id}/library", "post">
export type GetBundleApiResponse = ApiEndpoint<"/api/v1/store/bundles/{id}", "get">
export type GetItemApiResponse = ApiEndpoint<"/api/v1/store/items/{id}", "get">
export type HomeApiResponse = ApiEndpoint<"/api/v1/store", "get">
export type ListBundlesApiResponse = ApiEndpoint<"/api/v1/store/bundles", "get">
export type ListItemsApiResponse = ApiEndpoint<"/api/v1/store/items", "get">
export type ListMineApiResponse = ApiEndpoint<"/api/v1/store/submissions", "get">
export type SubmitApiResponse = ApiEndpoint<"/api/v1/store/submissions", "post">
export type SyncPurchasesApiResponse = ApiEndpoint<"/api/v1/store/purchases/sync", "post">
export type WithdrawApiResponse = ApiEndpoint<"/api/v1/store/submissions/{id}/withdraw", "post">

// ===============================
// 2. API METHODS
// ===============================
/** Paketi kütüphaneme ekle */
export async function addBundleApi(params: AddBundleApiResponse["PathParams"], signal?: AbortSignal): Promise<AddBundleApiResponse["SuccessResponse"]> {
  return networkManager.post(`/store/bundles/${encodeURIComponent(String(params.id))}/library`, {}, { signal })
}

/** Kütüphaneme ekle */
export async function addItemApi(params: AddItemApiResponse["PathParams"], signal?: AbortSignal): Promise<AddItemApiResponse["SuccessResponse"]> {
  return networkManager.post(`/store/items/${encodeURIComponent(String(params.id))}/library`, {}, { signal })
}

/** Paket detayı ve içerikleri */
export async function getBundleApi(params: GetBundleApiResponse["PathParams"], signal?: AbortSignal): Promise<GetBundleApiResponse["SuccessResponse"]> {
  return networkManager.get(`/store/bundles/${encodeURIComponent(String(params.id))}`, { signal })
}

/** İçerik detayı */
export async function getItemApi(params: GetItemApiResponse["PathParams"], signal?: AbortSignal): Promise<GetItemApiResponse["SuccessResponse"]> {
  return networkManager.get(`/store/items/${encodeURIComponent(String(params.id))}`, { signal })
}

/** Mağaza ana ekranı */
export async function homeApi(signal?: AbortSignal): Promise<HomeApiResponse["SuccessResponse"]> {
  return networkManager.get("/store", { signal })
}

/** Paketleri listele */
export async function listBundlesApi(query?: ListBundlesApiResponse["Query"], signal?: AbortSignal): Promise<ListBundlesApiResponse["SuccessResponse"]> {
  return networkManager.get("/store/bundles", { params: query, signal })
}

/** Mağaza içeriklerini listele */
export async function listItemsApi(query?: ListItemsApiResponse["Query"], signal?: AbortSignal): Promise<ListItemsApiResponse["SuccessResponse"]> {
  return networkManager.get("/store/items", { params: query, signal })
}

/** Paylaştıklarım */
export async function listMineApi(query?: ListMineApiResponse["Query"], signal?: AbortSignal): Promise<ListMineApiResponse["SuccessResponse"]> {
  return networkManager.get("/store/submissions", { params: query, signal })
}

/** Notumu mağazada paylaş */
export async function submitApi(body: SubmitApiResponse["Body"], signal?: AbortSignal): Promise<SubmitApiResponse["SuccessResponse"]> {
  return networkManager.post("/store/submissions", body, { signal })
}

/** Satın almaları geri yükle */
export async function syncPurchasesApi(signal?: AbortSignal): Promise<SyncPurchasesApiResponse["SuccessResponse"]> {
  return networkManager.post("/store/purchases/sync", {}, { signal })
}

/** Paylaşımı geri çek / mağazadan kaldır */
export async function withdrawApi(params: WithdrawApiResponse["PathParams"], signal?: AbortSignal): Promise<WithdrawApiResponse["SuccessResponse"]> {
  return networkManager.post(`/store/submissions/${encodeURIComponent(String(params.id))}/withdraw`, {}, { signal })
}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const storeGenQueries = {
  getBundle: defineQueryFactory(["store", "bundles"], (params: GetBundleApiResponse["PathParams"]) => defineQuery({
    queryKey: ["store", "bundles", params.id],
    queryFn: async ({ signal }) => getBundleApi(params, signal),
  })),
  getItem: defineQueryFactory(["store", "items"], (params: GetItemApiResponse["PathParams"]) => defineQuery({
    queryKey: ["store", "items", params.id],
    queryFn: async ({ signal }) => getItemApi(params, signal),
  })),
  home: defineQuery({
    queryKey: ["store"],
    queryFn: async ({ signal }) => homeApi(signal),
  }),
  listBundles: defineQueryFactory(["store", "bundles"], (query?: ListBundlesApiResponse["Query"]) => defineQuery({
    queryKey: ["store", "bundles", query],
    queryFn: async ({ signal }) => listBundlesApi(query, signal),
  })),
  listItems: defineQueryFactory(["store", "items"], (query?: ListItemsApiResponse["Query"]) => defineQuery({
    queryKey: ["store", "items", query],
    queryFn: async ({ signal }) => listItemsApi(query, signal),
  })),
  listMine: defineQueryFactory(["store", "submissions"], (query?: ListMineApiResponse["Query"]) => defineQuery({
    queryKey: ["store", "submissions", query],
    queryFn: async ({ signal }) => listMineApi(query, signal),
  })),
}

export const storeGenMutations = {
  addBundle: defineMutation({
    mutationKey: ["store", "bundles", ":id", "library", "post"],
    mutationFn: async (variables: AddBundleApiResponse["PathParams"]) => addBundleApi(variables),
  }),
  addItem: defineMutation({
    mutationKey: ["store", "items", ":id", "library", "post"],
    mutationFn: async (variables: AddItemApiResponse["PathParams"]) => addItemApi(variables),
  }),
  submit: defineMutation({
    mutationKey: ["store", "submissions", "post"],
    mutationFn: async (variables: SubmitApiResponse["Body"]) => submitApi(variables),
  }),
  syncPurchases: defineMutation({
    mutationKey: ["store", "purchases", "sync", "post"],
    mutationFn: async () => syncPurchasesApi(),
  }),
  withdraw: defineMutation({
    mutationKey: ["store", "submissions", ":id", "withdraw", "post"],
    mutationFn: async (variables: WithdrawApiResponse["PathParams"]) => withdrawApi(variables),
  }),
}
