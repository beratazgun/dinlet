import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftInfiniteQuery, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { StoreCatalogRow, StoreChip } from "@/components/store";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { ListItemsApiResponse, StoreCatalogFilter } from "@/networks/api/store/store";

type CatalogPage = ListItemsApiResponse["SuccessResponse"];
type PriceFilter = "all" | "free" | "paid";

const PRICE_FILTERS: { id: PriceFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "free", label: "Ücretsiz" },
  { id: "paid", label: "Ücretli" },
];

/** Paket şeridi: "KPSS Tarih, tamamı · 5 içerik · 44 bölüm". */
function BundleBanner({ categoryId }: { categoryId: number }) {
  const bundles = useCraftQuery("store", "listBundles", [{ categoryId, limit: 1 }]);
  const bundle = bundles.data?.data?.[0];
  if (!bundle) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Paket: ${bundle.title}`}
      onPress={() =>
        router.push({ pathname: "/store/bundles/[id]", params: { id: String(bundle.id) } })
      }
      className="mt-3.5 flex-row items-center gap-3 rounded-[18px] bg-brand-indigo p-3.5"
    >
      <View className="flex-1 gap-[3px]">
        <Text className="text-[11px] font-extrabold tracking-[0.66px] text-[#C9D0FD]">PAKET</Text>
        <Text className="text-base font-bold text-white">{bundle.title}</Text>
        <Text className="text-xs text-brand-mist">
          {`${bundle.itemCount} içerik · ${bundle.sectionCount} bölüm · tek tek almaktan uygun`}
        </Text>
      </View>
      <View className="h-[38px] items-center justify-center rounded-xl bg-white px-3">
        <Text className="text-sm font-extrabold text-brand-indigo">
          {bundle.isOwned ? "Sahipsin" : (bundle.price?.display ?? "İncele")}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Katalog: sınav (`id`) ve dersleri sekme olarak, fiyat süzgeci, paket
 * şeridi ve içerikler. `id = "all"` tüm sınavlar.
 */
export default function StoreCategoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const examId = params.id === "all" ? null : Number(params.id);
  const home = useCraftQuery("store", "home");
  const [tabId, setTabId] = useState<number | null>(null);
  const [price, setPrice] = useState<PriceFilter>("all");

  const exam = home.data?.data?.categories.find((category) => category.id === examId) ?? null;
  // Sınavın dersleri; "Tümü"nde sınavların kendisi sekme olur.
  const tabs = (examId === null ? home.data?.data?.categories : exam?.children) ?? [];
  const selectedTab = tabs.find((tab) => tab.id === tabId) ?? null;
  const categoryId = selectedTab?.id ?? examId ?? undefined;

  const filter = useMemo<StoreCatalogFilter>(
    () => ({ categoryId, price: price === "all" ? undefined : price }),
    [categoryId, price]
  );
  const catalog = useCraftInfiniteQuery("store", "catalog", [filter], {
    refetchOnScreenFocus: true,
  });
  const items = ((catalog.data?.pages ?? []) as CatalogPage[]).flatMap((page) => page.data ?? []);

  const overline = examId === null ? "Mağaza" : (exam?.name ?? "");
  const title = selectedTab?.name ?? (examId === null ? "Tüm içerikler" : (exam?.name ?? ""));

  const header = (
    <View>
      <View className="flex-row items-center gap-1.5">
        <BackButton onPress={() => router.back()} />
        <View>
          <Text className="text-xs font-semibold text-brand-ink-soft">{overline}</Text>
          <Text
            accessibilityRole="header"
            className="font-display text-2xl tracking-[-0.48px] text-brand-ink"
          >
            {title}
          </Text>
        </View>
      </View>

      {tabs.length > 0 ? (
        <View
          accessibilityRole="tablist"
          className="mt-2.5 flex-row flex-wrap gap-x-[18px] border-b border-[#E9EBF5]"
        >
          {[{ id: null as number | null, name: "Tümü" }, ...tabs].map((tab) => {
            const selected = (tab.id ?? null) === (selectedTab?.id ?? null);
            return (
              <Pressable
                key={tab.id ?? "all"}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTabId(tab.id)}
                className="py-2.5"
                style={{
                  borderBottomWidth: 2.5,
                  borderBottomColor: selected ? "#1928B4" : "transparent",
                }}
              >
                <Text
                  className="text-sm"
                  style={{ color: selected ? "#1928B4" : "#6B7090", fontWeight: selected ? "700" : "600" }}
                >
                  {tab.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {categoryId !== undefined ? <BundleBanner categoryId={categoryId} /> : null}

      <View accessibilityLabel="Fiyat" className="mt-3.5 flex-row gap-2">
        {PRICE_FILTERS.map((option) => (
          <StoreChip
            key={option.id}
            label={option.label}
            selected={price === option.id}
            onPress={() => setPrice(option.id)}
          />
        ))}
      </View>
      {catalog.isError ? (
        <View className="mt-3">
          <FormError>{getApiErrorMessage(catalog.error)}</FormError>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <StoreCatalogRow item={item} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        ListEmptyComponent={
          catalog.isPending ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#1928B4" />
            </View>
          ) : catalog.isError ? null : (
            <Text className="py-12 text-center text-[15px] text-brand-muted">
              Bu süzgeçte henüz içerik yok.
            </Text>
          )
        }
        ListFooterComponent={
          catalog.isFetchingNextPage ? (
            <View className="items-center py-4">
              <ActivityIndicator color="#1928B4" />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (catalog.hasNextPage && !catalog.isFetchingNextPage) void catalog.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 24, 32),
        }}
      />
    </View>
  );
}
