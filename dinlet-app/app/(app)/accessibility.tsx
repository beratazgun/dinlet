import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/auth";
import { SwitchToggle } from "@/components/ui/switch-toggle";
import { useUserSettings } from "@/hooks/use-user-settings";
import { readingStyle } from "@/lib/reading-style";
import type { TextSize, UserSettings } from "@/lib/settings-storage";

const SIZES: { id: TextSize; label: string; preview: number }[] = [
  { id: "m", label: "Orta", preview: 14 },
  { id: "l", label: "Büyük", preview: 17 },
  { id: "xl", label: "Çok büyük", preview: 21 },
];

const TOGGLES: {
  key: keyof Pick<UserSettings, "wordHighlight" | "dyslexiaFont" | "highContrast" | "reduceMotion">;
  label: string;
  hint: string;
}[] = [
  { key: "wordHighlight", label: "Kelime vurgulu okuma", hint: "Okunan kelime metinde işaretlenir" },
  { key: "dyslexiaFont", label: "Okuması kolay yazı tipi", hint: "Disleksi için harf ayrımı belirgin" },
  { key: "highContrast", label: "Yüksek kontrast", hint: "Siyah zemin, parlak vurgu" },
  { key: "reduceMotion", label: "Hareketi azalt", hint: "Animasyonları kapatır" },
];

/**
 * Erişilebilirlik: metin görünümünün yazı boyutu, yazı tipi, kontrastı ve
 * kelime vurgusu. Ayarlar cihazda saklanır ve hemen uygulanır.
 */
export default function AccessibilityScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update } = useUserSettings();
  const style = readingStyle(settings);

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 8, 34),
        }}
      >
        <BackButton onPress={() => router.back()} />
        <Text
          accessibilityRole="header"
          className="mb-3.5 mt-1.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          Erişilebilirlik
        </Text>

        <View
          accessibilityLabel="Önizleme"
          className="rounded-[18px] border-[1.5px] p-4"
          style={{
            backgroundColor: settings.highContrast ? "#000000" : "#F4F5FD",
            borderColor: settings.highContrast ? "#FFFFFF" : "#F4F5FD",
          }}
        >
          <Text
            className="text-[11px] font-bold uppercase tracking-[0.88px]"
            style={{ color: settings.highContrast ? "#FFFFFF" : "#575C7A" }}
          >
            Önizleme
          </Text>
          <Text style={[style.text, { marginTop: 8 }]}>
            Bu zaferin ardından{" "}
            <Text
              style={
                settings.wordHighlight
                  ? { backgroundColor: style.colors.wordBg, color: style.colors.wordInk }
                  : undefined
              }
            >
              İznik
            </Text>{" "}
            bin üç yüz otuz birde alındı.
          </Text>
        </View>

        <Text className="mt-[18px] text-sm font-semibold text-brand-ink">Yazı boyutu</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Yazı boyutu"
          className="mt-2 flex-row gap-1 rounded-[14px] bg-brand-lavender p-1"
        >
          {SIZES.map((size) => {
            const selected = settings.textSize === size.id;
            return (
              <Pressable
                key={size.id}
                accessibilityRole="radio"
                accessibilityLabel={size.label}
                accessibilityState={{ checked: selected }}
                onPress={() => void update({ textSize: size.id })}
                className={`h-[42px] flex-1 items-center justify-center rounded-[10px] ${
                  selected ? "bg-white" : ""
                }`}
                style={
                  selected
                    ? {
                        shadowColor: "#0E1238",
                        shadowOpacity: 0.12,
                        shadowRadius: 3,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 1,
                      }
                    : undefined
                }
              >
                <Text
                  className={`font-bold ${selected ? "text-brand-indigo" : "text-brand-ink-soft"}`}
                  style={{ fontSize: size.preview }}
                >
                  A
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-2.5">
          {TOGGLES.map((toggle) => (
            <View
              key={toggle.key}
              className="min-h-[58px] flex-row items-center justify-between gap-3 border-b border-[#EEF0F7] py-2"
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

        <View className="min-h-6 flex-1" />
        <Text className="text-center text-xs leading-[18px] text-brand-muted">
          Tüm ekranlar VoiceOver ve TalkBack ile kullanılabilir.
        </Text>
      </ScrollView>
    </View>
  );
}
