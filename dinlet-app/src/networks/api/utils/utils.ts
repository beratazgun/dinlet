/**
 * utils modülü.
 *
 * `utils.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  utilsGenMutations,
  utilsGenQueries,
} from "@/networks/api/utils/utils.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/utils/utils.gen"

const queries = {
  ...utilsGenQueries,
}

const mutations = {
  ...utilsGenMutations,
}

export const utilsModule = defineModule("utils", {
  queries,
  mutations,
})
