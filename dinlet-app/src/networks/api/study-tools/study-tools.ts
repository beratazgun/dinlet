/**
 * study-tools modülü.
 *
 * `study-tools.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  studyToolsGenMutations,
  studyToolsGenQueries,
} from "@/networks/api/study-tools/study-tools.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/study-tools/study-tools.gen"

const queries = {
  ...studyToolsGenQueries,
}

const mutations = {
  ...studyToolsGenMutations,
}

export const studyToolsModule = defineModule("study-tools", {
  queries,
  mutations,
})
