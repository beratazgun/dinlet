import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DownloadedItemRow,
  EmptyDownloads,
  InFlightItemRow,
  StorageSummaryCard,
} from "@/components/downloads";
import { useDownloads } from "@/context/downloads-context";

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const {
    downloadedDocuments,
    inFlightDownloads,
    totalDownloadBytes,
    downloadOnlyOnWifi,
    isLoading,
    setDownloadOnlyOnWifi,
    cancelDownload,
    deleteDownload,
    refreshDownloads,
  } = useDownloads();

  const inFlightList = Object.values(inFlightDownloads);
  const hasItems = downloadedDocuments.length > 0 || inFlightList.length > 0;

  function openDocument(id: number) {
    router.push({
      pathname: "/documents/[id]",
      params: { id: String(id) },
    });
  }

  return (
    <View
      className="flex-1 bg-[#FCFCFD]"
      style={{ paddingTop: Math.max(insets.top, 24) + 12 }}
    >
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 24) + 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void refreshDownloads()}
            tintColor="#1928B4"
          />
        }
      >
        {/* Başlık Alanı */}
        <View>
          <Text
            accessibilityRole="header"
            className="font-display text-[28px] font-extrabold tracking-[-0.84px] text-[#0E1238]"
          >
            İndirilenler
          </Text>
          <Text className="mt-1 text-sm font-medium text-[#575C7A]">
            İnternet olmadan dinleyebilirsin.
          </Text>
        </View>

        {/* Depolama Özeti Kartı */}
        <StorageSummaryCard
          totalBytes={totalDownloadBytes}
          downloadOnlyOnWifi={downloadOnlyOnWifi}
          onToggleWifi={(val) => void setDownloadOnlyOnWifi(val)}
        />

        {/* İçerik / Liste */}
        {isLoading && !hasItems ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="small" color="#1928B4" />
          </View>
        ) : !hasItems ? (
          <EmptyDownloads />
        ) : (
          <View className="mt-2 flex-col">
            {/* Devam Eden İndirmeler */}
            {inFlightList.map((item) => (
              <InFlightItemRow
                key={item.documentId}
                item={item}
                onCancel={() => cancelDownload(item.documentId)}
              />
            ))}

            {/* Tamamlanmış İndirmeler */}
            {downloadedDocuments.map((doc) => (
              <DownloadedItemRow
                key={doc.id}
                item={doc}
                onPress={() => openDocument(doc.id)}
                onDelete={() => void deleteDownload(doc.id)}
              />
            ))}

            {/* Alt Bilgilendirme Notu */}
            <Text className="mt-4 text-[13px] leading-[1.45] text-[#6B7090]">
              Yeni bölümler hazır oldukça indirmeye otomatik eklenir.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
