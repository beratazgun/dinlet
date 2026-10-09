import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftInfiniteQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { DocumentRow, type LibraryDocument } from "@/components/library";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type {
  CollectionFilter,
  ListDocumentApiResponse,
} from "@/networks/api/documents/documents";

type Page = ListDocumentApiResponse["SuccessResponse"];

/** Klasör, etiket, favoriler veya "Bu hafta" ile süzülmüş notlar. */
export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    title?: string;
    folderId?: string;
    tagId?: string;
    favorite?: string;
    addedWithinDays?: string;
  }>();

  const filter: CollectionFilter = {
    folderId: params.folderId ? Number(params.folderId) : undefined,
    tagId: params.tagId ? Number(params.tagId) : undefined,
    favorite: params.favorite === "true" ? true : undefined,
    addedWithinDays: params.addedWithinDays ? Number(params.addedWithinDays) : undefined,
  };
  const query = useCraftInfiniteQuery("documents", "collection", [filter], {
    refetchOnScreenFocus: true,
  });
  const documents: LibraryDocument[] = ((query.data?.pages ?? []) as Page[]).flatMap(
    (page) => page.data ?? []
  );

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <FlatList
        data={documents}
        keyExtractor={(document) => String(document.id)}
        renderItem={({ item }) => (
          <DocumentRow
            document={item}
            onPress={() =>
              router.push({ pathname: "/documents/[id]", params: { id: String(item.id) } })
            }
          />
        )}
        ListHeaderComponent={
          <View className="mb-2">
            <BackButton onPress={() => router.back()} />
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              className="mt-1.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
            >
              {params.title ?? "Notlar"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#1928B4" />
            </View>
          ) : query.isError ? (
            <FormError>{getApiErrorMessage(query.error)}</FormError>
          ) : (
            <Text className="py-12 text-center text-[15px] leading-[22px] text-brand-ink-soft">
              Burada henüz not yok. Not sayfasındaki "Düzenle" ile ekleyebilirsin.
            </Text>
          )
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor="#1928B4"
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 24, 40),
        }}
      />
    </View>
  );
}
