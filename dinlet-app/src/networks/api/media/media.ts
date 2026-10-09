/**
 * media modülü.
 *
 * `media.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  mediaGenMutations,
  mediaGenQueries,
} from "@/networks/api/media/media.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/media/media.gen"

const queries = {
  ...mediaGenQueries,
}

const mutations = {
  ...mediaGenMutations,
}

export const mediaModule = defineModule("media", {
  queries,
  mutations,
})
