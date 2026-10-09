import { Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Geri"
      hitSlop={8}
      onPress={onPress}
      className="-ml-2.5 h-11 w-11 items-center justify-center rounded-full"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <ChevronLeft size={26} strokeWidth={2} color="#0E1238" />
    </Pressable>
  );
}
