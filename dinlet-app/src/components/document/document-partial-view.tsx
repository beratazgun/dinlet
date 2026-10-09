import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  AudioLines,
  BookOpen,
  ChevronLeft,
  MoreHorizontal,
  Play,
  RotateCcw,
  TriangleAlert,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation } from "@tanstack-query-craft";
import { formatDuration } from "@/lib/format";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";
import { usePlayer } from "@/context/player-context";
import { SectionDetailSheet } from "./section-detail-sheet";

type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;

export function DocumentPartialView({
  document,
  onPlaySection,
}: {
  document: DocumentDetail;
  onPlaySection?: (sectionId: number) => void;
}) {
  const queryClient = useQueryClient();
  const player = usePlayer();
  const [readingSectionId, setReadingSectionId] = useState<number | null>(null);

  const retryMutation = useCraftMutation("documents", "retry");
  const deleteMutation = useCraftMutation("documents", "deleteItem");

  function confirmDelete() {
    Alert.alert(
      "Notu Sil",
      `"${document.title}" notu ve tüm bölümleri silinecek. Bu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => void handleDelete(),
        },
      ]
    );
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ id: document.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      ]);
      router.replace("/");
    } catch {
      Alert.alert("Hata", "Not silinemedi. Lütfen tekrar deneyin.");
    }
  }

  const sections = document.sections ?? [];
  const failedSections = sections.filter((s) => s.status?.raw === "FAILED");
  const isFluent = document.rewriteMode?.raw === "FLUENT";
  const modeText = isFluent ? "Akıcı anlatım" : "Düz okuma";
  const isLowQuality = document.extractQuality?.raw === "LOW";

  const isCurrentDoc = player.currentDocument?.id === document.id;

  async function handleRetry() {
    try {
      await retryMutation.mutateAsync({ id: document.id });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      Alert.alert(
        "Yeniden Sıraya Alındı",
        "Başarısız bölümler işleme sırasına eklendi. Sayfa hakkından tekrar düşülmedi."
      );
    } catch {
      Alert.alert("Hata", "Bölümler yeniden sıraya alınamadı. Lütfen tekrar dene.");
    }
  }

  const header = (
    <View className="px-5 pt-3">
      {/* Üst Bar */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          className="-ml-2.5 h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E1238" strokeWidth={2} />
        </Pressable>

        <View className="flex-row items-center gap-2">
          <View className="rounded-lg bg-[#FFF1E6] px-2.5 py-1.5">
            <Text className="text-xs font-bold text-[#B54708]">Kısmen hazır</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Seçenekler"
            onPress={confirmDelete}
            className="-mr-2.5 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          >
            <MoreHorizontal size={22} color="#0E1238" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {/* Başlık ve Meta */}
      <Text
        accessibilityRole="header"
        className="mt-2 font-display text-[28px] font-extrabold leading-tight tracking-[-0.84px] text-brand-ink"
      >
        {document.title}
      </Text>
      <View className="mt-1.5 flex-row items-center gap-2">
        <Text className="text-[13px] font-medium text-brand-ink-soft">
          {document.pageCount} sayfa
        </Text>
        <Text className="text-[13px] text-brand-line">·</Text>
        <Text className="text-[13px] font-medium text-brand-ink-soft">
          {sections.length} bölüm
        </Text>
        <Text className="text-[13px] text-brand-line">·</Text>
        <Text className="text-[13px] font-semibold text-brand-indigo">{modeText}</Text>
      </View>

      {/* Yeniden Dene Uyarı Kartı */}
      <View className="mt-4.5 rounded-[18px] border-[1.5px] border-[#FBD9BC] bg-[#FFF6EE] p-4">
        <View className="flex-row items-start gap-3">
          <TriangleAlert size={22} color="#B54708" strokeWidth={2} style={{ marginTop: 1 }} />
          <View className="flex-1 gap-1">
            <Text className="text-[15px] font-bold text-[#0E1238]">
              {failedSections.length} bölüm seslendirilemedi
            </Text>
            <Text className="text-[13px] leading-[19px] text-[#5C4033]">
              Diğer bölümler dinlenebilir. Başarısız bölümü yeniden sıraya alabilirsin; sayfa
              hakkından tekrar düşülmez.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeniden dene"
          disabled={retryMutation.isPending}
          onPress={() => void handleRetry()}
          className="mt-3.5 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#B54708] active:opacity-90"
        >
          <RotateCcw size={18} color="#FFFFFF" strokeWidth={2.2} />
          <Text className="text-[15px] font-bold text-white">
            {retryMutation.isPending ? "Sıraya alınıyor..." : "Yeniden dene"}
          </Text>
        </Pressable>
      </View>

      {/* Düşük Kalite Taranmış Sayfa Uyarısı */}
      {isLowQuality ? (
        <View className="mt-3 rounded-2xl bg-brand-lavender p-3.5">
          <Text className="text-[13px] leading-[19px] text-brand-ink-soft">
            Bazı sayfalar taranmış görünüyor. Okuma sırası yer yer karışmış olabilir.
          </Text>
        </View>
      ) : null}

      <Text className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-wider text-brand-muted">
        Bölümler
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-brand-offwhite">
      <FlatList
        data={sections}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isFailed = item.status?.raw === "FAILED";
          const isReady = item.status?.raw === "READY";
          const isCurrentSection = isCurrentDoc && player.currentSection?.id === item.id;
          const isSectionPlaying = isCurrentSection && player.isPlaying;

          return (
            <View
              className={`flex-row items-center justify-between border-b border-[#EEF0F7] px-5 py-3.5 ${
                isFailed ? "bg-[#FFF9F5]" : isCurrentSection ? "bg-brand-lavender/35" : ""
              }`}
            >
              <Pressable
                disabled={!isReady}
                onPress={() => {
                  if (isCurrentSection) {
                    router.push("/(app)/player");
                  } else {
                    onPlaySection?.(item.id);
                  }
                }}
                className="flex-1 flex-row items-center gap-3.5 pr-2 active:opacity-70"
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl ${
                    isFailed
                      ? "bg-[#FFE8D6]"
                      : isCurrentSection
                        ? "bg-brand-indigo"
                        : "bg-brand-surface"
                  }`}
                >
                  {isSectionPlaying ? (
                    <AudioLines size={16} color="#FFFFFF" strokeWidth={2.2} />
                  ) : isCurrentSection ? (
                    <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Text
                      className={`font-mono text-xs font-bold ${
                        isFailed ? "text-[#B54708]" : "text-brand-indigo"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                  )}
                </View>

                <View className="flex-1 gap-0.5">
                  <Text
                    numberOfLines={1}
                    className={`text-[15px] font-semibold ${
                      isFailed
                        ? "text-[#B54708]"
                        : isCurrentSection
                          ? "text-brand-indigo"
                          : "text-brand-ink"
                    }`}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isFailed ? "font-bold text-[#B54708]" : "text-brand-ink-soft"
                    }`}
                  >
                    {isFailed
                      ? "Seslendirilemedi"
                      : isSectionPlaying
                        ? "Şimdi dinleniyor"
                        : isCurrentSection
                          ? "Duraklatıldı"
                          : item.durationMs
                            ? formatDuration(item.durationMs)
                            : "Hazır"}
                  </Text>
                </View>
              </Pressable>

              {isReady ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} metnini oku`}
                  onPress={() => setReadingSectionId(item.id)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-brand-lavender active:opacity-70"
                >
                  <BookOpen size={16} color="#1928B4" strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      <SectionDetailSheet
        visible={readingSectionId !== null}
        sectionId={readingSectionId}
        documentTitle={document.title}
        onClose={() => setReadingSectionId(null)}
      />
    </View>
  );
}
