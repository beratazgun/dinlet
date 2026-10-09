import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthButton, LogoMark } from "@/components/auth";

/** Ortadaki ses dalgası; ilk yarısı "dinlenmiş" (beyaz), kalanı açık mavi. */
const WAVE_HEIGHTS = [
  14, 22, 36, 58, 40, 72, 96, 64, 118, 84, 140, 104, 168, 126, 92, 150, 184,
  132, 98, 160, 120, 88, 136, 70, 108, 56, 82, 44, 60, 30, 42, 22, 28, 14,
];
const PLAYED_BARS = 17;
const TALLEST_BAR = Math.max(...WAVE_HEIGHTS);

const EXAMS = ["KPSS", "YKS", "ALES"];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  // Küçük ekranlarda dalga, kendisine kalan yüksekliğe sığacak kadar küçülür.
  const [waveScale, setWaveScale] = useState(1);

  function handleWaveLayout(event: LayoutChangeEvent) {
    const available = event.nativeEvent.layout.height - 24;
    setWaveScale(Math.max(0.3, Math.min(1, available / TALLEST_BAR)));
  }

  return (
    <View
      className="flex-1 bg-brand-indigo px-6"
      style={{
        paddingTop: Math.max(insets.top + 16, 64),
        paddingBottom: Math.max(insets.bottom + 16, 40),
      }}
    >
      <StatusBar style="light" />

      <View className="flex-row items-center gap-2.5">
        <LogoMark size="sm" inverted />
        <Text className="font-display text-2xl tracking-[-0.48px] text-white">
          Dinlet
        </Text>
      </View>

      <View
        onLayout={handleWaveLayout}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="-mx-6 mt-6 flex-1 flex-row items-center justify-center gap-[5px] overflow-hidden"
      >
        {WAVE_HEIGHTS.map((height, index) => (
          <View
            key={index}
            className={`w-[5px] rounded-[3px] ${
              index < PLAYED_BARS ? "bg-white" : "bg-brand-accent"
            }`}
            style={{ height: height * waveScale }}
          />
        ))}
      </View>

      <View className="gap-4">
        <Text
          accessibilityRole="header"
          className="font-display text-[46px] leading-[47px] tracking-[-1.6px] text-white"
        >
          {"Notların,\nkulağında."}
        </Text>
        <Text className="text-[17px] leading-[25.5px] text-brand-mist">
          PDF notunu yükle; Dinlet onu bölüm bölüm dinlenebilir bir anlatıma
          çevirsin. Otobüste, yürürken, sporda.
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {EXAMS.map((exam) => (
            <View key={exam} className="rounded-full bg-white/12 px-3 py-[7px]">
              <Text className="text-[13px] font-semibold text-white">{exam}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-9 gap-3">
        <AuthButton variant="inverse" onPress={() => router.push("/register")}>
          Hemen başla
        </AuthButton>
        <AuthButton
          variant="inverse-outline"
          onPress={() => router.push("/login")}
        >
          Zaten hesabım var
        </AuthButton>
      </View>
    </View>
  );
}
