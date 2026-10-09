import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Mic } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getQueryKey, useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { PlayGlyph } from "@/components/store";
import { useSamplePlayer } from "@/hooks/use-sample-player";
import { formatClock } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

const VOICES = [
  { id: "own", label: "Benim sesim", useOwnVoice: true },
  { id: "ai", label: "Dinlet sesi", useOwnVoice: false },
] as const;

/**
 * "Kaydın hazır": paragrafları dinle, istediğini yeniden kaydet, bu bölümde
 * hangi sesin çalacağını seç ve kaydet (worker tek sese birleştirir).
 */
export default function RecordReviewScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ sectionId: string }>();
  const sectionId = Number(params.sectionId);
  const sample = useSamplePlayer();

  const query = useCraftQuery("recordings", "getRecording", [{ id: sectionId }], {
    // Birleştirme sürerken durum izlenir.
    refetchInterval: (state) =>
      state.state.data?.data?.status?.raw === "PROCESSING" ? 1_500 : false,
  });
  const updateRecording = useCraftMutation("recordings", "updateRecording");
  const recording = query.data?.data;
  const [useOwnVoice, setUseOwnVoice] = useState(true);

  useEffect(() => {
    if (recording) setUseOwnVoice(recording.useOwnVoice);
  }, [recording?.useOwnVoice]);

  useEffect(() => {
    if (recording?.status?.raw === "READY") {
      void queryClient.invalidateQueries({ queryKey: ["me", "recordings"] });
      void queryClient.invalidateQueries({ queryKey: ["me", "voice"] });
      void queryClient.invalidateQueries({ queryKey: ["sections", sectionId] });
    }
  }, [queryClient, recording?.status?.raw, sectionId]);

  const status = recording?.status?.raw ?? null;
  const missing = recording ? recording.totalCount - recording.recordedCount : 0;
  const paragraphCount = recording?.parts.filter((part) => part.kind === "PARAGRAPH").length ?? 0;
  const hasRecap = recording?.parts.some((part) => part.kind === "RECAP") ?? false;
  const processing = status === "PROCESSING";

  const save = () => {
    sample.stop();
    updateRecording.mutate(
      { params: { id: sectionId }, body: { finalize: true, useOwnVoice } },
      {
        onSuccess: (response) =>
          queryClient.setQueryData(
            getQueryKey("recordings", "getRecording", { id: sectionId }),
            response
          ),
        onError: (error) => Alert.alert("Kaydedilemedi", getApiErrorMessage(error)),
      }
    );
  };

  const chooseVoice = (value: boolean) => {
    setUseOwnVoice(value);
    // Kayıt hazırsa seçim hemen uygulanır; değilse "Kaydet"le gider.
    if (status === "READY") {
      updateRecording.mutate(
        { params: { id: sectionId }, body: { useOwnVoice: value } },
        {
          onSuccess: (response) => {
            queryClient.setQueryData(
              getQueryKey("recordings", "getRecording", { id: sectionId }),
              response
            );
            void queryClient.invalidateQueries({ queryKey: ["me", "recordings"] });
            void queryClient.invalidateQueries({ queryKey: ["me", "voice"] });
          },
          onError: (error) => Alert.alert("Değiştirilemedi", getApiErrorMessage(error)),
        }
      );
    }
  };

  const rerecord = (position: number) => {
    sample.stop();
    router.push({
      pathname: "/record/[sectionId]",
      params: { sectionId: String(sectionId), position: String(position) },
    });
  };

  const headline =
    status === "READY"
      ? "Kaydın kaydedildi"
      : missing > 0
        ? "Kaydın yarım"
        : "Kaydın hazır";
  const summary = [
    `${paragraphCount} paragraf`,
    hasRecap ? "1 tekrar özeti" : null,
    recording ? `toplam ${formatClock(recording.durationMs ?? recording.recordedDurationMs)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: 170,
        }}
      >
        <BackButton onPress={() => router.back()} />
        {query.isPending ? (
          <View className="items-center py-24">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : !recording ? (
          <FormError>{getApiErrorMessage(query.error)}</FormError>
        ) : (
          <>
            <Text className="mt-1.5 text-[13px] font-semibold text-brand-ink-soft">
              {`Bölüm ${recording.sectionOrder} · ${recording.sectionTitle}`}
            </Text>
            <Text
              accessibilityRole="header"
              className="mt-0.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
            >
              {headline}
            </Text>
            <Text className="mt-1.5 text-sm text-brand-ink-soft">{summary}</Text>

            <View className="mt-3.5">
              {recording.parts.map((part) => {
                const key = `clip-${part.position}`;
                const playing = sample.playingKey === key;
                const recorded = Boolean(part.clip);
                const label = part.kind === "RECAP" ? `Tekrar: ${part.text}` : part.text;
                return (
                  <View
                    key={part.position}
                    className="flex-row items-center gap-3 border-b border-[#EEF0F7] py-2.5"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={playing ? "Durdur" : "Dinle"}
                      disabled={!recorded}
                      onPress={() => void sample.toggle(key, part.clip?.audioUrl)}
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: recorded ? "#EEF0FB" : "#F4F5FD" }}
                    >
                      <PlayGlyph color={recorded ? "#1928B4" : "#8A8FAD"} playing={playing} />
                    </Pressable>
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text numberOfLines={1} className="text-sm font-semibold text-brand-ink">
                        {label}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{
                          color: recorded ? "#6B7090" : "#B54708",
                          fontWeight: recorded ? "500" : "700",
                        }}
                      >
                        {part.clip ? formatClock(part.clip.durationMs) : "Kaydedilmedi"}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Yeniden kaydet"
                      disabled={processing}
                      onPress={() => rerecord(part.position)}
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: recorded ? "#F4F5FD" : "#B54708" }}
                    >
                      <Mic size={18} color={recorded ? "#575C7A" : "#FFFFFF"} strokeWidth={2} />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Text className="mt-[18px] text-sm font-semibold text-brand-ink">
              Bu bölümde hangi ses çalsın?
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Ses"
              className="mt-2 flex-row gap-1 rounded-[14px] bg-brand-lavender p-1"
            >
              {VOICES.map((voice) => {
                const selected = voice.useOwnVoice === useOwnVoice;
                return (
                  <Pressable
                    key={voice.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={processing}
                    onPress={() => chooseVoice(voice.useOwnVoice)}
                    className="h-[42px] flex-1 items-center justify-center rounded-[10px]"
                    style={{
                      backgroundColor: selected ? "#FFFFFF" : "transparent",
                      shadowColor: "#0E1238",
                      shadowOpacity: selected ? 0.12 : 0,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: selected ? 1 : 0,
                    }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{ color: selected ? "#1928B4" : "#575C7A" }}
                    >
                      {voice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {status === "FAILED" && recording.failureReason ? (
              <View className="mt-3">
                <FormError>{recording.failureReason}</FormError>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {recording ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-[#E9EBF5] bg-white px-5 pt-3.5"
          style={{ paddingBottom: Math.max(insets.bottom + 16, 32) }}
        >
          {status === "READY" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.dismissTo({
                  pathname: "/documents/[id]",
                  params: { id: String(recording.documentId) },
                })
              }
              className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-surface"
            >
              <Check size={18} color="#1928B4" strokeWidth={2.6} />
              <Text className="text-[17px] font-bold text-brand-indigo">Kaydedildi · Nota dön</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={missing > 0 || processing || updateRecording.isPending}
              onPress={save}
              className="h-14 flex-row items-center justify-center gap-2 rounded-2xl"
              style={{ backgroundColor: missing > 0 ? "#B7BCD6" : "#1928B4" }}
            >
              {processing || updateRecording.isPending ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text className="text-[17px] font-bold text-white">Hazırlanıyor</Text>
                </>
              ) : (
                <Text className="text-[17px] font-bold text-white">
                  {missing > 0 ? `${missing} paragraf eksik` : status === "FAILED" ? "Tekrar dene" : "Kaydet"}
                </Text>
              )}
            </Pressable>
          )}
          <Text className="mt-2.5 text-center text-xs text-brand-muted">
            Kayıtların yalnızca sende kalır, kotadan düşmez.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
