import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, Trash2, TriangleAlert } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { FormError } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { useAuth } from "@/providers/auth-provider";

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [typed, setTyped] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteMe = useCraftMutation("users", "deleteMe");
  const documentsQuery = useCraftQuery("documents", "listDocument", [{}]);
  const subscriptionQuery = useCraftQuery("subscription", "getMine");

  const isPro = subscriptionQuery.data?.data?.plan?.raw === "PRO";
  const docs = documentsQuery.data?.data;
  const docCount = Array.isArray(docs) ? docs.length : undefined;

  const docLabel = useMemo(() => {
    if (typeof docCount === "number" && docCount > 0) {
      return `${docCount} belge ve yüklediğin PDF'ler`;
    }
    return "Tüm belgelerin ve yüklediğin PDF'ler";
  }, [docCount]);

  const isUnlocked = typed.trim().toLocaleUpperCase("tr-TR") === "SİL";

  async function handleDelete() {
    if (!isUnlocked || deleteMe.isPending) return;
    setErrorMessage(null);

    try {
      await deleteMe.mutateAsync();
      Alert.alert(
        "Hesabın Silindi",
        "Hesabın başarıyla silindi ve oturumun sonlandırıldı.",
        [
          {
            text: "Tamam",
            onPress: () => {
              void signOut();
            },
          },
        ]
      );
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  }

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 8, 48),
          paddingBottom: Math.max(insets.bottom + 16, 36),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Geri Butonu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          className="-ml-2.5 h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E1238" strokeWidth={2} />
        </Pressable>

        {/* Kırmızı Çöp Kutusu İkonu */}
        <View className="mt-2.5 h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#FEECEB]">
          <Trash2 size={26} color="#B42318" strokeWidth={2} />
        </View>

        {/* Başlık ve Açıklama */}
        <Text
          accessibilityRole="header"
          className="mb-2 mt-4.5 font-display text-[30px] font-extrabold tracking-[-0.9px] text-brand-ink"
        >
          Hesabını sil
        </Text>
        <Text className="text-[15px] leading-snug text-brand-ink-soft">
          Bu işlem geri alınamaz. Şunlar kalıcı olarak silinir:
        </Text>

        {/* Silinecek Maddeler */}
        <View className="mt-4 gap-3 rounded-[18px] bg-brand-lavender p-4">
          <View className="flex-row items-center gap-2.5">
            <View className="h-1.5 w-1.5 rounded-full bg-[#B42318]" />
            <Text className="text-[15px] text-brand-ink">{docLabel}</Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <View className="h-1.5 w-1.5 rounded-full bg-[#B42318]" />
            <Text className="text-[15px] text-brand-ink">
              Tüm ses dosyaları ve indirilenler
            </Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <View className="h-1.5 w-1.5 rounded-full bg-[#B42318]" />
            <Text className="text-[15px] text-brand-ink">
              Dinleme ilerlemen ve oturumların
            </Text>
          </View>
        </View>

        {/* 7 Günlük Silme Notu */}
        <Text className="mt-3.5 text-[13px] leading-snug text-brand-ink-soft">
          Dosyalar 7 gün içinde sunuculardan da kalıcı olarak kaldırılır.
        </Text>

        {/* Pro Abonelik Uyarısı */}
        <View className="mt-4 flex-row gap-2.5 rounded-2xl border-[1.5px] border-[#FBD9BC] bg-[#FFF6EE] p-3.5">
          <TriangleAlert
            size={20}
            color="#B54708"
            strokeWidth={2}
            style={{ marginTop: 1 }}
          />
          <Text className="flex-1 text-[13px] leading-snug text-[#5C4033]">
            Pro aboneliğin otomatik iptal olmaz. Ücretlendirilmemek için App Store
            veya Google Play'den iptal et.
          </Text>
        </View>

        {/* Onay Metin Girişi */}
        <View className="mt-5 gap-1.5">
          <Text className="text-sm font-semibold text-brand-ink">
            Onaylamak için SİL yaz
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            placeholder="SİL"
            placeholderTextColor="#8A8FAD"
            className="h-[52px] rounded-[14px] border-[1.5px] border-brand-line bg-white px-4 font-semibold text-base text-brand-ink tracking-widest"
          />
        </View>

        {errorMessage ? (
          <View className="mt-3">
            <FormError>{errorMessage}</FormError>
          </View>
        ) : null}

        {/* Boşluk */}
        <View className="min-h-6 flex-1" />

        {/* Aksiyon Butonları */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hesabımı kalıcı olarak sil"
          disabled={!isUnlocked || deleteMe.isPending}
          onPress={() => void handleDelete()}
          className={`h-14 items-center justify-center rounded-2xl ${
            isUnlocked ? "bg-[#B42318] active:opacity-90" : "bg-[#FEECEB]"
          }`}
        >
          <Text
            className={`font-bold text-[17px] ${
              isUnlocked ? "text-white" : "text-[#F08C82]"
            }`}
          >
            {deleteMe.isPending
              ? "Siliniyor..."
              : "Hesabımı kalıcı olarak sil"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vazgeç"
          onPress={() => router.back()}
          className="mt-2.5 h-[50px] items-center justify-center"
        >
          <Text className="text-base font-bold text-brand-ink">Vazgeç</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
