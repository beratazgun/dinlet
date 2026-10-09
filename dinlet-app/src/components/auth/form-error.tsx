import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { CircleAlert } from "lucide-react-native";

/** Formun tamamına ait sunucu hatası (alan dışı). */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2.5 rounded-2xl bg-[#FDECEF] p-3.5"
    >
      <CircleAlert size={18} color="#D92D45" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-sm leading-[20px] text-brand-body">{children}</Text>
    </View>
  );
}
