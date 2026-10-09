/**
 * auth modülü.
 *
 * `auth.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  authGenMutations,
  authGenQueries,
} from "@/networks/api/auth/auth.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/auth/auth.gen"

const queries = {
  ...authGenQueries,
}

const mutations = {
  ...authGenMutations,
}

export const authModule = defineModule("auth", {
  queries,
  mutations,
})
