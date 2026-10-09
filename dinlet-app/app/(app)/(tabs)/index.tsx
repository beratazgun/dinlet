import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell, Folder, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftInfiniteQuery, useCraftQuery } from "@tanstack-query-craft";
import { FormError } from "@/components/auth";
import {
  ContinueCard,
  DocumentRow,
  EmptyLibrary,
  FilterChips,
  isDocumentInFlight,
  PlanCard,
  type LibraryDocument,
  type LibraryFilter,
} from "@/components/library";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { usePlayer } from "@/context/player-context";
import type { ListDocumentApiResponse } from "@/networks/api/documents/documents";

// Craft'ın `defineInfiniteQuery`'si sayfa tipini taşımıyor; burada açıkça verilir.
type LibraryPage = ListDocumentApiResponse["SuccessResponse"];

/** İşlenen not varken liste bu aralıkla tazelenir (ilerleme ve durum). */
const IN_FLIGHT_REFRESH_MS = 5000;

function openDocument(id: number) {
  router.push({ pathname: "/documents/[id]", params: { id: String(id) } });
}

function openUpload() {
  router.push("/upload");
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<LibraryFilter>("all");

  const me = useCraftQuery("auth", "getMe");
  const subscription = useCraftQuery("subscription", "getMine", [], {
    refetchOnScreenFocus: true,
  });
  const continueList = useCraftQuery("sections", "listContinue", [{ limit: 1 }], {
    refetchOnScreenFocus: true,
  });
  const library = useCraftInfiniteQuery(
    "documents",
    "library",
    [filter === "all" ? undefined : filter],
    {
      refetchOnScreenFocus: true,
      refetchInterval: (query) => {
        const pages = (query.state.data?.pages ?? []) as LibraryPage[];
        const inFlight = pages.some((page) => page.data?.some(isDocumentInFlight));
        return inFlight ? IN_FLIGHT_REFRESH_MS : false;
      },
    }
  );

  const documents: LibraryDocument[] = ((library.data?.pages ?? []) as LibraryPage[]).flatMap(
    (page) => page.data ?? []
  );
  const continueItem = continueList.data?.data?.[0];
  const plan = subscription.data?.data;
  const name = me.data?.data?.name;

  const player = usePlayer();
  const hasActiveSession = !!(player.currentDocument && player.currentSection);

  const activeItem = hasActiveSession
    ? {
        sectionId: player.currentSection!.id,
        sectionOrder: player.currentSection!.order,
        sectionTitle: player.currentSection!.title,
        documentId: player.currentDocument!.id,
        documentTitle: player.currentDocument!.title,
        sectionCount: player.sections.length,
        positionMs: player.positionMs,
        durationMs: player.durationMs || player.currentSection!.durationMs || 1,
      }
    : continueItem;

  // Hiç not yokken (filtre seçili değilken) ve aktif çalan ses de yokken tasarımdaki boş kütüphane.
  const isEmptyLibrary =
    filter === "all" && library.isSuccess && documents.length === 0 && !hasActiveSession;

  async function refresh() {
    await Promise.all([library.refetch(), continueList.refetch(), subscription.refetch()]);
  }

  const header = (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text className="text-sm font-medium text-brand-ink-soft">
            {name ? `Merhaba ${name}` : "Merhaba"}
          </Text>
          <Text
            accessibilityRole="header"
            className="font-display text-[28px] tracking-[-0.84px] text-brand-ink"
          >
            Kütüphanen
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Klasörler"
            onPress={() => router.push("/collections")}
            className="h-11 w-11 items-center justify-center rounded-[14px] border-[1.5px] border-brand-hairline bg-white"
          >
            <Folder size={22} strokeWidth={2} color="#0E1238" />
          </Pressable>
          {/* Bildirim butonu */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bildirimler"
            onPress={() =>
              Alert.alert(
                "Bildirimler",
                "Henüz yeni bir bildiriminiz yok. Notlarınızın seslendirmesi hazır olduğunda burada görebilirsiniz."
              )
            }
            className="h-11 w-11 items-center justify-center rounded-[14px] border-[1.5px] border-brand-hairline bg-white active:opacity-70"
          >
            <Bell size={22} strokeWidth={2} color="#0E1238" />
          </Pressable>
        </View>
      </View>

      {!isEmptyLibrary ? (
        <>
          {activeItem ? (
            <ContinueCard
              item={activeItem}
              isPlaying={hasActiveSession ? player.isPlaying : false}
              livePositionMs={hasActiveSession ? player.positionMs : undefined}
              liveDurationMs={hasActiveSession ? (player.durationMs || player.currentSection?.durationMs || undefined) : undefined}
              onPress={() => {
                if (hasActiveSession) {
                  router.push("/(app)/player");
                } else if (continueItem) {
                  openDocument(continueItem.documentId);
                }
              }}
              onTogglePlayPause={() => {
                if (hasActiveSession) {
                  void player.togglePlayPause();
                } else if (continueItem) {
                  openDocument(continueItem.documentId);
                }
              }}
            />
          ) : null}
          {plan ? (
            <PlanCard
              subscription={plan}
              onPress={() =>
                router.push(plan.plan?.raw === "PRO" ? "/account" : "/pro")
              }
            />
          ) : null}
          <FilterChips value={filter} onChange={setFilter} />
          <View className="h-2" />
        </>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />

      {isEmptyLibrary ? (
        <View className="flex-1 px-5" style={{ paddingTop: Math.max(insets.top + 12, 60) }}>
          {header}
          <EmptyLibrary
            remainingPages={plan?.usage.remainingPages}
            planLabel={plan?.plan?.raw === "PRO" ? "Pro" : "Free"}
            onUpload={openUpload}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={documents}
            keyExtractor={(document) => String(document.id)}
            renderItem={({ item }) => (
              <DocumentRow document={item} onPress={() => openDocument(item.id)} />
            )}
            ListHeaderComponent={header}
            ListEmptyComponent={
              library.isPending ? (
                <View className="items-center py-12">
                  <ActivityIndicator color="#1928B4" />
                </View>
              ) : library.isError ? (
                <View className="mt-4">
                  <FormError>{getApiErrorMessage(library.error)}</FormError>
                </View>
              ) : (
                <Text className="py-12 text-center text-[15px] text-brand-ink-soft">
                  {filter === "ready"
                    ? "Dinlemeye hazır notun yok."
                    : "Şu an işlenen not yok."}
                </Text>
              )
            }
            ListFooterComponent={
              library.isFetchingNextPage ? (
                <View className="items-center py-4">
                  <ActivityIndicator color="#1928B4" />
                </View>
              ) : null
            }
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (library.hasNextPage && !library.isFetchingNextPage) {
                void library.fetchNextPage();
              }
            }}
            refreshControl={
              <RefreshControl
                refreshing={library.isRefetching && !library.isFetchingNextPage}
                onRefresh={() => void refresh()}
                tintColor="#1928B4"
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: Math.max(insets.top + 12, 60),
              // Listenin sonu "Not yükle" butonunun altında kalmasın.
              paddingBottom: 96,
            }}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not yükle"
            onPress={openUpload}
            className="absolute bottom-[18px] right-5 h-14 flex-row items-center gap-2 rounded-[18px] bg-brand-indigo pl-[18px] pr-[22px]"
            style={({ pressed }) => ({
              shadowColor: "#1928B4",
              shadowOpacity: 0.35,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Plus size={22} strokeWidth={2.2} color="#FFFFFF" />
            <Text className="text-base font-bold text-white">Not yükle</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
