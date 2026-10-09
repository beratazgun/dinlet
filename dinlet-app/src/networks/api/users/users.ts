/**
 * users modülü.
 *
 * `users.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  usersGenMutations,
  usersGenQueries,
} from "@/networks/api/users/users.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/users/users.gen"

const queries = {
  ...usersGenQueries,
}

const mutations = {
  ...usersGenMutations,
}

export const usersModule = defineModule("users", {
  queries,
  mutations,
})
