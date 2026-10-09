import { Pressable, Text } from "react-native";

/** "★ Favoriler · 4" gibi süzgeç çipi. */
export function CollectionChip({
  label,
  count,
  highlighted,
  onPress,
  onLongPress,
}: {
  label: string;
  count?: number;
  highlighted?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count} not`}
      onPress={onPress}
      onLongPress={onLongPress}
      className="rounded-full bg-brand-lavender px-3 py-[7px]"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text
        className={`text-[13px] font-semibold ${highlighted ? "text-brand-indigo" : "text-brand-body"}`}
      >
        {count === undefined ? label : `${label} · ${count}`}
      </Text>
    </Pressable>
  );
}
