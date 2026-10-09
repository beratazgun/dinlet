import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftQuery } from "@tanstack-query-craft";
import { ActiveSessionsSheet, PlaybackSpeedSheet } from "@/components/account";
import { SwitchToggle } from "@/components/ui/switch-toggle";
import { withLocative } from "@/lib/format";
import {
  getUserSettings,
  loadUserSettings,
  saveUserSettings,
  type UserSettings,
} from "@/lib/settings-storage";
import { useAuth } from "@/providers/auth-provider";

const TURKISH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toLocaleUpperCase("tr-TR");
    }
    return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }
  if (email && email.length > 0) {
    return email.slice(0, 2).toLocaleUpperCase("tr-TR");
  }
  return "D";
}

function getMonthName(periodKey?: string): string {
  if (periodKey && periodKey.includes("-")) {
    const monthNum = parseInt(periodKey.split("-")[1], 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      return TURKISH_MONTHS[monthNum - 1];
    }
  }
  return TURKISH_MONTHS[new Date().getMonth()];
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const meQuery = useCraftQuery("auth", "getMe");
  const subscriptionQuery = useCraftQuery("subscription", "getMine", [], {
    refetchOnScreenFocus: true,
  });
  const sessionsQuery = useCraftQuery("auth", "listSessions");
  const voiceQuery = useCraftQuery("recordings", "getVoice", [], {
    refetchOnScreenFocus: true,
  });
  const voiceLabel = voiceQuery.data?.data?.voice?.display;

  const [settings, setSettings] = useState<UserSettings>(getUserSettings());
  const [speedSheetOpen, setSpeedSheetOpen] = useState(false);
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false);

  useEffect(() => {
    void loadUserSettings().then(setSettings);
  }, []);

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    val: UserSettings[K]
  ) => {
    const updated = await saveUserSettings({ [key]: val });
    setSettings(updated);
  };

  const user = meQuery.data?.data;
  const subscription = subscriptionQuery.data?.data;
  const sessions = sessionsQuery.data?.data ?? [];

  const isPro = subscription?.plan?.raw === "PRO";
  const usedPages = subscription?.usage?.usedPages ?? 0;
  const monthlyPages = subscription?.usage?.monthlyPages ?? 30;
  const ratio = monthlyPages > 0 ? Math.min(1, usedPages / monthlyPages) : 0;
  const monthName = getMonthName(subscription?.usage?.periodKey);

  const initials = useMemo(
    () => getInitials(user?.name, user?.email),
    [user?.name, user?.email]
  );

  const renewalText = useMemo(() => {
    if (!isPro) return "Ücretsiz plan";
    if (subscription?.currentPeriodEnd?.display) {
      return `${withLocative(subscription.currentPeriodEnd.display)} yenilenir`;
    }
    return "Aktif abonelik";
  }, [isPro, subscription?.currentPeriodEnd?.display]);

  const speedDisplay = useMemo(() => {
    const s = settings.playbackSpeed;
    return `${s.toFixed(2).replace(".", ",")}×`;
  }, [settings.playbackSpeed]);

  const sessionCount = sessions.length > 0 ? sessions.length : 1;

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 16, 60),
          paddingBottom: Math.max(insets.bottom + 24, 48),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profil Bilgisi */}
        <View className="flex-row items-center gap-3.5">
          <View className="h-14 w-14 items-center justify-center rounded-[18px] bg-brand-indigo">
            <Text className="font-display text-[22px] font-extrabold text-white">
              {initials}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-display text-[22px] font-extrabold tracking-[-0.44px] text-brand-ink">
              {user?.name || "Dinlet Öğrencisi"}
            </Text>
            <Text className="text-sm text-brand-ink-soft">
              {user?.email || ""}
            </Text>
          </View>
        </View>

        {/* Abonelik ve Kota Kartı */}
        <View className="mt-5 rounded-[20px] bg-brand-lavender p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className={`rounded-md px-2 py-1 ${
                  isPro ? "bg-brand-indigo" : "bg-brand-ink-soft"
                }`}
              >
                <Text className="text-[11px] font-extrabold tracking-[0.66px] text-white">
                  {isPro ? "PRO" : "FREE"}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-brand-ink-soft">
                {renewalText}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPro ? "Aboneliği yönet" : "Pro'ya geç"}
              onPress={() => router.push("/pro")}
              className="py-1"
            >
              <Text className="text-sm font-bold text-brand-indigo">
                {isPro ? "Yönet" : "Yükselt"}
              </Text>
            </Pressable>
          </View>

          <View className="mt-3 flex-row items-baseline justify-between">
            <Text className="font-display text-[26px] font-extrabold tracking-[-0.52px] text-brand-ink">
              {usedPages}{" "}
              <Text className="font-semibold text-base text-brand-ink-soft">
                / {monthlyPages} sayfa
              </Text>
            </Text>
            <Text className="text-[13px] font-semibold text-brand-ink-soft">
              {monthName}
            </Text>
          </View>

          <View className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#DDE1F7]">
            <View
              className="h-full rounded-full bg-brand-blue-vivid"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </View>
        </View>

        {/* Dinleme ve Bildirim */}
        <Text
          accessibilityRole="header"
          className="mb-1 mt-[22px] text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted"
        >
          Dinleme ve bildirim
        </Text>
        <View className="flex-col">
          <View className="min-h-[52px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2">
            <Text className="text-[15px] font-medium text-brand-ink">
              Ses hazır olunca bildir
            </Text>
            <SwitchToggle
              accessibilityLabel="Ses hazır olunca bildir"
              value={settings.notifyOnReady}
              onValueChange={(val) => void updateSetting("notifyOnReady", val)}
            />
          </View>

          <View className="min-h-[52px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2">
            <Text className="text-[15px] font-medium text-brand-ink">
              Sonraki bölüme otomatik geç
            </Text>
            <SwitchToggle
              accessibilityLabel="Sonraki bölüme otomatik geç"
              value={settings.autoNextSection}
              onValueChange={(val) =>
                void updateSetting("autoNextSection", val)
              }
            />
          </View>

          <View className="min-h-[52px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2">
            <Text className="text-[15px] font-medium text-brand-ink">
              Yalnızca Wi‑Fi ile indir
            </Text>
            <SwitchToggle
              accessibilityLabel="Yalnızca Wi-Fi ile indir"
              value={settings.downloadOnlyOnWifi}
              onValueChange={(val) =>
                void updateSetting("downloadOnlyOnWifi", val)
              }
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Varsayılan hız: ${speedDisplay}`}
            onPress={() => setSpeedSheetOpen(true)}
            className="min-h-[52px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2"
          >
            <Text className="text-[15px] font-medium text-brand-ink">
              Varsayılan hız
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text className="font-semibold text-[15px] text-brand-ink-soft">
                {speedDisplay}
              </Text>
              <ChevronRight size={18} color="#575C7A" strokeWidth={2} />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ses seçimi ve kayıtlarım"
            onPress={() => router.push("/voice")}
            className="min-h-[52px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2"
          >
            <Text className="text-[15px] font-medium text-brand-ink">Ses</Text>
            <View className="flex-row items-center gap-1.5">
              {voiceLabel ? (
                <Text className="font-semibold text-[15px] text-brand-ink-soft">
                  {voiceLabel}
                </Text>
              ) : null}
              <ChevronRight size={18} color="#575C7A" strokeWidth={2} />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Erişilebilirlik"
            onPress={() => router.push("/accessibility")}
            className="min-h-[52px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2"
          >
            <Text className="text-[15px] font-medium text-brand-ink">
              Erişilebilirlik
            </Text>
            <ChevronRight size={18} color="#575C7A" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Hesap */}
        <Text
          accessibilityRole="header"
          className="mb-1 mt-5 text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted"
        >
          Hesap
        </Text>
        <View className="flex-col">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Aktif oturumlar: ${sessionCount} cihaz`}
            onPress={() => setSessionsSheetOpen(true)}
            className="min-h-[50px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2"
          >
            <Text className="text-[15px] font-medium text-brand-ink">
              Aktif oturumlar
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text className="font-semibold text-[15px] text-brand-ink-soft">
                {sessionCount} cihaz
              </Text>
              <ChevronRight size={18} color="#575C7A" strokeWidth={2} />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aydınlatma metni ve rızalar"
            onPress={() => router.push("/consents")}
            className="min-h-[50px] flex-row items-center justify-between border-b border-[#EEF0F7] py-2"
          >
            <Text className="text-[15px] font-medium text-brand-ink">
              Aydınlatma metni ve rızalar
            </Text>
            <ChevronRight size={18} color="#575C7A" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Butonlar: Çıkış yap & Hesabı sil */}
        <View className="mt-5 flex-row gap-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Çıkış yap"
            onPress={() => void signOut()}
            className="h-[46px] flex-1 items-center justify-center rounded-[14px] bg-brand-lavender active:opacity-80"
          >
            <Text className="text-[15px] font-bold text-brand-ink">
              Çıkış yap
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hesabı sil"
            onPress={() => router.push("/delete-account")}
            className="h-[46px] flex-1 items-center justify-center rounded-[14px] bg-[#FEECEB] active:opacity-80"
          >
            <Text className="text-[15px] font-bold text-[#B42318]">
              Hesabı sil
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Sayfaya bağlı modal sayfalar */}
      <PlaybackSpeedSheet
        visible={speedSheetOpen}
        currentSpeed={settings.playbackSpeed}
        onSelect={(speed) => void updateSetting("playbackSpeed", speed)}
        onClose={() => setSpeedSheetOpen(false)}
      />

      <ActiveSessionsSheet
        visible={sessionsSheetOpen}
        onClose={() => setSessionsSheetOpen(false)}
      />
    </View>
  );
}
