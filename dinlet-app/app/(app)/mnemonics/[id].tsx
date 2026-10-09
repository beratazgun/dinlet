import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TriangleAlert } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { AuthButton, BackButton, FormError } from "@/components/auth";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { ListMnemonicsApiResponse } from "@/networks/api/study-tools/study-tools";

type Mnemonic = NonNullable<ListMnemonicsApiResponse["Data"]>["items"][number];

/** Öneriler hazırlanırken liste bu aralıkla tazelenir. */
const PENDING_REFRESH_MS = 3_000;

function MnemonicCard({
  mnemonic,
  onKeep,
  onDismiss,
}: {
  mnemonic: Mnemonic;
  onKeep: () => void;
  onDismiss: () => void;
}) {
  const kept = mnemonic.kept;
  return (
    <View
      className={`gap-2.5 rounded-[18px] border-[1.5px] p-4 ${
        kept ? "border-brand-indigo bg-brand-lavender" : "border-brand-hairline bg-white"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-xs font-bold text-brand-muted">{mnemonic.topic}</Text>
        <View className="rounded-[5px] bg-[#FFF1E6] px-1.5 py-[3px]">
          <Text className="text-[10px] font-bold tracking-[0.6px] text-[#B54708]">ÖNERİ</Text>
        </View>
      </View>
      <Text className="font-display text-[22px] leading-[26px] tracking-[-0.22px] text-brand-indigo">
        {mnemonic.hook}
      </Text>
      <Text className="text-sm leading-5 text-brand-body">{mnemonic.explanation}</Text>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: kept }}
          onPress={onKeep}
          className={`h-10 justify-center rounded-xl px-3.5 ${kept ? "bg-brand-surface" : "bg-brand-indigo"}`}
        >
          <Text className={`text-sm font-bold ${kept ? "text-brand-indigo" : "text-white"}`}>
            {kept ? "Saklandı" : "Sakla"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDismiss} className="h-10 justify-center px-3.5">
          <Text className="text-sm font-bold text-brand-ink-soft">Kaldır</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Hafıza kancaları: LLM önerileri; saklananlar bölüm sonunda okunur. */
export default function MnemonicsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = Number(id);
  const list = useCraftQuery("study-tools", "listMnemonics", [{ id: documentId }], {
    refetchInterval: (query) =>
      query.state.data?.data?.status?.raw === "PENDING" ? PENDING_REFRESH_MS : false,
  });
  const requestMnemonics = useCraftMutation("study-tools", "requestMnemonics");
  const updateMnemonic = useCraftMutation("study-tools", "updateMnemonic");

  const data = list.data?.data;
  const status = data?.status?.raw ?? null;
  const items = data?.items ?? [];

  async function generate() {
    try {
      await requestMnemonics.mutateAsync({ id: documentId });
      await list.refetch();
    } catch (error) {
      const code = getApiErrorCode(error);
      if (code === "PRO_REQUIRED") {
        Alert.alert("Hafıza kancaları Pro'ya özel", "Pro'da notundaki sıralar ve tarihler için kanca önerilir.", [
          { text: "Vazgeç", style: "cancel" },
          { text: "Pro'ya geç", onPress: () => router.push("/pro") },
        ]);
      } else if (code === "CROSS_BORDER_CONSENT_REQUIRED") {
        Alert.alert(
          "Açık rıza gerekiyor",
          "Öneriler yurt dışındaki yapay zekâ servisiyle hazırlanır.",
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

  async function change(mnemonic: Mnemonic, patch: { kept?: boolean; dismissed?: boolean }) {
    try {
      await updateMnemonic.mutateAsync({ params: { id: mnemonic.id }, body: patch });
      await list.refetch();
    } catch (error) {
      Alert.alert("Kaydedilemedi", getApiErrorMessage(error));
    }
  }

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
          className="mb-1 mt-1.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          Hafıza kancaları
        </Text>
        <Text className="text-sm leading-5 text-brand-ink-soft">
          Sıralama ve tarih ezberleri için öneriler. Sakladıkların bölüm sonunda okunur.
        </Text>

        <View className="mt-3.5 flex-row gap-2.5 rounded-[14px] border-[1.5px] border-[#FBD9BC] bg-[#FFF6EE] px-3.5 py-3">
          <TriangleAlert size={18} color="#B54708" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[13px] leading-[19px] text-[#5C4033]">
            Bunlar notunda yok; yapay zekâ önerisidir. Saklamadan önce doğruluğunu kontrol et.
          </Text>
        </View>

        {list.isPending ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : list.isError ? (
          <View className="mt-4">
            <FormError>{getApiErrorMessage(list.error)}</FormError>
          </View>
        ) : (
          <View className="mt-4 gap-3">
            {items.map((mnemonic) => (
              <MnemonicCard
                key={mnemonic.id}
                mnemonic={mnemonic}
                onKeep={() => void change(mnemonic, { kept: !mnemonic.kept })}
                onDismiss={() => void change(mnemonic, { dismissed: true })}
              />
            ))}

            {status === "PENDING" ? (
              <View className="flex-row items-center justify-center gap-2 py-6">
                <ActivityIndicator color="#1928B4" />
                <Text className="text-sm font-semibold text-brand-ink-soft">Öneriler hazırlanıyor…</Text>
              </View>
            ) : (
              <>
                {status === "FAILED" ? (
                  <FormError>Öneriler hazırlanamadı. Tekrar deneyebilirsin.</FormError>
                ) : items.length === 0 ? (
                  <Text className="py-6 text-center text-[15px] leading-[22px] text-brand-ink-soft">
                    Notundaki sıralar, listeler ve tarihler için hafıza kancası önerelim.
                  </Text>
                ) : null}
                <AuthButton
                  variant={items.length > 0 ? "ghost" : "primary"}
                  loading={requestMnemonics.isPending}
                  onPress={() => void generate()}
                >
                  {items.length > 0 ? "Yeni öneriler" : "Öneri hazırla"}
                </AuthButton>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
