import { Pressable, View } from "react-native";

/** Tasarımdaki anahtar: 50×30, açıkken lacivert. */
export function SwitchToggle({
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
