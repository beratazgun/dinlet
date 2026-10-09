import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BookOpen, Mic, X } from "lucide-react-native";
import { useCraftQuery } from "@tanstack-query-craft";
import { formatDuration } from "@/lib/format";

export function SectionDetailSheet({
  visible,
  sectionId,
  documentTitle,
  onClose,
}: {
  visible: boolean;
  sectionId: number | null;
  documentTitle: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const sectionQuery = useCraftQuery(
    "sections",
    "getSection",
    [{ id: sectionId ?? 0 }],
    { enabled: visible && !!sectionId }
  );

  const section = sectionQuery.data?.data;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-[rgba(14,18,56,0.48)]">
        <View
          accessibilityViewIsModal
          className="h-[88%] rounded-t-[28px] bg-white px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom + 8, 24) }}
        >
          {/* Sürükleme Tutamacı */}
          <View className="h-[5px] w-10 self-center rounded-[3px] bg-[#DDE0EE]" />

          {/* Başlık ve Kapat Butonu */}
          <View className="mt-4 flex-row items-center justify-between border-b border-[#EEF0F7] pb-3">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-semibold text-brand-ink-soft">
                {documentTitle} {section?.order ? `· Bölüm ${section.order}` : ""}
              </Text>
              <Text
                numberOfLines={1}
                className="font-display text-lg font-extrabold text-brand-ink"
              >
                {section?.title || "Bölüm Metni"}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-brand-lavender"
            >
              <X size={20} color="#0E1238" strokeWidth={2} />
            </Pressable>
          </View>

          {sectionQuery.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#1928B4" />
            </View>
          ) : section ? (
            <ScrollView className="flex-1 pt-4" showsVerticalScrollIndicator={false}>
              {/* Paragraflar */}
              <View className="gap-3 pb-6">
                {section.paragraphs && section.paragraphs.length > 0 ? (
                  section.paragraphs.map((p, idx) => (
                    <Text
                      key={idx}
                      className="text-[16px] leading-[25px] text-brand-body font-normal"
                    >
                      {p}
                    </Text>
                  ))
                ) : (
                  <Text className="text-center text-[15px] text-brand-muted py-8">
                    Bu bölüm için metin bulunamadı.
                  </Text>
                )}

                {/* Tekrar Özeti (Recap) */}
                {section.recap ? (
                  <View className="mt-4 rounded-[18px] border-[1.5px] border-dashed border-[#C5CCF7] bg-[#F8F9FE] p-4">
                    <Text className="text-xs font-extrabold uppercase tracking-[0.08em] text-brand-indigo">
                      Tekrar Özeti
                    </Text>
                    <Text className="mt-1.5 text-[15px] leading-[23px] text-brand-body font-medium">
                      {section.recap}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          ) : null}

          {section?.status?.raw === "READY" && section.paragraphs.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bu bölümü kendi sesinle kaydet"
              onPress={() => {
                onClose();
                router.push({
                  pathname: "/record/[sectionId]",
                  params: { sectionId: String(section.id) },
                });
              }}
              className="mt-2 h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-brand-surface"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Mic size={18} color="#1928B4" strokeWidth={2.2} />
              <Text className="text-[15px] font-bold text-brand-indigo">
                Kendi sesinle kaydet
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
