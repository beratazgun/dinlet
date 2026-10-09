import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, LogoMark } from "@/components/auth";

/**
 * GEÇİCİ: Tasarımı olan ama henüz uygulanmamış ekranların yeri. Gezinme
 * akışı uçtan uca denenebilsin diye var; ekran yapıldıkça kaldırılır.
 */
export function ComingSoon({
  title,
  description,
  showBack = true,
  children,
}: {
  title: string;
  description: string;
  showBack?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-brand-offwhite px-5"
      style={{ paddingTop: Math.max(insets.top + 12, 60), paddingBottom: 24 }}
    >
      <StatusBar style="dark" />
      {showBack ? <BackButton onPress={() => router.back()} /> : null}
      <View className="flex-1 justify-center gap-3">
        <LogoMark size="md" />
        <Text className="mt-3 font-display text-[28px] leading-[31px] tracking-[-0.84px] text-brand-ink">
          {title}
        </Text>
        <Text className="text-base leading-[24px] text-brand-ink-soft">{description}</Text>
      </View>
      {children}
    </View>
  );
}
