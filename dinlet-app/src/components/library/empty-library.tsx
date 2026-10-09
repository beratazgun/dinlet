import { Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { AuthButton } from "@/components/auth";

const MARK_BARS = [
  { height: 14, color: "bg-white" },
  { height: 28, color: "bg-white" },
  { height: 38, color: "bg-brand-accent" },
  { height: 22, color: "bg-brand-accent" },
  { height: 12, color: "bg-brand-accent" },
];

const SHADOW = {
  shadowColor: "#1928B4",
  shadowOpacity: 0.1,
  shadowRadius: 15,
  shadowOffset: { width: 0, height: 12 },
  elevation: 4,
};

/** Henüz not yokken: çizim, açıklama ve "PDF yükle". */
export function EmptyLibrary({
  remainingPages,
  planLabel,
  onUpload,
}: {
  remainingPages?: number;
  planLabel?: string;
  onUpload: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3.5 px-3 pb-10">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="relative mb-2.5 h-40 w-[180px]"
      >
        <View
          className="absolute left-7 top-3 h-[132px] w-[104px] rounded-[14px] bg-brand-surface"
          style={{ transform: [{ rotate: "-8deg" }] }}
        />
        <View
          className="absolute left-11 top-1.5 h-[132px] w-[104px] gap-[9px] rounded-[14px] border-[1.5px] border-brand-line bg-white px-4 py-5"
          style={SHADOW}
        >
          <View className="h-2 w-[64%] rounded bg-brand-indigo" />
          <View className="h-1.5 w-full rounded bg-brand-hairline" />
          <View className="h-1.5 w-[86%] rounded bg-brand-hairline" />
          <View className="h-1.5 w-[94%] rounded bg-brand-hairline" />
          <View className="h-1.5 w-[58%] rounded bg-brand-hairline" />
        </View>
        <View
          className="absolute bottom-0 right-0 h-[72px] w-[72px] flex-row items-center justify-center gap-1 rounded-[22px] bg-brand-indigo"
          style={{ ...SHADOW, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } }}
        >
          {MARK_BARS.map((bar, index) => (
            <View key={index} className={`w-1 rounded-sm ${bar.color}`} style={{ height: bar.height }} />
          ))}
        </View>
      </View>

      <Text
        accessibilityRole="header"
        className="text-center font-display-bold text-2xl tracking-[-0.48px] text-brand-ink"
      >
        İlk notunu yükle
      </Text>
      <Text className="text-center text-[15px] leading-[22.5px] text-brand-ink-soft">
        PDF'ini seç, başlığını yaz. Sese çevrilince bildirim göndereceğiz; ilk
        bölüm hazır olur olmaz dinlemeye başlayabilirsin.
      </Text>

      <AuthButton
        className="mt-2 px-[26px]"
        icon={<Plus size={20} strokeWidth={2.2} color="#FFFFFF" />}
        onPress={onUpload}
      >
        PDF yükle
      </AuthButton>

      {remainingPages !== undefined ? (
        <View className="mt-3.5 flex-row items-center gap-2 rounded-full bg-brand-lavender px-3.5 py-2">
          <View className="h-2 w-2 rounded-full bg-brand-blue-vivid" />
          <Text className="text-[13px] font-medium text-brand-ink-soft">
            Bu ay {remainingPages} sayfa hakkın var{planLabel ? ` · ${planLabel}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
