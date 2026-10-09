/**
 * legal modülü.
 *
 * `legal.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  legalGenMutations,
  legalGenQueries,
} from "@/networks/api/legal/legal.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/legal/legal.gen"

const queries = {
  ...legalGenQueries,
}

const mutations = {
  ...legalGenMutations,
}

export const legalModule = defineModule("legal", {
  queries,
  mutations,
})
