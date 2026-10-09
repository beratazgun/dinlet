import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";

export const PLAYBACK_SPEED_OPTIONS = [
  { value: 0.75, label: "0,75×" },
  { value: 1.0, label: "1,00×" },
  { value: 1.25, label: "1,25×" },
  { value: 1.5, label: "1,50×" },
  { value: 1.75, label: "1,75×" },
  { value: 2.0, label: "2,00×" },
];

export function PlaybackSpeedSheet({
  visible,
  currentSpeed,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentSpeed: number;
  onSelect: (speed: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={onClose}
          className="absolute inset-0 bg-[rgba(14,18,56,0.48)]"
        />
        <View
          accessibilityViewIsModal
          className="rounded-t-[28px] bg-white px-6 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom + 12, 36) }}
        >
          <View className="h-[5px] w-10 self-center rounded-[3px] bg-[#DDE0EE]" />

          <Text
            accessibilityRole="header"
            className="mb-1 mt-5 font-display text-[22px] font-extrabold tracking-[-0.44px] text-brand-ink"
          >
            Varsayılan oynatma hızı
          </Text>
          <Text className="text-sm text-brand-ink-soft">
            Yeni açılan tüm bölümler bu hızda başlatılır.
          </Text>

          <View className="mt-4 divide-y divide-[#EEF0F7]">
            {PLAYBACK_SPEED_OPTIONS.map((opt) => {
              const selected = Math.abs(opt.value - currentSpeed) < 0.01;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                  className="flex-row items-center justify-between py-3.5"
                >
                  <Text
                    className={`text-[16px] ${
                      selected ? "font-bold text-brand-indigo" : "font-medium text-brand-ink"
                    }`}
                  >
                    {opt.label}
                  </Text>
                  {selected ? <Check size={20} color="#1928B4" strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
