/**
 * subscription modülü.
 *
 * `subscription.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  subscriptionGenMutations,
  subscriptionGenQueries,
} from "@/networks/api/subscription/subscription.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/subscription/subscription.gen"

const queries = {
  ...subscriptionGenQueries,
}

const mutations = {
  ...subscriptionGenMutations,
}

export const subscriptionModule = defineModule("subscription", {
  queries,
  mutations,
})
