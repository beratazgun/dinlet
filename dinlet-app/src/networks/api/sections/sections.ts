/**
 * sections modülü.
 *
 * `sections.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  sectionsGenMutations,
  sectionsGenQueries,
} from "@/networks/api/sections/sections.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/sections/sections.gen"

const queries = {
  ...sectionsGenQueries,
}

const mutations = {
  ...sectionsGenMutations,
}

export const sectionsModule = defineModule("sections", {
  queries,
  mutations,
})
