/**
 * documents modülü.
 *
 * `documents.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  documentsGenMutations,
  documentsGenQueries,
  listDocumentApi,
  type ListDocumentApiResponse,
} from "@/networks/api/documents/documents.gen"
import type { InfiniteData, QueryKey } from "@tanstack/react-query"
import {
  defineInfiniteQuery,
  defineModule,
  defineQueryFactory,
} from "@tanstack-query-craft"

export * from "@/networks/api/documents/documents.gen"

export type DocumentGroup = NonNullable<ListDocumentApiResponse["Query"]>["group"]

const LIBRARY_PAGE_SIZE = 20

export type CollectionFilter = Pick<
  NonNullable<ListDocumentApiResponse["Query"]>,
  "folderId" | "tagId" | "favorite" | "addedWithinDays"
>

const queries = {
  ...documentsGenQueries,
  /**
   * Kütüphane listesi: imleçli sayfalama ile sonsuz kaydırma. `group`
   * filtre sekmesidir (Tümü / Hazır / İşleniyor).
   */
  library: defineQueryFactory(["documents", "library"], (group?: DocumentGroup) =>
    defineInfiniteQuery<
      ListDocumentApiResponse["SuccessResponse"],
      InfiniteData<ListDocumentApiResponse["SuccessResponse"], string | null>,
      QueryKey,
      string | null
    >({
      queryKey: ["documents", "library", group ?? "all"],
      queryFn: ({ pageParam, signal }) =>
        listDocumentApi(
          { group, limit: LIBRARY_PAGE_SIZE, cursor: pageParam ?? undefined },
          signal
        ),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.meta?.pagination?.nextCursor ?? null,
    })
  ),
  /**
   * Klasör, etiket, favori veya "son N gün" ile süzülmüş not listesi
   * ("Klasörlerin" ekranından açılır).
   */
  collection: defineQueryFactory(["documents", "collection"], (filter: CollectionFilter) =>
    defineInfiniteQuery<
      ListDocumentApiResponse["SuccessResponse"],
      InfiniteData<ListDocumentApiResponse["SuccessResponse"], string | null>,
      QueryKey,
      string | null
    >({
      queryKey: ["documents", "collection", filter],
      queryFn: ({ pageParam, signal }) =>
        listDocumentApi(
          { ...filter, limit: LIBRARY_PAGE_SIZE, cursor: pageParam ?? undefined },
          signal
        ),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.meta?.pagination?.nextCursor ?? null,
    })
  ),
}

const mutations = {
  ...documentsGenMutations,
}

export const documentsModule = defineModule("documents", {
  queries,
  mutations,
})
