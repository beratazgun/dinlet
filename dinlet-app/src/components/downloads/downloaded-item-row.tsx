import { Alert, Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import type { DownloadedDocument } from "@/lib/downloads";
import { formatBytes, formatDuration } from "@/lib/format";

export function DownloadedItemRow({
  item,
  onPress,
  onDelete,
}: {
  item: DownloadedDocument;
  onPress: () => void;
  onDelete: () => void;
}) {
  const sectionCount = item.sections.length;
  const durationText = item.totalDurationMs
    ? ` · ${formatDuration(item.totalDurationMs)}`
    : "";
  const sizeText = item.totalByteSize ? ` · ${formatBytes(item.totalByteSize)}` : "";
  const metaText = `${sectionCount} / ${sectionCount} bölüm${durationText}${sizeText}`;

  function handleLongPress() {
    Alert.alert("İndirilen Not", item.title, [
      {
        text: "Notu Aç",
        onPress,
      },
      {
        text: "İndirmeyi Cihazdan Sil",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "İndirmeyi Sil",
            `"${item.title}" notunun indirilmiş ses dosyaları silinecek. Notun kütüphanende kalmaya devam edecek.`,
            [
              { text: "Vazgeç", style: "cancel" },
              { text: "Sil", style: "destructive", onPress: onDelete },
            ]
          );
        },
      },
      {
        text: "Kapat",
        style: "cancel",
      },
    ]);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. İndirildi. ${metaText}`}
      onPress={onPress}
      onLongPress={handleLongPress}
      className="flex-row items-center gap-3.5 border-b border-[#EEF0F7] py-3.5 active:opacity-70"
    >
      {/* Küçük Kitapçık / Kapak İkonu (Koyu İndigo Zemin, Beyaz Çizgiler) */}
      <View className="h-14 w-[46px] flex-none justify-end gap-1 rounded-[10px] bg-brand-indigo p-2">
        <View className="h-1 w-[80%] rounded-sm bg-white" />
        <View className="h-1 w-full rounded-sm bg-white opacity-50" />
      </View>

      {/* Not Başlığı ve Süre/Boyut Bilgisi */}
      <View className="min-w-0 flex-1 gap-1">
        <Text numberOfLines={1} className="text-base font-bold text-[#0E1238]">
          {item.title}
        </Text>
        <Text numberOfLines={1} className="text-[13px] text-[#575C7A]">
          {metaText}
        </Text>
      </View>

      {/* İndirildi Onay Rozeti (Mavi Yuvarlak ve Beyaz Tik) */}
      <View
        accessibilityLabel="İndirildi"
        className="h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-indigo"
      >
        <Check size={14} color="#FFFFFF" strokeWidth={3} />
      </View>
    </Pressable>
  );
}
