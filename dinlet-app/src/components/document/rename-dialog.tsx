import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { AuthButton } from "@/components/auth";

export function RenameDialog({
  visible,
  currentTitle,
  isPending,
  onSave,
  onClose,
}: {
  visible: boolean;
  currentTitle: string;
  isPending: boolean;
  onSave: (newTitle: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(currentTitle);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-[rgba(14,18,56,0.48)] px-5">
        <View className="w-full max-w-[340px] rounded-[24px] bg-white p-5 shadow-xl">
          <Text
            accessibilityRole="header"
            className="font-display text-xl font-extrabold text-brand-ink"
          >
            Not Başlığını Değiştir
          </Text>
          <Text className="mt-1 text-sm text-brand-ink-soft">
            Bu not için yeni bir başlık belirle.
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            autoFocus
            className="mt-4 h-12 rounded-xl border-[1.5px] border-brand-line bg-white px-3.5 font-medium text-[15px] text-brand-ink"
          />

          <View className="mt-5 flex-row gap-2.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vazgeç"
              onPress={onClose}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-brand-lavender active:opacity-80"
            >
              <Text className="text-[15px] font-bold text-brand-ink">Vazgeç</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kaydet"
              disabled={isPending || !title.trim()}
              onPress={() => onSave(title.trim())}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-brand-indigo active:opacity-90"
            >
              <Text className="text-[15px] font-bold text-white">
                {isPending ? "Kaydediliyor..." : "Kaydet"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
