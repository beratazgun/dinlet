/**
 * review modülü.
 *
 * `review.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  reviewGenMutations,
  reviewGenQueries,
} from "@/networks/api/review/review.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/review/review.gen"

const queries = {
  ...reviewGenQueries,
}

const mutations = {
  ...reviewGenMutations,
}

export const reviewModule = defineModule("review", {
  queries,
  mutations,
})
