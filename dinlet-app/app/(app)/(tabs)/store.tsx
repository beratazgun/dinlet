import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useCraftInfiniteQuery, useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { FormError } from "@/components/auth";
import { PlayGlyph, StoreChip, StoreCompactRow } from "@/components/store";
import { useSamplePlayer } from "@/hooks/use-sample-player";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { splitCategories, type StoreItem } from "@/lib/store-format";
import { getItemApi, type ListItemsApiResponse } from "@/networks/api/store/store";

type CatalogPage = ListItemsApiResponse["SuccessResponse"];

const ORIGINAL_LIMIT = 3;

/** Öne çıkan içerik kartı: ses dalgası, rozet, "Örnek dinle". */
function FeaturedCard({ item }: { item: StoreItem }) {
  const sample = useSamplePlayer();
  const [loadingSample, setLoadingSample] = useState(false);
  const { exams, subjects } = splitCategories(item);
  const playing = sample.playingKey === "featured";
  const tag = [item.source?.display, item.isFree ? "Ücretsiz" : item.price?.display]
    .filter(Boolean)
    .join(" · ")
    .toLocaleUpperCase("tr-TR");

  const playSample = async () => {
    if (playing) {
      sample.stop();
      return;
    }
    setLoadingSample(true);
    try {
      const detail = (await getItemApi({ id: item.id })).data;
      const first = detail?.sections.find((section) => section.isSample && section.audioUrl);
      if (!first) {
        Alert.alert("Örnek yok", "Bu içeriğin dinlenebilir örnek bölümü yok.");
        return;
      }
      void sample.toggle("featured", first.audioUrl);
    } catch (error) {
      Alert.alert("Örnek açılamadı", getApiErrorMessage(error));
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Öne çıkan: ${item.title}`}
      onPress={() =>
        router.push({ pathname: "/store/items/[id]", params: { id: String(item.id) } })
      }
      className="mt-4 gap-2.5 overflow-hidden rounded-[22px] bg-brand-blue-deep p-[18px]"
    >
      <View
        pointerEvents="none"
        className="absolute bottom-4 right-4 top-4 flex-row items-center gap-1 opacity-35"
      >
        {[30, 60, 88, 52, 72, 34].map((height, index) => (
          <View
            key={index}
            className="w-[5px] rounded-[3px]"
            style={{ height, backgroundColor: index % 2 === 0 ? "#96A6F9" : "#FFFFFF" }}
          />
        ))}
      </View>
      <View className="self-start rounded-md bg-white px-2 py-1">
        <Text className="text-[11px] font-extrabold tracking-[0.66px] text-brand-blue-deep">
          {tag}
        </Text>
      </View>
      <Text className="max-w-[230px] font-display text-[22px] leading-[24px] tracking-[-0.44px] text-white">
        {item.title}
      </Text>
      <Text className="text-[13px] text-brand-mist">
        {[...exams, ...subjects]
          .map((category) => category.name)
          .concat(item.credit ? [item.credit] : [])
          .join(" · ")}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Örneği durdur" : "Örnek dinle"}
        onPress={() => void playSample()}
        className="mt-1 h-[38px] flex-row items-center gap-1.5 self-start rounded-xl bg-white px-3.5"
      >
        {loadingSample ? (
          <ActivityIndicator size="small" color="#1322A0" />
        ) : (
          <PlayGlyph color="#1322A0" playing={playing} />
        )}
        <Text className="text-sm font-bold text-brand-blue-deep">
          {playing ? "Durdur" : "Örnek dinle"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#575C7A" strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4-4" />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#2D40E5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

/** "Not mağazası": arama, sınav çipleri, öne çıkan, Dinlet özgün anlatımlar. */
export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [examId, setExamId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");

  // Yazarken her harfte istek atılmasın.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const home = useCraftQuery("store", "home", [], { refetchOnScreenFocus: true });
  const original = useCraftQuery("store", "listItems", [
    { source: "ORIGINAL", categoryId: examId ?? undefined, limit: ORIGINAL_LIMIT },
  ]);
  const results = useCraftInfiniteQuery("store", "catalog", [{ q: search }], {
    enabled: search.length > 0,
  });
  const syncPurchases = useCraftMutation("store", "syncPurchases");

  const data = home.data?.data;
  const featured = useMemo(() => {
    const items = data?.featured ?? [];
    if (examId === null) return items[0] ?? null;
    return (
      items.find((item) =>
        item.categories.some((category) => category.id === examId || category.parentId === examId)
      ) ?? null
    );
  }, [data?.featured, examId]);
  const originals = original.data?.data ?? [];
  const searchItems = ((results.data?.pages ?? []) as CatalogPage[]).flatMap(
    (page) => page.data ?? []
  );

  const refresh = () =>
    Promise.all([home.refetch(), original.refetch(), search ? results.refetch() : null]);

  const restorePurchases = () =>
    syncPurchases.mutate(undefined, {
      onSuccess: (response) => {
        void queryClient.invalidateQueries({ queryKey: ["store"] });
        void queryClient.invalidateQueries({ queryKey: ["documents"] });
        const granted = response.data?.grantedItemIds.length ?? 0;
        Alert.alert(
          "Satın almaları geri yükle",
          granted > 0
            ? `${granted} içerik hesabına tanımlandı.`
            : "Hesabındaki satın almalar güncel."
        );
      },
      onError: (error) => Alert.alert("Geri yüklenemedi", getApiErrorMessage(error)),
    });

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 12, 60),
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={() => void refresh()}
            tintColor="#1928B4"
          />
        }
      >
        <Text
          accessibilityRole="header"
          className="font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          Mağaza
        </Text>
        <Text className="mt-0.5 text-sm text-brand-ink-soft">
          Hazır, lisanslı sesli anlatımlar.
        </Text>

        <View className="mt-3.5 h-[46px] flex-row items-center gap-2.5 rounded-[14px] bg-brand-lavender px-3.5">
          <SearchIcon />
          <TextInput
            accessibilityLabel="Mağazada ara"
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Konu, ders veya kanun ara"
            placeholderTextColor="#8A8FAD"
            returnKeyType="search"
            onSubmitEditing={() => setSearch(searchText.trim())}
            className="flex-1 text-[15px] font-medium text-brand-ink"
          />
        </View>

        {search ? (
          <View className="mt-3">
            {results.isPending ? (
              <View className="items-center py-16">
                <ActivityIndicator color="#1928B4" />
              </View>
            ) : results.isError ? (
              <FormError>{getApiErrorMessage(results.error)}</FormError>
            ) : searchItems.length === 0 ? (
              <Text className="py-10 text-center text-[15px] text-brand-muted">
                “{search}” için içerik bulunamadı.
              </Text>
            ) : (
              <>
                {searchItems.map((item) => (
                  <StoreCompactRow key={item.id} item={item} />
                ))}
                {results.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void results.fetchNextPage()}
                    className="items-center py-4"
                  >
                    {results.isFetchingNextPage ? (
                      <ActivityIndicator color="#1928B4" />
                    ) : (
                      <Text className="text-sm font-bold text-brand-indigo">Daha fazla</Text>
                    )}
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        ) : home.isPending ? (
          <View className="items-center py-24">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : home.isError || !data ? (
          <FormError>{getApiErrorMessage(home.error)}</FormError>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel="Sınav"
              className="-mx-5 mt-3"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              <StoreChip label="Tümü" selected={examId === null} onPress={() => setExamId(null)} />
              {data.categories.map((exam) => (
                <StoreChip
                  key={exam.id}
                  label={exam.name}
                  selected={examId === exam.id}
                  onPress={() => setExamId(exam.id)}
                />
              ))}
            </ScrollView>

            {featured ? <FeaturedCard item={featured} /> : null}

            <View className="mt-5 flex-row items-baseline justify-between">
              <Text className="font-display text-lg text-brand-ink">Dinlet özgün anlatımlar</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Tüm içerikler"
                onPress={() =>
                  router.push({
                    pathname: "/store/category/[id]",
                    params: { id: examId === null ? "all" : String(examId) },
                  })
                }
                hitSlop={8}
                className="py-1.5"
              >
                <Text className="text-[13px] font-bold text-brand-indigo">Tümü</Text>
              </Pressable>
            </View>
            {original.isPending ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#1928B4" />
              </View>
            ) : originals.length === 0 ? (
              <Text className="py-6 text-sm text-brand-muted">
                Bu sınavda henüz Dinlet özgün anlatım yok. “Tümü”nden diğer içeriklere bakabilirsin.
              </Text>
            ) : (
              <View>
                {originals.map((item) => (
                  <StoreCompactRow key={item.id} item={item} />
                ))}
              </View>
            )}

            <View className="mt-3 flex-row items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[#C5CCF7] px-3.5 py-3">
              <ShieldIcon />
              <Text className="flex-1 text-[13px] leading-[18px] text-brand-body">
                Mağazadaki içerikler lisanslı ya da editör onaylı. Yüklediğin notlar sen
                paylaşmadıkça kimseyle paylaşılmaz.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notunu paylaş: Paylaştıklarım"
              onPress={() => router.push("/store/submissions")}
              className="mt-3 flex-row items-center gap-3 rounded-[18px] bg-brand-lavender p-3.5"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold text-brand-ink">Notunu paylaş</Text>
                <Text className="text-[13px] leading-[18px] text-brand-ink-soft">
                  Kendi notunu herkesin ücretsiz dinlemesi için gönder; editör onayından sonra
                  burada görünür.
                </Text>
              </View>
              <Text className="text-sm font-bold text-brand-indigo">Paylaştıklarım</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={restorePurchases}
              disabled={syncPurchases.isPending}
              className="mt-4 items-center py-2"
            >
              {syncPurchases.isPending ? (
                <ActivityIndicator color="#1928B4" />
              ) : (
                <Text className="text-[13px] font-bold text-brand-indigo">
                  Satın almaları geri yükle
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
