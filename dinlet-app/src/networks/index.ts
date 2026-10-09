/**
 * BU DOSYA OTOMATİK ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN.
 *
 * Üretici: scripts/generate-api-modules.mjs (pnpm api:modules)
 *
 * Modülleri registry'ye kaydeder ve TanstackQueryCraftRegistry tipini
 * genişletir. `src/routes/__root.tsx` içindeki `import "@/networks"`
 * satırı bu dosyanın uygulama başında evaluate edilmesini sağlar.
 */

import { authModule } from "@/networks/api/auth/auth"
import { documentsModule } from "@/networks/api/documents/documents"
import { legalModule } from "@/networks/api/legal/legal"
import { mediaModule } from "@/networks/api/media/media"
import { notificationModule } from "@/networks/api/notification/notification"
import { recordingsModule } from "@/networks/api/recordings/recordings"
import { reviewModule } from "@/networks/api/review/review"
import { sectionsModule } from "@/networks/api/sections/sections"
import { storeModule } from "@/networks/api/store/store"
import { studyModule } from "@/networks/api/study/study"
import { studyToolsModule } from "@/networks/api/study-tools/study-tools"
import { subscriptionModule } from "@/networks/api/subscription/subscription"
import { usersModule } from "@/networks/api/users/users"
import { utilsModule } from "@/networks/api/utils/utils"

export { authModule, documentsModule, legalModule, mediaModule, notificationModule, recordingsModule, reviewModule, sectionsModule, storeModule, studyModule, studyToolsModule, subscriptionModule, usersModule, utilsModule }

declare module "@tanstack-query-craft" {
  interface TanstackQueryCraftRegistry {
    "auth": typeof authModule
    "documents": typeof documentsModule
    "legal": typeof legalModule
    "media": typeof mediaModule
    "notification": typeof notificationModule
    "recordings": typeof recordingsModule
    "review": typeof reviewModule
    "sections": typeof sectionsModule
    "store": typeof storeModule
    "study": typeof studyModule
    "study-tools": typeof studyToolsModule
    "subscription": typeof subscriptionModule
    "users": typeof usersModule
    "utils": typeof utilsModule
  }
}
