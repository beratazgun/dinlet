/**
 * study modülü.
 *
 * `study.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  studyGenMutations,
  studyGenQueries,
} from "@/networks/api/study/study.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/study/study.gen"

const queries = {
  ...studyGenQueries,
}

const mutations = {
  ...studyGenMutations,
}

export const studyModule = defineModule("study", {
  queries,
  mutations,
})
