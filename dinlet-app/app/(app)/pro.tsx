import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowDown, Check, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftQuery } from "@tanstack-query-craft";
import { AuthButton } from "@/components/auth";

type PlanType = "month" | "year";

interface PlanOption {
  id: PlanType;
  name: string;
  price: string;
  sub: string;
}

const PLANS: PlanOption[] = [
  {
    id: "month",
    name: "Aylık",
    price: "₺149,99",
    sub: "her ay yenilenir",
  },
  {
    id: "year",
    name: "Yıllık",
    price: "₺999,99",
    sub: "sınav dönemi boyunca",
  },
];

export default function ProScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("year");
  const [isProcessing, setIsProcessing] = useState(false);

  const subscriptionQuery = useCraftQuery("subscription", "getMine");
  const isPro = subscriptionQuery.data?.data?.plan?.raw === "PRO";

  const handleSubscribe = async () => {
    if (isPro) {
      Alert.alert(
        "Aboneliğin Aktif",
        "Zaten Dinlet Pro abonesisin. Aboneliğini App Store / Google Play hesap ayarlarından yönetebilirsin.",
        [{ text: "Tamam" }]
      );
      return;
    }

    setIsProcessing(true);
    // Simüle edilen mağaza satın alma akışı (RevenueCat / StoreKit hazırlığı)
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert(
        "Dinlet Pro",
        "Abonelik başlatma App Store ve Google Play üzerinden gerçekleştirilir. Çok yakında mağaza ödemesiyle aktif!",
        [{ text: "Tamam" }]
      );
    }, 600);
  };

  const handleRestorePurchases = async () => {
    setIsProcessing(true);
    await subscriptionQuery.refetch();
    setIsProcessing(false);
    Alert.alert(
      "Satın Alımları Geri Yükle",
      isPro
        ? "Pro aboneliğin başarıyla doğrulandı!"
        : "Bu hesaba bağlı aktif bir mağaza aboneliği bulunamadı.",
      [{ text: "Tamam" }]
    );
  };

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Mavi Başlık ve Dönüşüm Kutusu */}
        <View
          className="bg-brand-indigo px-6 pb-6"
          style={{ paddingTop: Math.max(insets.top + 8, 48) }}
        >
          {/* Üst Bar */}
          <View className="flex-row items-center justify-between">
            <View className="rounded-[7px] bg-[rgba(255,255,255,0.14)] px-2.5 py-1.5">
              <Text className="text-xs font-extrabold tracking-[0.08em] text-white">
                DİNLET PRO
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              onPress={() => router.back()}
              className="-mr-2.5 h-11 w-11 items-center justify-center"
            >
              <X size={24} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Başlık */}
          <Text className="mt-3.5 font-display text-[32px] font-extrabold leading-[34px] tracking-[-1px] text-white">
            Notun düz okunmasın, anlatılsın.
          </Text>

          {/* Dönüşüm Örneği */}
          <View className="mt-3 gap-2">
            {/* Ham Not */}
            <View className="rounded-[14px] bg-[rgba(255,255,255,0.10)] p-3.5">
              <Text className="font-mono text-[13px] leading-5 text-[#DCE1FF]">
                {"• Kuruluş: 1299\n• Kurucu: Osman Bey"}
              </Text>
            </View>

            {/* Ok İkonu */}
            <View className="items-center">
              <ArrowDown size={20} color="#96A6F9" strokeWidth={2.2} />
            </View>

            {/* Seslendirilen Anlatım */}
            <View className="flex-row items-start gap-2.5 rounded-[14px] bg-white p-3.5">
              {/* Ses Dalgaları Çubukları */}
              <View className="h-5 flex-row items-center gap-[2px] pt-0.5">
                <View className="h-2 w-[3px] rounded-[2px] bg-brand-indigo" />
                <View className="h-4 w-[3px] rounded-[2px] bg-brand-indigo" />
                <View className="h-[11px] w-[3px] rounded-[2px] bg-[#96A6F9]" />
              </View>

              <Text className="flex-1 text-[15px] font-semibold leading-[22px] text-brand-ink">
                “Osmanlı Devleti bin iki yüz doksan dokuzda Osman Bey tarafından
                kuruldu.”
              </Text>
            </View>
          </View>
        </View>

        {/* Özellik Maddeleri */}
        <View className="gap-3 px-6 pt-5">
          <View className="flex-row items-center gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-[#EEF0FB]">
              <Check size={13} color="#1928B4" strokeWidth={3.2} />
            </View>
            <Text className="text-[15px] text-brand-ink">
              Ayda <Text className="font-bold">500 sayfa</Text>{" "}
              <Text className="text-brand-muted">(Free: 30)</Text>
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-[#EEF0FB]">
              <Check size={13} color="#1928B4" strokeWidth={3.2} />
            </View>
            <Text className="text-[15px] text-brand-ink">
              Her bölüm sonunda <Text className="font-bold">tekrar özeti</Text>
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-[#EEF0FB]">
              <Check size={13} color="#1928B4" strokeWidth={3.2} />
            </View>
            <Text className="text-[15px] text-brand-ink">
              <Text className="font-bold">30 MB</Text>'a kadar PDF,{" "}
              <Text className="font-bold">öncelikli</Text> sıra
            </Text>
          </View>
        </View>

        {/* Plan Seçenekleri */}
        <View
          accessibilityRole="radiogroup"
          aria-label="Plan seçimi"
          className="mt-4.5 flex-row gap-2.5 px-6"
        >
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => setSelectedPlan(plan.id)}
                className={`flex-1 rounded-2xl border-2 p-3.5 ${
                  isSelected
                    ? "border-brand-indigo bg-brand-lavender"
                    : "border-brand-hairline bg-white"
                }`}
              >
                <Text className="text-sm font-bold text-brand-ink">
                  {plan.name}
                </Text>
                <Text className="mt-1 font-display text-xl font-extrabold tracking-[-0.02em] text-brand-ink">
                  {plan.price}
                </Text>
                <Text className="mt-0.5 text-xs text-brand-ink-soft">
                  {plan.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Esnek Boşluk */}
        <View className="min-h-6 flex-1" />

        {/* Alt Satın Alma Alanı */}
        <View
          className="px-6"
          style={{ paddingBottom: Math.max(insets.bottom + 12, 32) }}
        >
          <AuthButton
            loading={isProcessing}
            onPress={() => void handleSubscribe()}
          >
            {isPro ? "Aboneliğin Aktif" : "Pro'ya geç"}
          </AuthButton>

          <Text className="mt-3 text-center text-xs leading-[18px] text-brand-muted">
            Abonelik mağaza hesabından yönetilir, istediğin zaman iptal
            edebilirsin.
          </Text>

          <View className="mt-2 flex-row justify-center gap-4 text-xs font-semibold">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Satın alımı geri yükle"
              onPress={() => void handleRestorePurchases()}
              className="py-1"
            >
              <Text className="text-xs font-semibold text-brand-indigo">
                Satın alımı geri yükle
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Koşullar"
              onPress={() =>
                router.push({
                  pathname: "/legal/[document]",
                  params: { document: "terms-of-use" },
                })
              }
              className="py-1"
            >
              <Text className="text-xs font-semibold text-brand-indigo">
                Koşullar
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Gizlilik"
              onPress={() =>
                router.push({
                  pathname: "/legal/[document]",
                  params: { document: "privacy-notice" },
                })
              }
              className="py-1"
            >
              <Text className="text-xs font-semibold text-brand-indigo">
                Gizlilik
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
