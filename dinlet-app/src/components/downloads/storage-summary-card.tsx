import { Pressable, Text, View } from "react-native";
import { formatBytes } from "@/lib/format";

function SwitchToggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (val: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      className="h-[30px] w-[50px] justify-center rounded-full p-[3px]"
      style={{
        backgroundColor: value ? "#1928B4" : "#C5CAE3",
        alignItems: value ? "flex-end" : "flex-start",
      }}
    >
      <View
        className="h-6 w-6 rounded-full bg-white"
        style={{
          shadowColor: "#0E1238",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

export function StorageSummaryCard({
  totalBytes,
  downloadOnlyOnWifi,
  onToggleWifi,
}: {
  totalBytes: number;
  downloadOnlyOnWifi: boolean;
  onToggleWifi: (val: boolean) => void;
}) {
  const formattedSize = totalBytes > 0 ? formatBytes(totalBytes) : "0 MB";

  // Çift renkli çubuk hesaplaması: İndirilen sesler ve önbellek/diğer veriler
  const hasDownloads = totalBytes > 0;
  const primaryWidth = hasDownloads ? "52%" : "0%";
  const secondaryWidth = hasDownloads ? "28%" : "0%";

  return (
    <View className="mt-4.5 gap-2.5 rounded-[18px] bg-[#F4F5FD] p-4">
      {/* Üst Başlık ve Boyut */}
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold text-[#575C7A]">Bu cihazda</Text>
        <Text
          accessibilityRole="text"
          className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#0E1238]"
        >
          {formattedSize}
        </Text>
      </View>

      {/* İlerleme ve Depolama Çubuğu */}
      <View className="h-2 flex-row gap-0.5 overflow-hidden rounded-full bg-[#DDE1F7]">
        {hasDownloads ? (
          <>
            <View style={{ width: primaryWidth }} className="h-full bg-brand-indigo" />
            <View style={{ width: secondaryWidth }} className="h-full bg-[#96A6F9]" />
          </>
        ) : null}
      </View>

      {/* Yalnızca Wi-Fi Seçeneği */}
      <View className="flex-row items-center justify-between gap-3 pt-1">
        <Text className="text-sm font-semibold text-[#0E1238]">
          Yalnızca Wi‑Fi ile indir
        </Text>
        <SwitchToggle
          value={downloadOnlyOnWifi}
          onValueChange={onToggleWifi}
          accessibilityLabel="Yalnızca Wi-Fi ile indir"
        />
      </View>
    </View>
  );
}
