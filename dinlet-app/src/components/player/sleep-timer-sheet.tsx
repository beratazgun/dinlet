import { Modal, Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { formatClock } from "@/lib/format";
import type { SleepTimerOption } from "@/context/player-context";

interface SleepTimerSheetProps {
  visible: boolean;
  selectedOption: SleepTimerOption;
  remainingSec: number | null;
  onSelect: (option: SleepTimerOption) => void;
  onClose: () => void;
}

const OPTIONS: { id: SleepTimerOption; label: string }[] = [
  { id: "off", label: "Kapalı" },
  { id: "15m", label: "15 dakika" },
  { id: "30m", label: "30 dakika" },
  { id: "45m", label: "45 dakika" },
  { id: "60m", label: "60 dakika" },
  { id: "end_of_section", label: "Bölüm bittiğinde" },
];

export function SleepTimerSheet({
  visible,
  selectedOption,
  remainingSec,
  onSelect,
  onClose,
}: SleepTimerSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-[32px] bg-brand-lavender p-6 pb-10">
          {/* Başlık ve Kapat Butonu */}
          <View className="flex-row items-center justify-between pb-3 border-b border-[#E3E7F8]">
            <View>
              <Text className="font-display text-xl font-bold text-brand-ink">
                Uyku Zamanlayıcısı
              </Text>
              {remainingSec !== null ? (
                <Text className="mt-0.5 text-xs font-semibold text-brand-indigo">
                  Kalan süre: {formatClock(remainingSec * 1000)}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-brand-surface active:opacity-70"
            >
              <X size={18} color="#0E1238" />
            </Pressable>
          </View>

          {/* Seçenekler Listesi */}
          <View className="mt-3 gap-1">
            {OPTIONS.map((item) => {
              const isSelected = selectedOption === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  className={`flex-row items-center justify-between rounded-2xl px-4 py-3.5 ${
                    isSelected ? "bg-white shadow-sm" : "active:bg-brand-surface"
                  }`}
                >
                  <Text
                    className={`text-[15px] ${
                      isSelected
                        ? "font-bold text-brand-indigo"
                        : "font-medium text-brand-ink"
                    }`}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? (
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-indigo">
                      <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
