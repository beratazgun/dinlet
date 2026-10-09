/**
 * store modülü.
 *
 * `store.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  listItemsApi,
  storeGenMutations,
  storeGenQueries,
  type ListItemsApiResponse,
} from "@/networks/api/store/store.gen"
import type { InfiniteData, QueryKey } from "@tanstack/react-query"
import {
  defineInfiniteQuery,
  defineModule,
  defineQueryFactory,
} from "@tanstack-query-craft"

export * from "@/networks/api/store/store.gen"

export type StoreCatalogFilter = Omit<
  NonNullable<ListItemsApiResponse["Query"]>,
  "page" | "limit"
>

const CATALOG_PAGE_SIZE = 20

const queries = {
  ...storeGenQueries,
  /** Katalog listesi (sınav/ders, fiyat, arama): sayfa sayfa sonsuz kaydırma. */
  catalog: defineQueryFactory(["store", "catalog"], (filter: StoreCatalogFilter) =>
    defineInfiniteQuery<
      ListItemsApiResponse["SuccessResponse"],
      InfiniteData<ListItemsApiResponse["SuccessResponse"], number>,
      QueryKey,
      number
    >({
      queryKey: ["store", "catalog", filter],
      queryFn: ({ pageParam, signal }) =>
        listItemsApi({ ...filter, page: pageParam, limit: CATALOG_PAGE_SIZE }, signal),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const pagination = lastPage.meta?.pagination
        return pagination && "nextPage" in pagination ? (pagination.nextPage ?? undefined) : undefined
      },
    })
  ),
}

const mutations = {
  ...storeGenMutations,
}

export const storeModule = defineModule("store", {
  queries,
  mutations,
})
