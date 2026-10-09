import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getQueryKey, useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { GetVoiceApiResponse } from "@/networks/api/recordings/recordings";

type VoiceOption = NonNullable<GetVoiceApiResponse["Data"]>["options"][number];
type Voice = "STANDARD" | "NATURAL" | "OWN";

/** Seçenek rozeti: Ücretsiz / Pro / Kayıt; henüz olmayan ses "Yakında". */
function optionTag(option: VoiceOption) {
  if (!option.available) return { text: "YAKINDA", bg: "#F1F2F6", fg: "#575C7A" };
  if (option.requiresPro) return { text: "PRO", bg: "#1928B4", fg: "#FFFFFF" };
  if (option.voice?.raw === "OWN") return { text: "KAYIT", bg: "#EEF0FB", fg: "#1928B4" };
  return { text: "ÜCRETSİZ", bg: "#F1F2F6", fg: "#575C7A" };
}

/** "Ses": yapay zekâ sesi veya kayıtlı bölümlerde kendi sesin. */
export default function VoiceSettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const query = useCraftQuery("recordings", "getVoice", [], { refetchOnScreenFocus: true });
  const updateVoice = useCraftMutation("recordings", "updateVoice");
  const data = query.data?.data;
  const selected = data?.voice?.raw;

  const choose = (voice: Voice) => {
    if (voice === selected) return;
    updateVoice.mutate(
      { voice },
      {
        onSuccess: (response) => {
          queryClient.setQueryData(getQueryKey("recordings", "getVoice"), response);
          // Oynatıcı bölüm detayından hangi sesin çalacağını okur.
          void queryClient.invalidateQueries({ queryKey: ["sections"] });
        },
        onError: (error) => Alert.alert("Değiştirilemedi", getApiErrorMessage(error)),
      }
    );
  };

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 16, 34),
        }}
      >
        <BackButton onPress={() => router.back()} />
        <Text
          accessibilityRole="header"
          className="mb-1 mt-2 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
        >
          Ses
        </Text>
        <Text className="text-sm leading-5 text-brand-ink-soft">
          Notların bu sesle çalar. Kendi sesinle kaydettiğin bölümlerde, bölüm bazında da
          seçebilirsin.
        </Text>

        {query.isPending ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : !data ? (
          <View className="mt-4">
            <FormError>{getApiErrorMessage(query.error)}</FormError>
          </View>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Ses seçimi" className="mt-5 gap-2.5">
            {data.options.map((option) => {
              const voice = option.voice?.raw as Voice | undefined;
              if (!voice) return null;
              const isSelected = voice === selected;
              const tag = optionTag(option);
              return (
                <Pressable
                  key={voice}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: !option.available }}
                  disabled={!option.available || updateVoice.isPending}
                  onPress={() => choose(voice)}
                  className="flex-row items-start gap-3 rounded-[18px] border-[1.5px] p-3.5"
                  style={{
                    borderColor: isSelected ? "#1928B4" : "#E4E7F6",
                    backgroundColor: isSelected ? "#F4F5FD" : "#FFFFFF",
                    opacity: option.available ? 1 : 0.6,
                  }}
                >
                  <View
                    className="mt-px h-[22px] w-[22px] items-center justify-center rounded-full border-2"
                    style={{ borderColor: isSelected ? "#1928B4" : "#B7BCD6" }}
                  >
                    {isSelected ? <View className="h-2.5 w-2.5 rounded-full bg-brand-indigo" /> : null}
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[15px] font-bold text-brand-ink">
                        {option.voice?.display}
                      </Text>
                      <View className="rounded-[5px] px-1.5 py-[3px]" style={{ backgroundColor: tag.bg }}>
                        <Text
                          className="text-[10px] font-extrabold tracking-[0.6px]"
                          style={{ color: tag.fg }}
                        >
                          {tag.text}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[13px] leading-[19px] text-brand-ink-soft">
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View className="mt-[18px] gap-2 rounded-2xl bg-brand-lavender p-3.5">
          <Text className="text-sm font-bold text-brand-ink">Kendi sesinle kaydetmek için</Text>
          <Text className="text-[13px] leading-[19px] text-brand-ink-soft">
            Bir notu aç, bölümün metnini açıp “Kendi sesinle kaydet”i seç. Metin ekranda paragraf
            paragraf akar.
          </Text>
          <View className="flex-row gap-[18px]">
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/recordings")}
              className="py-1.5"
            >
              <Text className="text-sm font-bold text-brand-indigo">
                {`Kayıtlarım (${data?.recordingCount ?? 0})`}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate("/")}
              className="py-1.5"
            >
              <Text className="text-sm font-bold text-brand-indigo">Not seç</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-1" />
        <Text className="mt-6 text-center text-xs leading-[17px] text-brand-muted">
          Yapay zekâ sesleri oynatıcıda “Yapay zekâ ile seslendirildi” olarak belirtilir.
        </Text>
      </ScrollView>
    </View>
  );
}
