import { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as IntentLauncher from "expo-intent-launcher";
import { StatusBar } from "expo-status-bar";
import { Check, Info, Mail } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton, BackButton, FormError } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

/** Yeni bağlantı isteğinden sonra butonun gizli kaldığı süre. */
const RESEND_COOLDOWN_SECONDS = 60;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Varsayılan e-posta uygulamasının gelen kutusu. */
async function openMailApp() {
  try {
    if (Platform.OS === "android") {
      await IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
        category: "android.intent.category.APP_EMAIL",
        // FLAG_ACTIVITY_NEW_TASK: posta uygulaması kendi görevinde açılır.
        flags: 0x10000000,
      });
      return;
    }
    await Linking.openURL("message://");
  } catch {
    Alert.alert(
      "E-posta uygulaması açılamadı",
      "Onay bağlantısını e-posta uygulamandan açabilirsin."
    );
  }
}

/** Zarf ve içinden çıkan onay mektubu. */
function EnvelopeIllustration() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="relative mb-3.5 h-[150px] w-[176px]"
    >
      <View className="absolute left-2 top-7 h-[110px] w-40 rounded-[18px] bg-brand-surface" />
      <View
        className="absolute left-[30px] top-1.5 h-24 w-[116px] gap-2 rounded-xl border-[1.5px] border-brand-line bg-white px-3.5 py-4"
        style={{
          shadowColor: "#1928B4",
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 10 },
          elevation: 4,
        }}
      >
        <View className="h-[7px] w-[56%] rounded bg-brand-indigo" />
        <View className="h-[5px] w-full rounded-[3px] bg-brand-hairline" />
        <View className="h-[5px] w-[80%] rounded-[3px] bg-brand-hairline" />
        <View className="mt-1 h-[18px] w-[64%] rounded-md bg-brand-blue-vivid" />
      </View>
      <Svg width={160} height={80} viewBox="0 0 160 80" style={{ position: "absolute", left: 8, top: 58 }}>
        <Path d="M0 18 L80 62 L160 18 L160 62 Q160 80 142 80 L18 80 Q0 80 0 62 Z" fill="#1928B4" />
        <Path d="M0 18 L80 62 L160 18" fill="none" stroke="#1322A0" strokeWidth={2} />
      </Svg>
      <View className="absolute right-0 top-0 h-10 w-10 items-center justify-center rounded-full border-4 border-brand-offwhite bg-brand-accent">
        <Text className="font-bold text-base text-brand-blue-deep">1</Text>
      </View>
    </View>
  );
}

export default function CheckEmailScreen() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const resend = useCraftMutation("auth", "resendVerification");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleResend() {
    if (!email) return;
    setError(null);
    resend.mutate(
      { email },
      {
        onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS),
        onError: (resendError) => setError(getApiErrorMessage(resendError)),
      }
    );
  }

  function changeEmail() {
    if (router.canGoBack()) router.back();
    else router.replace("/register");
  }

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 12, 60),
          paddingBottom: Math.max(insets.bottom + 12, 36),
        }}
      >
        <BackButton onPress={changeEmail} />

        <View className="flex-1 items-center justify-center gap-3.5 py-6">
          <EnvelopeIllustration />
          <Text
            accessibilityRole="header"
            className="text-center font-display text-[30px] leading-[33px] tracking-[-0.9px] text-brand-ink"
          >
            E-postanı onayla
          </Text>
          <Text className="max-w-[320px] text-center text-[15px] leading-[23px] text-brand-ink-soft">
            {email ? (
              <Text className="font-semibold text-brand-ink">{email}</Text>
            ) : (
              "E-posta"
            )}{" "}
            adresine bir onay bağlantısı gönderdik. Bağlantıya dokununca hesabın
            açılır ve uygulamaya geri dönersin.
          </Text>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={changeEmail} className="py-2">
            <Text className="text-sm font-bold text-brand-indigo">
              E-posta adresini değiştir
            </Text>
          </Pressable>
        </View>

        <View className="mb-[18px] flex-row items-start gap-2.5 rounded-2xl bg-brand-lavender p-3.5">
          <Info size={18} color="#2D40E5" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[13px] leading-[19px] text-brand-body">
            Birkaç dakika içinde gelmezse gereksiz (spam) klasörüne de bak.
          </Text>
        </View>

        {error ? (
          <View className="mb-3">
            <FormError>{error}</FormError>
          </View>
        ) : null}

        <AuthButton icon={<Mail size={20} color="#FFFFFF" />} onPress={() => void openMailApp()}>
          E-posta uygulamasını aç
        </AuthButton>

        {cooldown > 0 ? (
          <View
            accessibilityLiveRegion="polite"
            className="mt-2.5 h-[50px] flex-row items-center justify-center gap-2"
          >
            <Check size={18} strokeWidth={2.6} color="#1928B4" />
            <Text className="text-sm font-semibold text-brand-ink-soft">
              Yeni bağlantı gönderildi · {formatCountdown(cooldown)} sonra tekrar
            </Text>
          </View>
        ) : (
          <AuthButton
            variant="ghost"
            className="mt-2.5"
            loading={resend.isPending}
            disabled={!email}
            onPress={handleResend}
          >
            Bağlantıyı tekrar gönder
          </AuthButton>
        )}
      </ScrollView>
    </View>
  );
}
