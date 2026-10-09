import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CircleAlert } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { useAuth } from "@/providers/auth-provider";

/**
 * E-postadaki onay bağlantısı (`dinletapp://verify-email?token=…`) buraya
 * açılır. Token tek kullanımlıktır: onaylanınca backend oturum anahtarı
 * döndürür ve kullanıcı doğrudan uygulamaya girer.
 */
export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { signIn, status } = useAuth();
  const verifyEmail = useCraftMutation("auth", "verifyEmail");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  // Token tek kullanımlık; effect iki kez çalışsa da istek bir kez gider.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setError("Onay bağlantısı eksik. E-postadaki bağlantıya yeniden dokun.");
      return;
    }

    verifyEmail
      .mutateAsync({ token })
      .then((response) => signIn(response.data))
      .then(() => setVerified(true))
      .catch((verifyError) => setError(getApiErrorMessage(verifyError)));
  }, [token, verifyEmail, signIn]);

  // Oturum durumu güncellendikten sonra yönlendirilir; aksi halde kütüphane
  // henüz korumalı olduğu için karşılamaya düşülürdü.
  if (verified && status === "signedIn") return <Redirect href="/" />;

  return (
    <View
      className="flex-1 bg-brand-offwhite px-6"
      style={{
        paddingTop: Math.max(insets.top + 12, 60),
        paddingBottom: Math.max(insets.bottom + 12, 36),
      }}
    >
      <StatusBar style="dark" />

      {error ? (
        <>
          <View className="flex-1 items-center justify-center gap-3.5">
            <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-[#FDECEF]">
              <CircleAlert size={30} color="#D92D45" />
            </View>
            <Text
              accessibilityRole="header"
              className="text-center font-display text-[28px] leading-[31px] tracking-[-0.84px] text-brand-ink"
            >
              Hesap onaylanamadı
            </Text>
            <Text className="max-w-[320px] text-center text-[15px] leading-[23px] text-brand-ink-soft">
              {error} Bağlantının süresi dolduysa giriş yapmayı dene; sana
              yenisini gönderebiliriz.
            </Text>
          </View>
          <AuthButton onPress={() => router.replace("/login")}>Giriş yap</AuthButton>
        </>
      ) : (
        <View
          accessibilityLiveRegion="polite"
          className="flex-1 items-center justify-center gap-4"
        >
          <ActivityIndicator size="large" color="#1928B4" />
          <Text className="text-base font-semibold text-brand-ink-soft">
            Hesabın açılıyor…
          </Text>
        </View>
      )}
    </View>
  );
}
