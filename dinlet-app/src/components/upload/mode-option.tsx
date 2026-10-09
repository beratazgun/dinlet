import { Pressable, Text, View } from "react-native";

/** "Nasıl okunsun?" seçeneği: yuvarlak radyo, başlık, isteğe bağlı PRO rozeti. */
export function ModeOption({
  title,
  description,
  pro,
  selected,
  locked,
  onPress,
}: {
  title: string;
  description: string;
  pro?: boolean;
  selected: boolean;
  /** Seçilemiyor (Pro veya rıza gerekli); dokununca nedeni açıklanır. */
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityHint={locked ? "Seçmek için ek adım gerekiyor" : undefined}
      onPress={onPress}
      className={`flex-row items-start gap-3 rounded-2xl border-[1.5px] p-3.5 ${
        selected ? "border-brand-indigo bg-brand-lavender" : "border-brand-hairline bg-white"
      }`}
    >
      <View
        className={`mt-px h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${
          selected ? "border-brand-indigo" : "border-[#B7BCD6]"
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand-indigo" /> : null}
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className={`text-[15px] font-bold ${locked ? "text-brand-ink-soft" : "text-brand-ink"}`}>
            {title}
          </Text>
          {pro ? (
            <View className="rounded-[5px] bg-brand-indigo px-1.5 py-[3px]">
              <Text className="text-[10px] font-bold tracking-[0.6px] text-white">PRO</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-[13px] leading-[19px] text-brand-ink-soft">{description}</Text>
      </View>
    </Pressable>
  );
}
