/**
 * notification modülü.
 *
 * `notification.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  notificationGenMutations,
  notificationGenQueries,
} from "@/networks/api/notification/notification.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/notification/notification.gen"

const queries = {
  ...notificationGenQueries,
}

const mutations = {
  ...notificationGenMutations,
}

export const notificationModule = defineModule("notification", {
  queries,
  mutations,
})
