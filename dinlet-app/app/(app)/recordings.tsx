import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, SectionList, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Mic } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftInfiniteQuery, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { PlayGlyph } from "@/components/store";
import { useSamplePlayer } from "@/hooks/use-sample-player";
import { formatClock, formatDuration } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import {
  getRecordingApi,
  type ListRecordingsApiResponse,
} from "@/networks/api/recordings/recordings";

type Page = ListRecordingsApiResponse["SuccessResponse"];
type RecordingItem = NonNullable<ListRecordingsApiResponse["Data"]>[number];

function rowMeta(item: RecordingItem): string {
  switch (item.status?.raw) {
    case "READY":
      return `${formatClock(item.durationMs)} · ${item.useOwnVoice ? "Benim sesimle çalıyor" : "Dinlet sesiyle çalıyor"}`;
    case "PROCESSING":
      return "Hazırlanıyor";
    case "FAILED":
      return "Birleştirilemedi · tekrar kaydet";
    default:
      return `Yarım: ${item.recordedCount} / ${item.totalCount} paragraf`;
  }
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-[14px] bg-brand-lavender p-3">
      <Text className="font-display text-xl text-brand-ink">{value}</Text>
      <Text className="text-xs font-semibold text-brand-ink-soft">{label}</Text>
    </View>
  );
}

/** "Kayıtlarım": kendi sesinle okuduğun bölümler, nota göre gruplu. */
export default function MyRecordingsScreen() {
  const insets = useSafeAreaInsets();
  const sample = useSamplePlayer();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const summary = useCraftQuery("recordings", "recordingSummary", [], {
    refetchOnScreenFocus: true,
  });
  const list = useCraftInfiniteQuery("recordings", "myRecordings", [], {
    refetchOnScreenFocus: true,
  });
  const items = ((list.data?.pages ?? []) as Page[]).flatMap((page) => page.data ?? []);

  // Nota göre grupla; sıra en son kaydedilen nota göre.
  const sections: { title: string; data: RecordingItem[] }[] = [];
  for (const item of items) {
    const group = sections.find((section) => section.title === item.documentTitle);
    if (group) group.data.push(item);
    else sections.push({ title: item.documentTitle, data: [item] });
  }

  const play = async (item: RecordingItem) => {
    const key = `rec-${item.sectionId}`;
    if (sample.playingKey === key) {
      sample.stop();
      return;
    }
    setLoadingKey(key);
    try {
      const recording = (await getRecordingApi({ id: item.sectionId })).data;
      void sample.toggle(key, recording?.audioUrl);
    } catch (error) {
      Alert.alert("Çalınamadı", getApiErrorMessage(error));
    } finally {
      setLoadingKey(null);
    }
  };

  const open = (item: RecordingItem) =>
    item.status?.raw === "DRAFT"
      ? router.push({
          pathname: "/record/[sectionId]",
          params: { sectionId: String(item.sectionId) },
        })
      : router.push({
          pathname: "/record/review/[sectionId]",
          params: { sectionId: String(item.sectionId) },
        });

  const stats = summary.data?.data;
  const header = (
    <View>
      <BackButton onPress={() => router.back()} />
      <Text
        accessibilityRole="header"
        className="mb-1 mt-1.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
      >
        Kayıtlarım
      </Text>
      <Text className="text-sm text-brand-ink-soft">Kendi sesinle okuduğun bölümler.</Text>
      {stats ? (
        <View className="mt-4 flex-row gap-2">
          <StatTile value={String(stats.readyCount)} label="bölüm" />
          <StatTile
            value={stats.totalDurationMs > 0 ? formatDuration(stats.totalDurationMs) : "0 dk"}
            label="toplam"
          />
          <StatTile value={String(stats.draftCount)} label="yarım kaldı" />
        </View>
      ) : null}
      {list.isError ? (
        <View className="mt-3">
          <FormError>{getApiErrorMessage(list.error)}</FormError>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.sectionId)}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <Text className="mb-1 mt-[18px] text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const key = `rec-${item.sectionId}`;
          const ready = item.status?.raw === "READY";
          const draft = item.status?.raw === "DRAFT" || item.status?.raw === "FAILED";
          return (
            <View className="flex-row items-center gap-3 border-b border-[#EEF0F7] py-[11px]">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={sample.playingKey === key ? "Durdur" : "Dinle"}
                disabled={!ready}
                onPress={() => void play(item)}
                className="h-[42px] w-[42px] items-center justify-center rounded-full"
                style={{ backgroundColor: ready ? "#EEF0FB" : "#F4F5FD" }}
              >
                {loadingKey === key ? (
                  <ActivityIndicator size="small" color="#1928B4" />
                ) : (
                  <PlayGlyph
                    size={15}
                    color={ready ? "#1928B4" : "#8A8FAD"}
                    playing={sample.playingKey === key}
                  />
                )}
              </Pressable>
              <View className="min-w-0 flex-1 gap-[3px]">
                <Text numberOfLines={1} className="text-[15px] font-bold text-brand-ink">
                  {`${item.sectionOrder} · ${item.sectionTitle}`}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: draft ? "#B54708" : "#6B7090", fontWeight: draft ? "700" : "500" }}
                >
                  {rowMeta(item)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => open(item)}
                className="h-[34px] justify-center rounded-[10px] bg-brand-lavender px-2.5"
              >
                <Text className="text-xs font-extrabold text-brand-indigo">
                  {item.status?.raw === "DRAFT" ? "Devam et" : "Düzenle"}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          list.isPending ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#1928B4" />
            </View>
          ) : list.isError ? null : (
            <Text className="py-12 text-center text-[15px] leading-[22px] text-brand-muted">
              Henüz kayıt yok. Bir notun bölüm metnini açıp “Kendi sesinle kaydet”e bas.
            </Text>
          )
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: 150,
        }}
      />

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 border-t border-[#E9EBF5] bg-white px-5 pt-3.5"
        style={{ paddingBottom: Math.max(insets.bottom + 16, 32) }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/")}
          className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-indigo"
        >
          <Mic size={18} color="#FFFFFF" strokeWidth={2.2} />
          <Text className="text-[17px] font-bold text-white">Yeni bölüm kaydet</Text>
        </Pressable>
        <Text className="text-center text-xs text-brand-muted">
          Kayıtların hesabına yedeklenir, yalnızca sen dinleyebilirsin.
        </Text>
      </View>
    </View>
  );
}
