import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import {
  CollectionChip,
  FolderCard,
  FolderSheet,
  GoalCard,
  GoalSheet,
  NameSheet,
  type StudyFolder,
} from "@/components/collections";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

type TagSheetState = { mode: "create" } | { mode: "edit"; id: number; name: string } | null;

function openCollection(params: Record<string, string>) {
  router.push({ pathname: "/collection", params });
}

/** "Klasörlerin": sınav hedefi, klasörler ve etiketler. */
export default function CollectionsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const collections = useCraftQuery("study", "getCollections", [], { refetchOnScreenFocus: true });
  const createTag = useCraftMutation("study", "createTag");
  const renameTag = useCraftMutation("study", "renameTag");
  const removeTag = useCraftMutation("study", "removeTag");

  const [goalOpen, setGoalOpen] = useState(false);
  const [folderSheet, setFolderSheet] = useState<{ folder: StudyFolder | null } | null>(null);
  const [tagSheet, setTagSheet] = useState<TagSheetState>(null);

  const data = collections.data?.data;

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["collections"] }),
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
    ]);
  }

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 24, 40),
        }}
        refreshControl={
          <RefreshControl
            refreshing={collections.isRefetching}
            onRefresh={() => void collections.refetch()}
            tintColor="#1928B4"
          />
        }
      >
        <View className="flex-row items-center justify-between">
          <BackButton onPress={() => router.back()} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yeni klasör"
            onPress={() => setFolderSheet({ folder: null })}
            className="h-10 flex-row items-center gap-1.5 rounded-xl border-[1.5px] border-brand-line bg-white px-3.5"
          >
            <Plus size={16} strokeWidth={2.4} color="#1928B4" />
            <Text className="text-sm font-bold text-brand-indigo">Klasör</Text>
          </Pressable>
        </View>
        <Text
          accessibilityRole="header"
          className="mt-1.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          Klasörlerin
        </Text>

        {collections.isPending ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : collections.isError || !data ? (
          <View className="mt-4">
            <FormError>{getApiErrorMessage(collections.error)}</FormError>
          </View>
        ) : (
          <>
            <GoalCard goal={data.goal} onPress={() => setGoalOpen(true)} />

            {data.folders.length > 0 ? (
              <View className="mt-4 gap-2.5">
                {chunkPairs(data.folders).map((pair) => (
                  <View key={pair[0]!.id} className="flex-row gap-2.5">
                    {pair.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        onPress={() =>
                          openCollection({ folderId: String(folder.id), title: folder.name })
                        }
                        onLongPress={() => setFolderSheet({ folder })}
                      />
                    ))}
                    {pair.length === 1 ? <View className="flex-1" /> : null}
                  </View>
                ))}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setFolderSheet({ folder: null })}
                className="mt-4 items-center gap-1 rounded-[18px] border-[1.5px] border-dashed border-[#B7BCD6] bg-white px-4 py-6"
              >
                <Text className="text-[15px] font-bold text-brand-ink">İlk klasörünü oluştur</Text>
                <Text className="text-center text-[13px] text-brand-ink-soft">
                  Notlarını derse göre topla: Tarih, Vatandaşlık, Coğrafya…
                </Text>
              </Pressable>
            )}

            <Text
              accessibilityRole="header"
              className="mb-2 mt-[18px] text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted"
            >
              Etiketler
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <CollectionChip
                label="★ Favoriler"
                count={data.favoritesCount}
                highlighted
                onPress={() => openCollection({ favorite: "true", title: "Favoriler" })}
              />
              {data.tags.map((tag) => (
                <CollectionChip
                  key={tag.id}
                  label={tag.name}
                  count={tag.documentCount}
                  onPress={() => openCollection({ tagId: String(tag.id), title: tag.name })}
                  onLongPress={() => setTagSheet({ mode: "edit", id: tag.id, name: tag.name })}
                />
              ))}
              <CollectionChip
                label="Bu hafta"
                count={data.thisWeekCount}
                onPress={() => openCollection({ addedWithinDays: "7", title: "Bu hafta" })}
              />
              <CollectionChip label="+ Etiket" onPress={() => setTagSheet({ mode: "create" })} />
            </View>
            <Text className="mt-3 text-xs leading-[18px] text-brand-muted">
              Klasörü veya etiketi düzenlemek için basılı tut. Notları, not sayfasındaki
              "Düzenle" ile klasöre taşıyıp etiketleyebilirsin.
            </Text>
          </>
        )}
      </ScrollView>

      <GoalSheet visible={goalOpen} goal={data?.goal ?? null} onClose={() => setGoalOpen(false)} />
      <FolderSheet
        visible={folderSheet !== null}
        folder={folderSheet?.folder ?? null}
        onClose={() => setFolderSheet(null)}
      />
      <NameSheet
        visible={tagSheet !== null}
        title={tagSheet?.mode === "edit" ? "Etiketi düzenle" : "Yeni etiket"}
        initialName={tagSheet?.mode === "edit" ? tagSheet.name : ""}
        placeholder="Örn. Zor konular"
        maxLength={30}
        submitLabel={tagSheet?.mode === "edit" ? "Kaydet" : "Etiket oluştur"}
        onSubmit={async (name) => {
          if (tagSheet?.mode === "edit") {
            await renameTag.mutateAsync({ params: { id: tagSheet.id }, body: { name } });
          } else {
            await createTag.mutateAsync({ name });
          }
          await refreshAll();
        }}
        onDelete={
          tagSheet?.mode === "edit"
            ? () => {
                const id = tagSheet.id;
                setTagSheet(null);
                void removeTag.mutateAsync({ id }).then(refreshAll);
              }
            : undefined
        }
        onClose={() => setTagSheet(null)}
      />
    </View>
  );
}

/** İki sütunlu ızgara için ikişerli gruplar. */
function chunkPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    pairs.push(items.slice(index, index + 2));
  }
  return pairs;
}
