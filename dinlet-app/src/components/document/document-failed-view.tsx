import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, ChevronLeft, X } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton } from "@/components/auth";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";

type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;

export function DocumentFailedView({ document }: { document: DocumentDetail }) {
  const queryClient = useQueryClient();
  const deleteMutation = useCraftMutation("documents", "deleteItem");

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ id: document.id });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      router.replace("/");
    } catch {
      Alert.alert("Hata", "Belge silinemedi. Lütfen tekrar dene.");
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 36,
        justifyContent: "space-between",
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Üst Geri Butonu */}
      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          className="-ml-2.5 h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E1238" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Orta Alan: İllüstrasyon, Başlık, İade Notu */}
      <View className="items-center py-6 text-center">
        {/* Belge ve Çarpı İkonu */}
        <View className="relative mb-3 h-[140px] w-[120px] items-center justify-center">
          <View className="h-[124px] w-[96px] gap-2 rounded-[14px] border-[1.5px] border-brand-line bg-white p-4 shadow-sm">
            <View className="h-1.5 w-[70%] rounded-sm bg-brand-hairline" />
            <View className="h-1.5 w-full rounded-sm bg-brand-hairline opacity-60" />
            <View className="h-1.5 w-[40%] rounded-sm bg-brand-hairline opacity-40" />
            <View className="h-1.5 w-[80%] rounded-sm bg-brand-hairline opacity-25" />
          </View>
          <View className="absolute bottom-0 right-1 h-[50px] w-[50px] items-center justify-center rounded-full border-4 border-brand-offwhite bg-[#FEECEB]">
            <X size={24} color="#B42318" strokeWidth={2.6} />
          </View>
        </View>

        <Text className="text-[13px] font-semibold text-brand-ink-soft">
          {document.title}
        </Text>
        <Text
          accessibilityRole="header"
          className="mt-1 font-display text-[28px] font-extrabold tracking-[-0.84px] text-brand-ink"
        >
          PDF okunamadı
        </Text>
        <Text className="mt-1.5 max-w-[310px] text-center text-[15px] leading-[23px] text-brand-ink-soft">
          {document.failureReason ||
            "Bu dosyada okunabilir metin bulamadık. Sayfalar çok düşük çözünürlüklü fotoğraflardan oluşuyor olabilir."}
        </Text>

        {/* Kota İade Rozeti */}
        <View className="mt-3.5 flex-row items-center gap-2 rounded-full bg-[#EEF0FB] px-3.5 py-2">
          <Check size={16} color="#1928B4" strokeWidth={2.6} />
          <Text className="text-[13px] font-bold text-brand-indigo">
            {document.pageCount} sayfa hakkına iade edildi
          </Text>
        </View>
      </View>

      {/* İpuçları Kutusu */}
      <View className="rounded-[18px] bg-brand-lavender p-4">
        <Text className="text-sm font-bold text-brand-ink">Daha iyi sonuç için</Text>
        <View className="mt-2.5 gap-2.5">
          <View className="flex-row items-start gap-2.5">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-surface">
              <Text className="text-xs font-bold text-brand-indigo">1</Text>
            </View>
            <Text className="flex-1 text-[13px] leading-[19px] text-brand-ink-soft">
              Notu fotoğraf yerine tarayıcı uygulamasıyla PDF'e çevir.
            </Text>
          </View>

          <View className="flex-row items-start gap-2.5">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-surface">
              <Text className="text-xs font-bold text-brand-indigo">2</Text>
            </View>
            <Text className="flex-1 text-[13px] leading-[19px] text-brand-ink-soft">
              Şifreli PDF'lerin şifresini kaldırıp yükle.
            </Text>
          </View>
        </View>
      </View>

      {/* Aksiyon Butonları */}
      <View className="mt-6 gap-2.5">
        <AuthButton onPress={() => router.replace("/upload")}>
          Başka PDF yükle
        </AuthButton>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Belgeyi kaldır"
          disabled={deleteMutation.isPending}
          onPress={() => void handleDelete()}
          className="h-12 items-center justify-center rounded-2xl bg-brand-lavender active:opacity-80"
        >
          <Text className="text-[15px] font-bold text-brand-ink">
            {deleteMutation.isPending ? "Kaldırılıyor..." : "Belgeyi kaldır"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
