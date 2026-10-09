/**
 * recordings modülü.
 *
 * `recordings.gen.ts` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  listRecordingsApi,
  recordingsGenMutations,
  recordingsGenQueries,
  type ListRecordingsApiResponse,
  type SaveClipApiResponse,
} from "@/networks/api/recordings/recordings.gen"
import { networkManager } from "@/lib/network-manager"
import type { InfiniteData, QueryKey } from "@tanstack/react-query"
import {
  defineInfiniteQuery,
  defineModule,
  defineMutation,
} from "@tanstack-query-craft"

export * from "@/networks/api/recordings/recordings.gen"

export type UploadClipVariables = {
  sectionId: number
  position: number
  /** Cihazdaki kayıt dosyası (`AudioRecorder.uri`). */
  uri: string
  durationMs: number
}

/**
 * Paragraf kaydını `multipart/form-data` ile yükler. Üretilen `saveClipApi`
 * gövdeyi JSON gönderdiği için dosya yüklemesi burada elle yazılır.
 */
export async function uploadClipApi(
  variables: UploadClipVariables
): Promise<SaveClipApiResponse["SuccessResponse"]> {
  const extension = variables.uri.split(".").pop()?.toLowerCase() ?? "m4a"
  const form = new FormData()
  form.append("audio", {
    uri: variables.uri,
    name: `clip.${extension}`,
    type: extension === "3gp" ? "audio/3gpp" : extension === "wav" ? "audio/wav" : "audio/mp4",
  } as unknown as Blob)
  return networkManager.put(
    `/sections/${variables.sectionId}/recording/clips/${variables.position}`,
    form,
    {
      params: { durationMs: Math.max(300, Math.round(variables.durationMs)) },
      headers: { "Content-Type": "multipart/form-data" },
      // Uzun paragraf kayıtları yavaş bağlantıda 30 sn'yi aşabilir.
      timeout: 120_000,
    }
  )
}

const queries = {
  ...recordingsGenQueries,
  /** Kayıtlarım: sayfa sayfa. */
  myRecordings: defineInfiniteQuery<
    ListRecordingsApiResponse["SuccessResponse"],
    InfiniteData<ListRecordingsApiResponse["SuccessResponse"], number>,
    QueryKey,
    number
  >({
    queryKey: ["me", "recordings", "list"],
    queryFn: ({ pageParam, signal }) =>
      listRecordingsApi({ page: pageParam, limit: 50 }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta?.pagination
      return pagination && "nextPage" in pagination ? (pagination.nextPage ?? undefined) : undefined
    },
  }),
}

const mutations = {
  ...recordingsGenMutations,
  uploadClip: defineMutation({
    mutationKey: ["sections", ":id", "recording", "clips", "upload"],
    mutationFn: async (variables: UploadClipVariables) => uploadClipApi(variables),
  }),
}

export const recordingsModule = defineModule("recordings", {
  queries,
  mutations,
})
