import { Pressable, Text, View } from "react-native";

export type LibraryFilter = "all" | "ready" | "processing";

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "ready", label: "Hazır" },
  { id: "processing", label: "İşleniyor" },
];

export function FilterChips({
  value,
  onChange,
}: {
  value: LibraryFilter;
  onChange: (value: LibraryFilter) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Filtre" className="mt-[22px] flex-row gap-2">
      {FILTERS.map((filter) => {
        const selected = filter.id === value;
        return (
          <Pressable
            key={filter.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(filter.id)}
            className={`h-[38px] justify-center rounded-full border-[1.5px] px-4 ${
              selected ? "border-brand-ink bg-brand-ink" : "border-brand-line bg-white"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${selected ? "text-white" : "text-brand-body"}`}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
