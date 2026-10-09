import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "@/hooks/use-user-settings";

/**
 * Alttan açılan panel (tasarımdaki "sheet"): koyu perde, beyaz üst köşeleri
 * yuvarlak kart ve tutamaç. Klavye açıldığında içerik yukarı kayar.
 */
export function BottomPanel({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={onClose}
          className="absolute inset-0 bg-[rgba(14,18,56,0.48)]"
        />
        <View
          accessibilityViewIsModal
          className="max-h-[92%] rounded-t-[28px] bg-white px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom + 12, 34) }}
        >
          <View className="mb-1 h-[5px] w-10 self-center rounded-[3px] bg-[#DDE0EE]" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
