import { Pressable, Text } from "react-native";

/** Seçilebilir hap düğme (sınav ve fiyat süzgeçleri). */
export function StoreChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="h-9 items-center justify-center rounded-full border-[1.5px] px-3.5"
      style={{
        backgroundColor: selected ? "#0E1238" : "#FFFFFF",
        borderColor: selected ? "#0E1238" : "#E1E4F3",
      }}
    >
      <Text
        className="text-[13px] font-semibold"
        style={{ color: selected ? "#FFFFFF" : "#2A2F55" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
