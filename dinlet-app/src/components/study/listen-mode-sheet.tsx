import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton } from "@/components/auth";
import { BottomPanel } from "@/components/ui/bottom-panel";
import { SwitchToggle } from "@/components/ui/switch-toggle";
import { useUserSettings } from "@/hooks/use-user-settings";
import { formatClock } from "@/lib/format";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { ListenMode } from "@/lib/settings-storage";

export interface ListenModeSection {
  durationMs: number | null;
  quickDurationMs: number | null;
  quickStatus?: { raw: string | null } | null;
}

/** Hızlı tekrar yaklaşık asıl anlatımın üçte biri kadar sürer (prompt hedefi). */
const QUICK_RATIO_ESTIMATE = 0.35;

/**
 * Dinleme modu: tam anlatım / hızlı tekrar; bölüm sonu soruları ve tekrar
 * özeti. Ayarlar cihazda saklanır ve oynatıcıya hemen uygulanır.
 */
export function ListenModeSheet({
  visible,
  onClose,
  documentId,
  sectionTitle,
  section,
  sections,
}: {
  visible: boolean;
  onClose: () => void;
  documentId: number;
  /** Sürelerin gösterildiği bölüm (çalan ya da ilk). */
  sectionTitle: string;
  section: ListenModeSection | null;
  sections: ListenModeSection[];
}) {
  const queryClient = useQueryClient();
  const { settings, update } = useUserSettings();
  const requestQuick = useCraftMutation("study-tools", "requestQuick");

  const quickStatuses = sections.map((item) => item.quickStatus?.raw ?? null);
  const quickReady = quickStatuses.length > 0 && quickStatuses.every((status) => status === "READY");
  const quickPending = quickStatuses.some((status) => status === "PENDING");

  const fullMs = section?.durationMs ?? 0;
  const quickMs =
    section?.quickDurationMs ?? (fullMs > 0 ? Math.round(fullMs * QUICK_RATIO_ESTIMATE) : 0);
  const quickNote = quickReady
    ? null
    : quickPending
      ? "Hazırlanıyor; hazır olan bölümler hızlı sürümle çalar."
      : "İlk seçimde hazırlanır (birkaç dakika).";

  async function choose(mode: ListenMode) {
    await update({ listenMode: mode });
    if (mode !== "quick" || quickReady || quickPending) return;
    try {
      await requestQuick.mutateAsync({ id: documentId });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (error) {
      await update({ listenMode: "full" });
      const code = getApiErrorCode(error);
      if (code === "PRO_REQUIRED") {
        Alert.alert("Hızlı tekrar Pro'ya özel", "Pro'da her bölümün kısa sürümü hazırlanır.", [
          { text: "Vazgeç", style: "cancel" },
          { text: "Pro'ya geç", onPress: () => router.push("/pro") },
        ]);
      } else if (code === "CROSS_BORDER_CONSENT_REQUIRED") {
        Alert.alert(
          "Açık rıza gerekiyor",
          "Hızlı tekrar yurt dışındaki yapay zekâ servisiyle hazırlanır. Rızanı hesap ayarlarından verebilirsin.",
          [
            { text: "Vazgeç", style: "cancel" },
            { text: "Rızayı yönet", onPress: () => router.push("/consents") },
          ]
        );
      } else {
        Alert.alert("Hazırlanamadı", getApiErrorMessage(error));
      }
    }
  }

  const modes: { id: ListenMode; title: string; description: string; durationMs: number; note?: string | null }[] = [
    {
      id: "full",
      title: "Tam anlatım",
      description: "Notundaki her bilgi, akıcı cümlelerle.",
      durationMs: fullMs,
    },
    {
      id: "quick",
      title: "Hızlı tekrar",
      description: "Sınava yakın: yalnızca ana bilgiler, kısa cümleler.",
      durationMs: quickMs,
      note: quickNote,
    },
  ];

  const toggles = [
    {
      key: "quizAtSectionEnd" as const,
      label: "Bölüm sonu soruları",
      hint: "3 soru, düşünme aralığıyla; saklanan hafıza kancaları da okunur",
    },
    { key: "recapAtSectionEnd" as const, label: "Tekrar özeti", hint: "Bölümün sonunda kısa özet" },
  ];

  return (
    <BottomPanel visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="mt-[18px] font-display text-2xl tracking-[-0.48px] text-brand-ink">
        Dinleme modu
      </Text>
      <Text numberOfLines={1} className="mt-1 text-sm text-brand-ink-soft">
        {sectionTitle}
      </Text>

      <View accessibilityRole="radiogroup" accessibilityLabel="Mod" className="mt-4 gap-2.5">
        {modes.map((mode) => {
          const selected = settings.listenMode === mode.id;
          return (
            <Pressable
              key={mode.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => void choose(mode.id)}
              className={`flex-row items-center gap-3 rounded-2xl border-[1.5px] p-3.5 ${
                selected ? "border-brand-indigo bg-brand-lavender" : "border-brand-hairline bg-white"
              }`}
            >
              <View
                className={`h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${
                  selected ? "border-brand-indigo" : "border-[#B7BCD6]"
                }`}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand-indigo" /> : null}
              </View>
              <View className="flex-1 gap-[3px]">
                <Text className="text-[15px] font-bold text-brand-ink">{mode.title}</Text>
                <Text className="text-[13px] leading-[18px] text-brand-ink-soft">{mode.description}</Text>
                {mode.note ? <Text className="text-xs font-semibold text-brand-blue-vivid">{mode.note}</Text> : null}
              </View>
              {mode.durationMs > 0 ? (
                <Text className="font-display text-lg text-brand-indigo">
                  {mode.id === "quick" && !section?.quickDurationMs ? "~" : ""}
                  {formatClock(mode.durationMs)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View className="mt-2.5">
        {toggles.map((toggle) => (
          <View
            key={toggle.key}
            className="min-h-[54px] flex-row items-center justify-between gap-3 border-b border-[#EEF0F7] py-2"
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold text-brand-ink">{toggle.label}</Text>
              <Text className="text-xs text-brand-muted">{toggle.hint}</Text>
            </View>
            <SwitchToggle
              accessibilityLabel={toggle.label}
              value={settings[toggle.key]}
              onValueChange={(value) => void update({ [toggle.key]: value })}
            />
          </View>
        ))}
      </View>

      <AuthButton className="mt-[18px]" loading={requestQuick.isPending} onPress={onClose}>
        Tamam
      </AuthButton>
    </BottomPanel>
  );
}
