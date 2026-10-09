import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AlignLeft,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  SlidersHorizontal,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WaveformScrubber } from "@/components/player/waveform-scrubber";
import { SleepTimerSheet } from "@/components/player/sleep-timer-sheet";
import { TranscriptSheet } from "@/components/player/transcript-sheet";
import { ListenModeSheet } from "@/components/study/listen-mode-sheet";
import { SectionQuizOverlay } from "@/components/player/section-quiz-overlay";
import { usePlayer } from "@/context/player-context";
import { useDownloads } from "@/context/downloads-context";
import { formatDuration } from "@/lib/format";

const ART_BARS = [36, 64, 98, 120, 84, 110, 70, 46, 28];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const downloads = useDownloads();

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [sleepTimerOpen, setSleepTimerOpen] = useState(false);
  const [listenModeOpen, setListenModeOpen] = useState(false);

  const {
    currentDocument,
    sections,
    currentSectionIndex,
    currentSection,
    currentSectionDetail,
    isPlaying,
    isLoading,
    isBuffering,
    positionMs,
    durationMs,
    speed,
    sleepTimerOption,
    sleepTimerRemainingSec,
    errorMessage,
    hasNextSection,
    activeOutroQuiz,
    outroLabel,
  } = player;

  // Seslendirme açıkken sorular kısmına gelindiğinde "Metin" ve açık olan paneller otomatik kapatılır
  useEffect(() => {
    if (activeOutroQuiz || (outroLabel && outroLabel.startsWith("Soru"))) {
      if (transcriptOpen) setTranscriptOpen(false);
      if (sleepTimerOpen) setSleepTimerOpen(false);
      if (listenModeOpen) setListenModeOpen(false);
    }
  }, [activeOutroQuiz, outroLabel, transcriptOpen, sleepTimerOpen, listenModeOpen]);

  if (!currentDocument || !currentSection) {
    return (
      <View
        className="flex-1 items-center justify-center bg-[#FCFCFD] px-6"
        style={{ paddingTop: insets.top }}
      >
        <StatusBar style="dark" />
        <Text className="text-center font-display text-lg font-bold text-brand-ink">
          Oynatılacak ses bulunamadı
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="mt-4 rounded-xl bg-brand-indigo px-5 py-2.5 active:opacity-90"
        >
          <Text className="font-bold text-white">Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  const orderPadded = String(currentSection.order).padStart(2, "0");
  const speedText = speed === 1 ? "1×" : `${String(speed).replace(".", ",")}×`;
  const sectionDuration = currentSection.durationMs ?? durationMs;

  // Uzun başlıklara göre esnek yazı boyutu hesaplama
  const titleLength = currentSection.title.length;
  const titleFontSize = titleLength > 55 ? 22 : titleLength > 32 ? 26 : 30;
  const titleLineHeight = titleLength > 55 ? 27 : titleLength > 32 ? 31 : 35;

  const isDownloaded = currentDocument ? downloads.isDocumentDownloaded(currentDocument.id) : false;
  const isDownloading = currentDocument ? downloads.isDocumentDownloading(currentDocument.id) : false;

  function handleDownloadPress() {
    if (!currentDocument) return;
    if (isDownloaded) {
      Alert.alert(
        "İndirilen Not",
        `"${currentDocument.title}" cihazına indirilmiş durumda. İnternet bağlantın olmadan dinleyebilirsin.`,
        [
          {
            text: "İndirmeyi Cihazdan Sil",
            style: "destructive",
            onPress: () => void downloads.deleteDownload(currentDocument.id),
          },
          { text: "Tamam", style: "default" },
        ]
      );
    } else if (isDownloading) {
      Alert.alert("İndirme Sürüyor", `"${currentDocument.title}" notunun sesleri indiriliyor.`, [
        {
          text: "İndirmeyi Durdur",
          style: "destructive",
          onPress: () => downloads.cancelDownload(currentDocument.id),
        },
        { text: "Devam Et", style: "default" },
      ]);
    } else {
      void downloads.downloadDocument(currentDocument);
    }
  }

  function handleOptions() {
    Alert.alert("Bölüm Seçenekleri", currentSection?.title ?? "", [
      {
        text: "Metni görüntüle",
        onPress: () => {
          if (!activeOutroQuiz) {
            setTranscriptOpen(true);
          }
        },
      },
      {
        text: "Kapat",
        style: "cancel",
      },
    ]);
  }

  return (
    <View
      className="flex-1 bg-[#FCFCFD] px-6"
      style={{
        paddingTop: Math.max(insets.top, 24),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
    >
      <StatusBar style="dark" />

      {/* Üst Bar */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Küçült"
          onPress={() => router.back()}
          className="-ml-2.5 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronDown size={26} color="#0E1238" strokeWidth={2.2} />
        </Pressable>

        <View className="flex-1 items-center gap-0.5 px-2">
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
            Dinleniyor
          </Text>
          <Text
            numberOfLines={1}
            className="text-sm font-bold text-brand-ink"
          >
            {currentDocument.title}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Diğer seçenekler"
          onPress={handleOptions}
          className="-mr-2.5 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
        >
          <MoreHorizontal size={22} color="#0E1238" strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Hata Uyarısı */}
      {errorMessage ? (
        <View className="mt-2 rounded-xl bg-red-50 p-2.5">
          <Text className="text-center text-xs font-semibold text-red-600">
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Sanat Kartı (Art Card) */}
      <View className="relative mt-4 min-h-[290px] w-full justify-end overflow-hidden rounded-[28px] bg-brand-indigo p-6">
        {/* Filigran Bölüm Numarası - Kırpılma olmadan tam görünüm */}
        <View
          pointerEvents="none"
          className="absolute left-5 top-3"
        >
          <Text
            style={{
              fontFamily: "BricolageGrotesque_800ExtraBold",
              fontSize: 92,
              lineHeight: 98,
              letterSpacing: -3,
              color: "rgba(255, 255, 255, 0.20)",
            }}
          >
            {orderPadded}
          </Text>
        </View>

        {/* Ekolayzır Çubukları */}
        <View className="absolute right-6 top-6 h-[110px] flex-row items-center gap-[5px]">
          {ART_BARS.map((height, i) => {
            const barColor =
              i % 3 === 1 ? "#96A6F9" : "rgba(255,255,255,0.85)";
            return (
              <View
                key={i}
                className="w-[6px] rounded-[3px]"
                style={{
                  height,
                  backgroundColor: barColor,
                  opacity: isPlaying ? 1 : 0.6,
                }}
              />
            );
          })}
        </View>

        {/* Bölüm Başlığı & Bilgileri - Uzun etiketlerde esnek ve taşmayan yapı */}
        <View className="z-10 gap-1.5 pt-20">
          <Text
            numberOfLines={1}
            className="text-[13px] font-semibold text-[#DCE1FF]"
          >
            Bölüm {currentSection.order} / {sections.length} ·{" "}
            {sectionDuration ? formatDuration(sectionDuration) : ""}
          </Text>
          <Text
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              fontFamily: "BricolageGrotesque_800ExtraBold",
              fontSize: titleFontSize,
              lineHeight: titleLineHeight,
              letterSpacing: -0.6,
              color: "#FFFFFF",
            }}
          >
            {currentSection.title}
          </Text>
        </View>
      </View>

      {/* Dalga Formu ve Zaman İlerlemesi (Yumuşak animasyonlu geçiş) */}
      <View className="mt-6">
        <WaveformScrubber
          positionMs={positionMs}
          durationMs={durationMs || sectionDuration || 1}
          onSeek={(targetMs) => void player.seekTo(targetMs)}
        />
      </View>

      {/* Ana Oynatma Kontrolleri */}
      <View className="mt-5 flex-row items-center justify-between">
        {/* Hız Butonu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Oynatma hızı ${speedText}`}
          onPress={() => void player.cycleSpeed()}
          className="h-11 w-14 items-center justify-center rounded-xl bg-brand-surface active:opacity-75"
        >
          <Text className="text-[15px] font-extrabold text-brand-indigo">
            {speedText}
          </Text>
        </Pressable>

        {/* 15 Saniye Geri */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="15 saniye geri sar"
          onPress={() => void player.seekBy(-15000)}
          className="h-13 w-13 items-center justify-center active:opacity-70"
        >
          <View className="relative items-center justify-center">
            <RotateCcw size={32} color="#0E1238" strokeWidth={1.8} />
            <Text className="absolute text-[8px] font-extrabold text-brand-ink">
              15
            </Text>
          </View>
        </Pressable>

        {/* Oynat / Duraklat Butonu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Duraklat" : "Oynat"}
          onPress={() => void player.togglePlayPause()}
          className="h-20 w-20 items-center justify-center rounded-full bg-brand-indigo shadow-xl shadow-indigo-900/40 active:opacity-90"
        >
          {isLoading || isBuffering ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : isPlaying ? (
            <Pause size={30} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={32} color="#FFFFFF" fill="#FFFFFF" className="ml-1" />
          )}
        </Pressable>

        {/* 15 Saniye İleri */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="15 saniye ileri sar"
          onPress={() => void player.seekBy(15000)}
          className="h-13 w-13 items-center justify-center active:opacity-70"
        >
          <View className="relative items-center justify-center">
            <RotateCw size={32} color="#0E1238" strokeWidth={1.8} />
            <Text className="absolute text-[8px] font-extrabold text-brand-ink">
              15
            </Text>
          </View>
        </Pressable>

        {/* Sonraki Bölüm */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sonraki bölüm"
          disabled={!hasNextSection}
          onPress={() => void player.nextSection()}
          className={`h-11 w-14 items-center justify-center ${
            hasNextSection ? "active:opacity-70" : "opacity-30"
          }`}
        >
          <SkipForward size={26} color="#0E1238" strokeWidth={2} />
        </Pressable>
      </View>

      <View className="flex-1" />

      {/* Bölüm sonu okunuyorsa (hafıza kancası, sorular) */}
      {player.outroLabel ? (
        <View className="mb-3 self-center rounded-full bg-brand-lavender px-3.5 py-1.5">
          <Text className="text-xs font-bold text-brand-indigo">
            Bölüm sonu · {player.outroLabel}
          </Text>
        </View>
      ) : null}


      {/* Alt Aksiyon Butonları (Metin / Uyku / Mod / İndirildi) */}
      <View className="grid grid-cols-3 flex-row gap-2.5">
        {/* Metin Butonu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bölüm metnini göster"
          disabled={Boolean(activeOutroQuiz)}
          onPress={() => setTranscriptOpen(true)}
          className={`h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand-surface active:opacity-75 ${
            activeOutroQuiz ? "opacity-40" : ""
          }`}
        >
          <AlignLeft size={20} color="#0E1238" strokeWidth={2} />
          <Text className="text-xs font-bold text-brand-ink">Metin</Text>
        </Pressable>

        {/* Uyku Zamanlayıcısı */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Uyku zamanlayıcısı"
          onPress={() => setSleepTimerOpen(true)}
          className="h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand-surface active:opacity-75"
        >
          <Moon
            size={20}
            color={sleepTimerOption !== "off" ? "#1928B4" : "#0E1238"}
            strokeWidth={2}
          />
          <Text
            className={`text-xs font-bold ${
              sleepTimerOption !== "off"
                ? "text-brand-indigo"
                : "text-brand-ink"
            }`}
          >
            {sleepTimerRemainingSec !== null
              ? `${Math.ceil(sleepTimerRemainingSec / 60)} dk`
              : "Uyku"}
          </Text>
        </Pressable>

        {/* Dinleme modu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dinleme modu"
          onPress={() => setListenModeOpen(true)}
          className="h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand-surface active:opacity-75"
        >
          <SlidersHorizontal size={20} color={player.isQuickAudio ? "#1928B4" : "#0E1238"} strokeWidth={2} />
          <Text
            className={`text-xs font-bold ${player.isQuickAudio ? "text-brand-indigo" : "text-brand-ink"}`}
          >
            {player.isQuickAudio ? "Hızlı" : "Mod"}
          </Text>
        </Pressable>

        {/* İndirildi / İndir Durumu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isDownloaded
              ? "İndirildi"
              : isDownloading
                ? "İndiriliyor"
                : "İndir"
          }
          onPress={handleDownloadPress}
          className="h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand-surface active:opacity-75"
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color="#1928B4" />
          ) : isDownloaded ? (
            <Check size={20} color="#1928B4" strokeWidth={2.4} />
          ) : (
            <ArrowDownToLine size={20} color="#1928B4" strokeWidth={2.2} />
          )}
          <Text className="text-xs font-bold text-brand-indigo">
            {isDownloading ? "İndiriliyor" : isDownloaded ? "İndirildi" : "İndir"}
          </Text>
        </Pressable>
      </View>

      {/* Footer Metni */}
      <Text className="mt-4 text-center text-xs font-medium text-brand-ink-soft">
        {player.isOwnVoice ? "Senin sesinle kaydedildi" : "Yapay zekâ ile seslendirildi"}
      </Text>

      {player.currentDocument ? (
        <ListenModeSheet
          visible={listenModeOpen}
          onClose={() => setListenModeOpen(false)}
          documentId={player.currentDocument.id}
          sectionTitle={player.currentSection?.title ?? player.currentDocument.title}
          section={player.currentSection}
          sections={player.currentDocument.sections ?? []}
        />
      ) : null}


      {/* Uyku Zamanlayıcısı Sheet */}
      <SleepTimerSheet
        visible={sleepTimerOpen}
        selectedOption={sleepTimerOption}
        remainingSec={sleepTimerRemainingSec}
        onSelect={(opt) => player.setSleepTimer(opt)}
        onClose={() => setSleepTimerOpen(false)}
      />

      {/* Metin Görünümü Sheet */}
      <TranscriptSheet
        visible={transcriptOpen}
        section={currentSection}
        sectionDetail={currentSectionDetail}
        totalSections={sections.length}
        isPlaying={isPlaying}
        positionMs={positionMs}
        durationMs={durationMs || sectionDuration || 1}
        onTogglePlayPause={() => void player.togglePlayPause()}
        onSeekTo={(posMs) => void player.seekTo(posMs)}
        onClose={() => setTranscriptOpen(false)}
      />

      {/* Bölüm sonu sesli soru ekranı ("Çalışma araçları" / Sesli soru tasarımı) */}
      {player.activeOutroQuiz ? (
        <SectionQuizOverlay
          quiz={player.activeOutroQuiz}
          onClose={player.dismissOutro}
          onSkipThinking={player.skipOutroThinking}
          onChoose={(known) => player.nextOutroQuestion(known)}
          onComplete={player.completeOutroSummary}
        />
      ) : null}
    </View>
  );
}
