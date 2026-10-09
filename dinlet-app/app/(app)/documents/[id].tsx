import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftQuery } from "@tanstack-query-craft";
import { AuthButton, FormError } from "@/components/auth";
import {
  DocumentFailedView,
  DocumentPartialView,
  DocumentProcessingView,
  DocumentReadyView,
} from "@/components/document";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { usePlayer } from "@/context/player-context";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";

type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;

const IN_FLIGHT_STATUSES = ["QUEUED", "EXTRACTING", "SCRIPTING", "SYNTHESIZING"];

export default function DocumentScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const docId = Number(id);

  const documentQuery = useCraftQuery("documents", "getDocument", [{ id: docId }], {
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status?.raw;
      return status && IN_FLIGHT_STATUSES.includes(status) ? 3000 : false;
    },
  });

  const document = documentQuery.data?.data;
  const status = document?.status?.raw;
  const player = usePlayer();

  function handlePlaySection(sectionId: number) {
    if (!document) return;
    const sections = document.sections ?? [];
    const sectionIdx = sections.findIndex((s) => s.id === sectionId);
    const targetIndex = sectionIdx >= 0 ? sectionIdx : 0;
    void player.playDocumentSection(document, targetIndex);
    router.push("/(app)/player");
  }

  return (
    <View
      className="flex-1 bg-brand-offwhite"
      style={{ paddingTop: Math.max(insets.top, 44) }}
    >
      <StatusBar style="dark" />

      {documentQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1928B4" />
        </View>
      ) : documentQuery.isError || !document ? (
        <View className="flex-1 px-5 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => router.back()}
            className="-ml-2.5 h-11 w-11 items-center justify-center"
          >
            <ChevronLeft size={24} color="#0E1238" strokeWidth={2} />
          </Pressable>
          <View className="mt-8 gap-4">
            <FormError>{getApiErrorMessage(documentQuery.error)}</FormError>
            <AuthButton variant="ghost" onPress={() => void documentQuery.refetch()}>
              Tekrar dene
            </AuthButton>
          </View>
        </View>
      ) : status === "READY" ? (
        <DocumentReadyView document={document} onPlaySection={handlePlaySection} />
      ) : status === "PARTIAL" ? (
        <DocumentPartialView document={document} onPlaySection={handlePlaySection} />
      ) : status === "FAILED" ? (
        <DocumentFailedView document={document} />
      ) : (
        <DocumentProcessingView document={document} />
      )}
    </View>
  );
}
