import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthButton } from "@/components/auth";
import { withLocative } from "@/lib/format";

/**
 * "Bu ayki sayfa hakkın yetmiyor" paneli: kullanılan / kalan / aylık hak,
 * PDF'in sayfa sayısı ve hakkın yenileneceği gün.
 */
export function QuotaSheet({
  visible,
  pageCount,
  usedPages,
  remainingPages,
  monthlyPages,
  resetsAt,
  proMonthlyPages,
  isPro,
  onUpgrade,
  onPickShorter,
  onClose,
}: {
  visible: boolean;
  pageCount: number;
  usedPages: number;
  remainingPages: number;
  monthlyPages: number;
  /** "1 Kasım" */
  resetsAt?: string | null;
  proMonthlyPages: number;
  isPro: boolean;
  onUpgrade: () => void;
  onPickShorter: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const usedRatio = monthlyPages > 0 ? Math.min(1, usedPages / monthlyPages) : 1;

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

          <View className="mt-[22px] h-14 flex-row overflow-hidden rounded-[10px] bg-brand-surface">
            <View className="h-full bg-brand-accent" style={{ width: `${usedRatio * 100}%` }} />
            <View className="h-full flex-1 bg-[#FFE3CF]" />
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-xs font-semibold text-brand-ink-soft">Kullanılan {usedPages}</Text>
            <Text className="text-xs font-semibold text-brand-ink-soft">Kalan {remainingPages}</Text>
            <Text className="text-xs font-semibold text-brand-ink-soft">Aylık {monthlyPages}</Text>
          </View>

          <Text
            accessibilityRole="header"
            className="mb-2 mt-[22px] font-display text-[26px] leading-[30px] tracking-[-0.78px] text-brand-ink"
          >
            Bu ayki sayfa hakkın yetmiyor
          </Text>
          <Text className="text-[15px] leading-[22.5px] text-brand-ink-soft">
            Bu PDF <Text className="font-bold text-brand-ink">{pageCount} sayfa</Text>, bu ay{" "}
            <Text className="font-bold text-brand-ink">{remainingPages} sayfa</Text> hakkın
            kaldı.{resetsAt ? ` Hakkın ${withLocative(resetsAt)} yenilenir.` : ""}
          </Text>

          {!isPro ? (
            <AuthButton className="mt-6" onPress={onUpgrade}>
              {`Pro'ya geç · ayda ${proMonthlyPages} sayfa`}
            </AuthButton>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onPickShorter}
            className={`${isPro ? "mt-6" : "mt-2.5"} h-[52px] items-center justify-center rounded-2xl bg-brand-lavender`}
          >
            <Text className="text-base font-bold text-brand-indigo">Daha kısa bir PDF seç</Text>
          </Pressable>
          <Text className="mt-4 text-center text-[13px] leading-[19px] text-brand-muted">
            İpucu: Notunu konulara bölüp ayrı PDF'ler halinde yükleyebilirsin.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
