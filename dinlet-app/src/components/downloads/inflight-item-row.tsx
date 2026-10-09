import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";
import type { InFlightDownload } from "@/lib/downloads";

export function InFlightItemRow({
  item,
  onCancel,
}: {
  item: InFlightDownload;
  onCancel: () => void;
}) {
  const percent = Math.min(100, Math.max(5, item.progressPercent));

  return (
    <View className="flex-row items-center gap-3.5 border-b border-[#EEF0F7] py-3.5">
      {/* Küçük Kitapçık / Kapak İkonu (Açık Mor Zemin) */}
      <View className="h-14 w-[46px] flex-none justify-end gap-1 rounded-[10px] bg-[#EEF0FB] p-2">
        <View className="h-1 w-[80%] rounded-sm bg-[#96A6F9]" />
        <View className="h-1 w-full rounded-sm bg-[#96A6F9] opacity-50" />
      </View>

      {/* İlerleme Bilgileri */}
      <View className="min-w-0 flex-1 gap-1.5">
        <Text numberOfLines={1} className="text-base font-bold text-[#0E1238]">
          {item.documentTitle}
        </Text>
        <Text numberOfLines={1} className="text-[13px] font-semibold text-[#2D40E5]">
          İndiriliyor · {item.completedSections} / {item.totalSections} hazır bölüm
        </Text>

        {/* İnce İlerleme Çubuğu */}
        <View className="h-1 overflow-hidden rounded-sm bg-[#E4E7F6]">
          <View
            className="h-full rounded-sm bg-[#2D40E5]"
            style={{ width: `${percent}%` }}
          />
        </View>
      </View>

      {/* İptal / Durdurma Butonu */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="İndirmeyi durdur"
        onPress={onCancel}
        className="-mr-2 h-11 w-11 items-center justify-center active:opacity-60"
      >
        <X size={20} color="#575C7A" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
