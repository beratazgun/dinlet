import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowDownToLine,
  AudioLines,
  BookOpen,
  Mic,
  Check,
  ChevronLeft,
  Folder,
  MoreVertical,
  Pause,
  Play,
  Plus,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { formatDuration } from "@/lib/format";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";
import { usePlayer } from "@/context/player-context";
import { useDownloads } from "@/context/downloads-context";
import {
  FolderGlyph,
  FolderSheet,
  OrganizeSheet,
  type StudyFolder,
} from "@/components/collections";
import { ListenModeSheet } from "@/components/study/listen-mode-sheet";
import { useUserSettings } from "@/hooks/use-user-settings";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { RenameDialog } from "./rename-dialog";
import { SectionDetailSheet } from "./section-detail-sheet";

type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;

export function DocumentReadyView({
  document,
  onPlaySection,
}: {
  document: DocumentDetail;
  onPlaySection?: (sectionId: number) => void;
}) {
  const queryClient = useQueryClient();
  const player = usePlayer();
  const downloads = useDownloads();
  const [renameOpen, setRenameOpen] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [listenModeOpen, setListenModeOpen] = useState(false);
  const { settings } = useUserSettings();
  const coverage = useCraftQuery("documents", "getCoverage", [{ id: document.id }]);
  const collectionsQuery = useCraftQuery("study", "getCollections", []);
  const folders = collectionsQuery.data?.data?.folders ?? [];
  const currentFolder = document.folderId
    ? (folders.find((f) => f.id === document.folderId) ?? null)
    : null;
  const [readingSectionId, setReadingSectionId] = useState<number | null>(null);

  /** Bölümü kendi sesinle kaydetme ekranı (kayıt varsa kaldığı paragraftan). */
  const openRecorder = (sectionId: number) =>
    router.push({ pathname: "/record/[sectionId]", params: { sectionId: String(sectionId) } });

  // Seslendirme açıkken sorular kısmına gelindiğinde metin okuma paneli açıksa otomatik kapatılır
  useEffect(() => {
    if (player.activeOutroQuiz && readingSectionId !== null) {
      setReadingSectionId(null);
    }
  }, [player.activeOutroQuiz, readingSectionId]);

  const renameMutation = useCraftMutation("documents", "rename");
  const deleteMutation = useCraftMutation("documents", "deleteItem");

  const isDownloaded = downloads.isDocumentDownloaded(document.id);
  const isDownloading = downloads.isDocumentDownloading(document.id);

  const sections = document.sections ?? [];
  const isFluent = document.rewriteMode?.raw === "FLUENT";
  const modeText = isFluent ? "Akıcı anlatım" : "Düz okuma";

  const isCurrentDoc = player.currentDocument?.id === document.id;
  const isPlaying = isCurrentDoc && player.isPlaying;
  const hasActiveSession = isCurrentDoc && !!player.currentSection;

  // İlerleme ve ilk dinlenecek bölüm
  const completedCount = isCurrentDoc ? player.currentSectionIndex : 0;
  const totalCount = sections.length;
  const ratio =
    totalCount > 0
      ? isCurrentDoc
        ? (player.currentSectionIndex +
            (player.durationMs > 0 ? player.positionMs / player.durationMs : 0)) /
          totalCount
        : 0
      : 0;

  const firstSection = sections[0];

  function handleDownloadPress() {
    if (isDownloaded) {
      Alert.alert(
        "İndirilen Not",
        `"${document.title}" cihazına indirilmiş durumda. İnternet olmadan dinleyebilirsin.`,
        [
          {
            text: "İndirmeyi Cihazdan Sil",
            style: "destructive",
            onPress: () => void downloads.deleteDownload(document.id),
          },
          { text: "Tamam", style: "default" },
        ]
      );
    } else if (isDownloading) {
      Alert.alert("İndirme Sürüyor", `"${document.title}" notunun sesleri indiriliyor.`, [
        {
          text: "İndirmeyi Durdur",
          style: "destructive",
          onPress: () => downloads.cancelDownload(document.id),
        },
        { text: "Devam Et", style: "default" },
      ]);
    } else {
      void downloads.downloadDocument(document);
    }
  }

  function openOptionsMenu() {
    const options: { text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }[] = [
      {
        text: "Başlığı değiştir",
        onPress: () => setRenameOpen(true),
      },
      {
        text: "Klasör, favori ve etiketler",
        onPress: () => setOrganizeOpen(true),
      },
    ];

    if (isDownloaded) {
      options.push({
        text: "İndirmeyi cihazdan sil",
        style: "destructive",
        onPress: () => void downloads.deleteDownload(document.id),
      });
    } else if (isDownloading) {
      options.push({
        text: "İndirmeyi durdur",
        style: "destructive",
        onPress: () => downloads.cancelDownload(document.id),
      });
    } else {
      options.push({
        text: "Cihaza indir (Çevrimdışı dinle)",
        onPress: () => void downloads.downloadDocument(document),
      });
    }

    // Mağazadan eklenen içerik yeniden paylaşılamaz.
    if (document.storeItemId === null) {
      options.push({
        text: "Mağazada paylaş",
        onPress: () =>
          router.push({
            pathname: "/store/share/[documentId]",
            params: { documentId: String(document.id) },
          }),
      });
    }

    options.push({
      text: "Notu sil",
      style: "destructive",
      onPress: () => confirmDelete(),
    });

    options.push({
      text: "Vazgeç",
      style: "cancel",
    });

    Alert.alert("Not Seçenekleri", document.title, options);
  }

  function confirmDelete() {
    Alert.alert(
      "Notu Sil",
      `"${document.title}" notu ve tüm sesleri silinecek. Bu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await deleteMutation.mutateAsync({ id: document.id });
            await queryClient.invalidateQueries({ queryKey: ["documents"] });
            router.replace("/");
          },
        },
      ]
    );
  }

  async function handleRename(newTitle: string) {
    await renameMutation.mutateAsync({
      params: { id: document.id },
      body: { title: newTitle },
    });
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    setRenameOpen(false);
  }

  async function removeFolderFromDoc() {
    try {
      await renameMutation.mutateAsync({
        params: { id: document.id },
        body: { folderId: null },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["collections"] }),
      ]);
    } catch (err) {
      Alert.alert("Hata", getApiErrorMessage(err));
    }
  }

  function handleFolderPress(folder: StudyFolder) {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: folder.name,
          options: ["Vazgeç", "Klasöre git", "Klasörü değiştir", "Klasörden çıkar"],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            router.push({
              pathname: "/collection",
              params: { folderId: String(folder.id), title: folder.name },
            });
          } else if (buttonIndex === 2) {
            setOrganizeOpen(true);
          } else if (buttonIndex === 3) {
            void removeFolderFromDoc();
          }
        }
      );
    } else {
      Alert.alert(folder.name, "Klasör işlemleri", [
        {
          text: "Klasöre git",
          onPress: () =>
            router.push({
              pathname: "/collection",
              params: { folderId: String(folder.id), title: folder.name },
            }),
        },
        {
          text: "Klasörü değiştir",
          onPress: () => setOrganizeOpen(true),
        },
        {
          text: "Klasörden çıkar",
          style: "destructive",
          onPress: () => void removeFolderFromDoc(),
        },
        { text: "Vazgeç", style: "cancel" },
      ]);
    }
  }

  const header = (
    <View className="rounded-b-[28px] bg-brand-lavender px-5 pb-5 pt-3">
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Seçenekler"
          onPress={openOptionsMenu}
          className="-mr-2.5 h-11 w-11 items-center justify-center"
        >
          <MoreVertical size={20} color="#0E1238" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Başlık */}
      <Text
        accessibilityRole="header"
        className="mt-2 font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.9px] text-brand-ink"
      >
        {document.title}
      </Text>

      {/* Meta Bilgileri */}
      <View className="mt-2 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="text-[13px] font-medium text-brand-ink-soft">
          {document.pageCount} sayfa
        </Text>
        <Text className="text-[13px] text-brand-line">·</Text>
        <Text className="text-[13px] font-medium text-brand-ink-soft">
          {sections.length} bölüm
        </Text>
        {document.totalDurationMs ? (
          <>
            <Text className="text-[13px] text-brand-line">·</Text>
            <Text className="text-[13px] font-medium text-brand-ink-soft">
              {formatDuration(document.totalDurationMs)}
            </Text>
          </>
        ) : null}
        <Text className="text-[13px] text-brand-line">·</Text>
        <Text className="text-[13px] font-bold text-brand-indigo">{modeText}</Text>
      </View>

      {/* Aksiyon Butonu */}
      <View className="mt-4.5 flex-row gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isPlaying
              ? "Duraklat"
              : hasActiveSession
                ? "Dinlemeye devam et"
                : "Dinlemeye başla"
          }
          onPress={() => {
            if (hasActiveSession) {
              void player.togglePlayPause();
            } else if (firstSection) {
              onPlaySection?.(firstSection.id);
            }
          }}
          className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-indigo active:opacity-90"
        >
          {isPlaying ? (
            <>
              <Pause size={18} color="#FFFFFF" fill="#FFFFFF" />
              <Text className="text-base font-bold text-white">Duraklat</Text>
            </>
          ) : (
            <>
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
              <Text className="text-base font-bold text-white">
                {hasActiveSession ? "Dinlemeye devam et" : "Dinlemeye başla"}
              </Text>
            </>
          )}
        </Pressable>

        {/* İndirme Butonu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isDownloaded
              ? "İndirildi"
              : isDownloading
                ? "İndiriliyor"
                : "Cihaza indir"
          }
          onPress={handleDownloadPress}
          className={`h-[52px] w-[52px] items-center justify-center rounded-2xl border-[1.5px] ${
            isDownloaded
              ? "border-brand-indigo/20 bg-white"
              : isDownloading
                ? "border-brand-blue-vivid/30 bg-[#EEF0FB]"
                : "border-brand-line bg-white"
          } active:opacity-80`}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color="#1928B4" />
          ) : isDownloaded ? (
            <Check size={20} color="#1928B4" strokeWidth={2.4} />
          ) : (
            <ArrowDownToLine size={20} color="#0E1238" strokeWidth={2} />
          )}
        </Pressable>

        {hasActiveSession ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Oynatıcıyı aç"
            onPress={() => router.push("/(app)/player")}
            className="h-[52px] w-[52px] items-center justify-center rounded-2xl border-[1.5px] border-brand-indigo/20 bg-white active:opacity-80"
          >
            <AudioLines size={20} color="#1928B4" strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {/* İlerleme Çubuğu */}
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-brand-ink-soft">
          {completedCount} / {totalCount} bölüm dinlendi
        </Text>
      </View>
      <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#DDE1F7]">
        <View
          className="h-full rounded-full bg-brand-blue-vivid"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </View>

      {/* Çalışma araçları: kapsam, dinleme modu, hafıza kancaları, sorular, klasör, yeni klasör */}
      <View className="mt-3.5 flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapsam güvencesi"
          onPress={() =>
            router.push({ pathname: "/coverage/[id]", params: { id: String(document.id) } })
          }
          className="h-9 flex-row items-center gap-1.5 rounded-full bg-brand-indigo px-3 active:opacity-80"
        >
          <Check size={14} strokeWidth={2.6} color="#FFFFFF" />
          <Text className="text-[13px] font-bold text-white">
            Kapsam{coverage.data?.data ? ` %${coverage.data.data.percent}` : ""}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dinleme modu"
          onPress={() => setListenModeOpen(true)}
          className="h-9 justify-center rounded-full border-[1.5px] border-[#D5D9EE] bg-white px-3 active:opacity-80"
        >
          <Text className="text-[13px] font-bold text-brand-indigo">
            {settings.listenMode === "quick" ? "Hızlı tekrar" : "Tam anlatım"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kendi sesinle kaydet"
          onPress={() => {
            const first = sections[0];
            if (first) openRecorder(first.id);
          }}
          className="h-9 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-[#D5D9EE] bg-white px-3 active:opacity-80"
        >
          <Mic size={14} color="#1928B4" strokeWidth={2.2} />
          <Text className="text-[13px] font-bold text-brand-indigo">Kendi sesinle</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hafıza kancaları"
          onPress={() =>
            router.push({ pathname: "/mnemonics/[id]", params: { id: String(document.id) } })
          }
          className="h-9 justify-center rounded-full border-[1.5px] border-[#D5D9EE] bg-white px-3 active:opacity-80"
        >
          <Text className="text-[13px] font-bold text-brand-indigo">Hafıza kancaları</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sorular"
          onPress={() => {
            const first = sections[0];
            if (first) {
              router.push({
                pathname: "/(app)/quiz",
                params: {
                  sectionId: String(first.id),
                  documentId: String(document.id),
                },
              });
            }
          }}
          className="h-9 justify-center rounded-full border-[1.5px] border-[#D5D9EE] bg-white px-3 active:opacity-80"
        >
          <Text className="text-[13px] font-bold text-brand-indigo">Sorular</Text>
        </Pressable>
        {currentFolder ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Klasör: ${currentFolder.name}`}
            onPress={() => handleFolderPress(currentFolder)}
            className="h-9 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-[#D5D9EE] bg-white px-3 active:opacity-80"
          >
            <FolderGlyph color={currentFolder.color} scale={0.45} />
            <Text className="max-w-[130px] text-[13px] font-bold text-brand-indigo" numberOfLines={1}>
              {currentFolder.name}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Klasör"
            onPress={() => setOrganizeOpen(true)}
            className="h-9 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-[#D5D9EE] bg-white px-3 active:opacity-80"
          >
            <Folder size={14} color="#1928B4" />
            <Text className="text-[13px] font-bold text-brand-indigo">Klasör</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeni klasör oluştur"
          onPress={() => setNewFolderOpen(true)}
          className="h-9 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#B7BCD6] bg-white/70 px-3 active:opacity-80"
        >
          <Plus size={14} strokeWidth={2.4} color="#1928B4" />
          <Text className="text-[13px] font-bold text-brand-indigo">Yeni klasör</Text>
        </Pressable>
      </View>
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
          const isCurrentSection = isCurrentDoc && player.currentSection?.id === item.id;
          const isSectionPlaying = isCurrentSection && player.isPlaying;

          return (
            <View
              className={`flex-row items-center justify-between border-b border-[#EEF0F7] px-5 py-3.5 ${
                isCurrentSection ? "bg-brand-lavender/35" : ""
              }`}
            >
              <Pressable
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
                    isCurrentSection ? "bg-brand-indigo" : "bg-brand-surface"
                  }`}
                >
                  {isSectionPlaying ? (
                    <AudioLines size={16} color="#FFFFFF" strokeWidth={2.2} />
                  ) : isCurrentSection ? (
                    <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Text className="font-mono text-xs font-bold text-brand-indigo">
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                  )}
                </View>

                <View className="flex-1 gap-0.5">
                  <Text
                    numberOfLines={1}
                    className={`text-[15px] font-semibold ${
                      isCurrentSection ? "text-brand-indigo" : "text-brand-ink"
                    }`}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-xs text-brand-ink-soft">
                    {isSectionPlaying
                      ? "Şimdi dinleniyor"
                      : isCurrentSection
                        ? "Duraklatıldı"
                        : item.durationMs
                          ? formatDuration(item.durationMs)
                          : ""}
                  </Text>
                </View>
              </Pressable>

              {/* Kendi sesinle kaydet */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title} bölümünü kendi sesinle kaydet`}
                onPress={() => openRecorder(item.id)}
                className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-brand-lavender active:opacity-70"
              >
                <Mic size={16} color="#1928B4" strokeWidth={2} />
              </Pressable>

              {/* Metin Oku Butonu */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title} metnini oku`}
                onPress={() => setReadingSectionId(item.id)}
                className="h-9 w-9 items-center justify-center rounded-full bg-brand-lavender active:opacity-70"
              >
                <BookOpen size={16} color="#1928B4" strokeWidth={2} />
              </Pressable>
            </View>
          );
        }}
      />

      {/* Başlık Değiştirme Modalı */}
      <ListenModeSheet
        visible={listenModeOpen}
        onClose={() => setListenModeOpen(false)}
        documentId={document.id}
        sectionTitle={document.title}
        section={sections[0] ?? null}
        sections={sections}
      />

      <OrganizeSheet
        visible={organizeOpen}
        document={{
          id: document.id,
          title: document.title,
          folderId: document.folderId,
          isFavorite: document.isFavorite,
          tags: document.tags ?? [],
        }}
        onClose={() => setOrganizeOpen(false)}
      />

      <FolderSheet
        visible={newFolderOpen}
        folder={null}
        onClose={() => setNewFolderOpen(false)}
        onCreated={async (newFolderId) => {
          try {
            await renameMutation.mutateAsync({
              params: { id: document.id },
              body: { folderId: newFolderId },
            });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["documents"] }),
              queryClient.invalidateQueries({ queryKey: ["collections"] }),
            ]);
          } catch (err) {
            Alert.alert("Hata", getApiErrorMessage(err));
          }
        }}
      />

      <RenameDialog
        visible={renameOpen}
        currentTitle={document.title}
        isPending={renameMutation.isPending}
        onSave={(newTitle) => void handleRename(newTitle)}
        onClose={() => setRenameOpen(false)}
      />

      {/* Bölüm Metni Okuma Paneli */}
      <SectionDetailSheet
        visible={readingSectionId !== null}
        sectionId={readingSectionId}
        documentTitle={document.title}
        onClose={() => setReadingSectionId(null)}
      />
    </View>
  );
}
