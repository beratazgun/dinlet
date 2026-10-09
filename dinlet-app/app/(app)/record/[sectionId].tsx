import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { getQueryKey, useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { usePlayer } from "@/context";
import { formatClock } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

/** Konuşma için mono, orta bit hızı: paragraf başına ~0,7 MB/dk. */
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 96_000,
  isMeteringEnabled: true,
};
const BAR_COUNT = 40;
const MIN_CLIP_MS = 600;

type Phase = "idle" | "recording" | "paused";

/** dBFS (−60…0) → çubuk yüksekliği (6…60 px). */
function levelToHeight(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 6;
  const normalized = Math.min(1, Math.max(0, (db + 60) / 60));
  return 6 + Math.round(normalized ** 1.6 * 54);
}

function CloseIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#F4F5FD" strokeWidth={2} strokeLinecap="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

/**
 * "Kendi sesinle kaydet": metin paragraf paragraf akar; her paragraf ayrı
 * kaydedilip yüklenir. Son paragraftan sonra gözden geçirme ekranı açılır.
 */
export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const params = useLocalSearchParams<{ sectionId: string; position?: string }>();
  const sectionId = Number(params.sectionId);

  const query = useCraftQuery("recordings", "getRecording", [{ id: sectionId }]);
  const uploadClip = useCraftMutation("recordings", "uploadClip");
  const recording = query.data?.data;
  const parts = recording?.parts ?? [];

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const lastDurationRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  // İlk açılışta istenen paragraf, yoksa kaydedilmemiş ilk paragraf.
  useEffect(() => {
    if (position !== null || parts.length === 0) return;
    const requested = params.position !== undefined ? Number(params.position) : NaN;
    const firstMissing = parts.find((part) => !part.clip)?.position ?? 0;
    setPosition(Number.isInteger(requested) && requested < parts.length ? requested : firstMissing);
  }, [parts, params.position, position]);

  // Ana oynatıcı susar; kayıt için ses oturumu açılır, çıkışta kapanır.
  useEffect(() => {
    if (player.isPlaying) void player.pause();
    return () => {
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    };
    // Yalnızca açılışta: oynatıcı sonradan başlatılırsa durdurulmaz.
  }, []);

  useEffect(() => {
    if (!recorderState.isRecording) return;
    lastDurationRef.current = recorderState.durationMillis;
    setLevels((previous) => [...previous, levelToHeight(recorderState.metering)].slice(-BAR_COUNT));
  }, [recorderState.durationMillis, recorderState.isRecording, recorderState.metering]);

  const current = position === null ? undefined : parts[position];
  const previous = position === null ? undefined : parts[position - 1];
  const next = position === null ? undefined : parts[position + 1];
  const isLast = position !== null && position === parts.length - 1;

  const resetTake = () => {
    setLevels([]);
    lastDurationRef.current = 0;
  };

  const ensurePermission = async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (permission.granted) return true;
    Alert.alert(
      "Mikrofon izni gerekiyor",
      "Bölümü kendi sesinle kaydedebilmen için Dinlet'in mikrofona erişmesine izin ver.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Ayarları aç", onPress: () => void Linking.openSettings() },
      ]
    );
    return false;
  };

  const toggleRecord = async () => {
    try {
      if (phase === "recording") {
        recorder.pause();
        setPhase("paused");
        return;
      }
      if (phase === "paused") {
        recorder.record();
        setPhase("recording");
        return;
      }
      if (!(await ensurePermission())) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      resetTake();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("recording");
    } catch (error) {
      setPhase("idle");
      Alert.alert("Kayıt başlatılamadı", error instanceof Error ? error.message : String(error));
    }
  };

  /** Alınan kaydı bırakır; sunucudaki önceki kayıt (varsa) kalır. */
  const restart = async () => {
    if (phase !== "idle") await recorder.stop();
    setPhase("idle");
    resetTake();
  };

  const goTo = useCallback(
    (nextPosition: number) => {
      setPosition(nextPosition);
      resetTake();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    []
  );

  const openReview = () =>
    router.replace({
      pathname: "/record/review/[sectionId]",
      params: { sectionId: String(sectionId) },
    });

  const saveAndNext = async () => {
    if (!current || position === null) return;
    if (phase === "idle") {
      if (!current.clip) {
        Alert.alert("Önce kaydet", "Bu paragrafı okuyup kaydettikten sonra devam edebilirsin.");
        return;
      }
      if (isLast) openReview();
      else goTo(position + 1);
      return;
    }

    const durationMs = lastDurationRef.current;
    await recorder.stop();
    setPhase("idle");
    const uri = recorder.uri;
    if (!uri || durationMs < MIN_CLIP_MS) {
      resetTake();
      Alert.alert("Kayıt çok kısa", "Paragrafı baştan okuyup tekrar kaydet.");
      return;
    }

    uploadClip.mutate(
      { sectionId, position, uri, durationMs },
      {
        onSuccess: (response) => {
          queryClient.setQueryData(
            getQueryKey("recordings", "getRecording", { id: sectionId }),
            response
          );
          void queryClient.invalidateQueries({ queryKey: ["me", "recordings"] });
          if (isLast) openReview();
          else goTo(position + 1);
        },
        onError: (error) =>
          Alert.alert(
            "Kayıt yüklenemedi",
            `${getApiErrorMessage(error)} Paragrafı yeniden kaydedebilirsin.`
          ),
      }
    );
  };

  const close = () => {
    const leave = async () => {
      if (phase !== "idle") await recorder.stop();
      router.back();
    };
    if (phase === "idle") {
      void leave();
      return;
    }
    Alert.alert("Kayıt bırakılsın mı?", "Bu paragrafın kaydedilmemiş kaydı silinecek.", [
      { text: "Devam et", style: "cancel" },
      { text: "Bırak", style: "destructive", onPress: () => void leave() },
    ]);
  };

  const statusText =
    phase === "recording"
      ? `Kaydediliyor · ${formatClock(recorderState.durationMillis)}`
      : phase === "paused"
        ? `Duraklatıldı · ${formatClock(lastDurationRef.current)}`
        : current?.clip
          ? `Kaydedildi · ${formatClock(current.clip.durationMs)}`
          : "Kayda hazır";

  const bars = Array.from({ length: BAR_COUNT }, (_, index) => {
    const offset = BAR_COUNT - levels.length;
    return index < offset ? null : levels[index - offset]!;
  });

  return (
    <View
      className="flex-1 bg-[#0A0D2B] px-5"
      style={{ paddingTop: Math.max(insets.top + 8, 56), paddingBottom: Math.max(insets.bottom + 8, 34) }}
    >
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={close}
          className="-ml-2.5 h-11 w-11 items-center justify-center"
        >
          <CloseIcon />
        </Pressable>
        <View className="flex-1 items-center px-2">
          <Text className="text-[11px] font-bold uppercase tracking-[0.88px] text-[#A7AED6]">
            Kendi sesinle
          </Text>
          <Text numberOfLines={1} className="text-sm font-bold text-[#F4F5FD]">
            {recording?.sectionTitle ?? ""}
          </Text>
        </View>
        <Text className="w-11 text-right text-[13px] font-bold text-[#A7AED6]">
          {position === null || parts.length === 0 ? "" : `${position + 1}/${parts.length}`}
        </Text>
      </View>

      <View className="mt-3 flex-row gap-1">
        {parts.map((part) => (
          <View
            key={part.position}
            className="h-1 flex-1 rounded-sm"
            style={{
              backgroundColor:
                part.position === position ? "#2D40E5" : part.clip ? "#96A6F9" : "#2A3060",
            }}
          />
        ))}
      </View>

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#96A6F9" />
        </View>
      ) : query.isError || !current ? (
        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-center text-[15px] leading-[22px] text-[#F4F5FD]">
            {query.isError ? getApiErrorMessage(query.error) : "Bu bölümde kaydedilecek metin yok."}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="py-2">
            <Text className="text-[15px] font-bold text-brand-accent">Geri dön</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          className="mt-[22px] flex-1"
          contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
        >
          {previous ? (
            <Text numberOfLines={3} className="text-base leading-6 text-[#5E6595]">
              {previous.text}
            </Text>
          ) : null}
          {current.kind === "RECAP" ? (
            <Text className="text-xs font-extrabold uppercase tracking-[0.96px] text-brand-accent">
              Tekrar özeti
            </Text>
          ) : null}
          <Text className="font-display text-[26px] leading-[35px] tracking-[-0.26px] text-white">
            {current.text}
          </Text>
          {next ? (
            <Text numberOfLines={2} className="text-base leading-6 text-[#5E6595]">
              {next.text}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <View
        accessibilityLabel="Ses seviyesi"
        className="h-16 flex-row items-center justify-center gap-[3px]"
      >
        {bars.map((height, index) => (
          <View
            key={index}
            className="w-1 rounded-sm"
            style={{
              height: height ?? 6,
              backgroundColor: height === null ? "#2A3060" : "#96A6F9",
            }}
          />
        ))}
      </View>
      <View className="mt-2.5 flex-row items-center justify-center gap-2">
        {phase === "recording" ? (
          <View className="h-[9px] w-[9px] rounded-full bg-[#F04438]" />
        ) : null}
        <Text
          accessibilityLiveRegion="polite"
          className="text-[15px] font-bold text-[#F4F5FD]"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {statusText}
        </Text>
      </View>

      <View className="mt-[22px] flex-row items-center justify-between px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paragrafı baştan kaydet"
          disabled={phase === "idle" || uploadClip.isPending}
          onPress={() => void restart()}
          className="h-16 w-16 items-center justify-center gap-[3px] rounded-[20px] bg-[#151A45]"
          style={{ opacity: phase === "idle" ? 0.45 : 1 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F4F5FD" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 12a8 8 0 1 0 2.3-5.7" />
            <Path d="M4 4v5h5" />
          </Svg>
          <Text className="text-[11px] font-bold text-[#F4F5FD]">Baştan</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            phase === "recording" ? "Kaydı duraklat" : phase === "paused" ? "Kayda devam et" : "Kaydı başlat"
          }
          disabled={!current || uploadClip.isPending}
          onPress={() => void toggleRecord()}
          className="h-[88px] w-[88px] items-center justify-center rounded-full border-4 border-[#F4F5FD]"
        >
          {phase === "recording" ? (
            <View className="h-8 w-8 rounded-lg bg-[#F04438]" />
          ) : (
            <View className="h-[66px] w-[66px] rounded-full bg-[#F04438]" />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Kaydı bitir" : "Sonraki paragraf"}
          disabled={!current || uploadClip.isPending}
          onPress={() => void saveAndNext()}
          className="h-16 w-16 items-center justify-center gap-[3px] rounded-[20px] bg-brand-blue-vivid"
        >
          {uploadClip.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 5l7 7-7 7" />
              </Svg>
              <Text className="text-[11px] font-bold text-white">{isLast ? "Bitir" : "Sonraki"}</Text>
            </>
          )}
        </Pressable>
      </View>
      <Text className="mt-5 text-center text-[13px] leading-[18px] text-[#A7AED6]">
        Paragrafı okuyunca “{isLast ? "Bitir" : "Sonraki"}”ye bas. İstediğin paragrafı sonra
        yeniden kaydedebilirsin.
      </Text>
    </View>
  );
}
