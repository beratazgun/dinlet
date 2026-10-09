import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { AudioLines, ChevronDown, Pause, Play } from "lucide-react-native";
import { useReduceMotion, useUserSettings } from "@/hooks/use-user-settings";
import { formatClock } from "@/lib/format";
import { activeWordIndex, readingStyle, splitWords } from "@/lib/reading-style";
import type { SectionDetail, SectionSummary } from "@/context/player-context";

interface SegmentRange {
  startMs: number;
  endMs: number;
}

const TITLE_PAUSE_MS = 800;
const PARAGRAPH_PAUSE_MS = 600;
const RECAP_PAUSE_MS = 1200;

/**
 * Metnin seslendirme ağırlığını hesaplar.
 * Rakamlar ve duraklama işaretleri TTS modelinde ek okuma süresi alır.
 */
function estimateSpokenWeight(rawText: string): number {
  if (!rawText) return 0;
  const text = rawText.trim();
  if (!text) return 0;

  let weight = text.length;

  // Sayılar okunuşta uzar ("1923" -> "bin dokuz yüz yirmi üç")
  const digits = text.match(/\d/g)?.length ?? 0;
  weight += digits * 4;

  // Virgül ve noktalı virgül konuşmada doğal duraklama ekler (~200ms)
  const minorPauses = text.match(/[,;:]/g)?.length ?? 0;
  weight += minorPauses * 3;

  // Cümle bitişleri (. ! ?) daha belirgin duraklama ekler (~400ms)
  const majorPauses = text.match(/[.!?…]/g)?.length ?? 0;
  weight += majorPauses * 6;

  return Math.max(1, weight);
}

function computeTranscriptTimeline(
  title: string,
  paragraphs: string[],
  recap: string | null | undefined,
  durationMs: number
): {
  titleRange: SegmentRange;
  paragraphRanges: SegmentRange[];
  recapRange: SegmentRange | null;
} {
  const safeDuration = Math.max(1000, durationMs);
  const hasParagraphs = paragraphs.length > 0;
  const hasRecap = Boolean(recap && recap.trim().length > 0);

  // Toplam duraklama süreleri (dinlet-worker ayarlarıyla birebir aynı)
  let totalFixedPause = 0;
  if (title) totalFixedPause += TITLE_PAUSE_MS;
  if (hasParagraphs) {
    totalFixedPause += Math.max(0, paragraphs.length - 1) * PARAGRAPH_PAUSE_MS;
    if (hasRecap) {
      totalFixedPause += RECAP_PAUSE_MS;
    }
  }

  // Duraklamaları süreye göre sınırla
  const availableSpeechMs = Math.max(
    safeDuration * 0.45,
    safeDuration - totalFixedPause
  );
  const pauseScale = (safeDuration - availableSpeechMs) / Math.max(1, totalFixedPause);
  const scaledTitlePause = Math.round(TITLE_PAUSE_MS * pauseScale);
  const scaledParaPause = Math.round(PARAGRAPH_PAUSE_MS * pauseScale);
  const scaledRecapPause = Math.round(RECAP_PAUSE_MS * pauseScale);

  const titleWeight = estimateSpokenWeight(title);
  const paraWeights = paragraphs.map((p) => estimateSpokenWeight(p));
  const recapWeight = hasRecap ? estimateSpokenWeight(recap!) : 0;
  const totalWeight = Math.max(
    1,
    titleWeight + paraWeights.reduce((a, b) => a + b, 0) + recapWeight
  );

  let currentMs = 0;

  // 1. Başlık bölümü
  const titleSpeechMs = Math.round((titleWeight / totalWeight) * availableSpeechMs);
  const titleRange: SegmentRange = {
    startMs: currentMs,
    endMs: currentMs + titleSpeechMs,
  };
  currentMs = titleRange.endMs + scaledTitlePause;

  // 2. Paragraflar
  const paragraphRanges: SegmentRange[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const speechMs = Math.round((paraWeights[i] / totalWeight) * availableSpeechMs);
    const startMs = currentMs;
    const isLast = i === paragraphs.length - 1;
    const pauseAfter = isLast ? (hasRecap ? scaledRecapPause : 0) : scaledParaPause;

    // Paragrafın sonu, peşindeki sessizliği de kapsar ki ses bitmeden UI diğer paragrafa atlamasın
    const endMs = startMs + speechMs + pauseAfter;
    paragraphRanges.push({ startMs, endMs });
    currentMs = endMs;
  }

  // 3. Tekrar / Recap bölümü
  let recapRange: SegmentRange | null = null;
  if (hasRecap) {
    const speechMs = Math.max(1, safeDuration - currentMs);
    recapRange = {
      startMs: currentMs,
      endMs: currentMs + speechMs,
    };
  }

  return { titleRange, paragraphRanges, recapRange };
}

interface TranscriptSheetProps {
  visible: boolean;
  section: SectionSummary | null;
  sectionDetail: SectionDetail | null;
  totalSections: number;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  onTogglePlayPause: () => void;
  onSeekTo?: (positionMs: number) => void;
  onClose: () => void;
}

export function TranscriptSheet({
  visible,
  section,
  sectionDetail,
  totalSections,
  isPlaying,
  positionMs,
  durationMs,
  onTogglePlayPause,
  onSeekTo,
  onClose,
}: TranscriptSheetProps) {
  const [activeTab, setActiveTab] = useState<"fluent" | "source">("fluent");
  const scrollViewRef = useRef<ScrollView | null>(null);
  const paragraphOffsetsRef = useRef<Record<number, number>>({});
  const recapOffsetRef = useRef<number>(0);
  const lastScrolledIndexRef = useRef<number>(-1);
  const { settings } = useUserSettings();
  const reduceMotion = useReduceMotion();
  const reading = readingStyle(settings);

  // Hook'lar her çizimde aynı sırada çağrılsın diye bölüm yokken de
  // hesaplanır; ekran en sonda boş döner.
  const sectionTitle = section?.title ?? "";
  const paragraphs = sectionDetail?.paragraphs ?? [];
  const recap = sectionDetail?.recap;
  const safeDuration = Math.max(1, durationMs);
  const progressRatio = Math.max(0, Math.min(1, positionMs / safeDuration));

  // Metin ağırlıklarına ve duraklamalara dayalı hassas zaman çizgisi
  const timeline = useMemo(() => {
    return computeTranscriptTimeline(
      sectionTitle,
      paragraphs,
      recap,
      safeDuration
    );
  }, [sectionTitle, paragraphs, recap, safeDuration]);

  // Hangi bölümün o an okunduğunu tespit et
  let isReadingTitle = false;
  let isReadingRecap = false;
  let currentParagraphIndex = -1;

  if (timeline.recapRange && positionMs >= timeline.recapRange.startMs) {
    isReadingRecap = true;
    currentParagraphIndex = paragraphs.length;
  } else if (timeline.paragraphRanges.length > 0) {
    if (positionMs < timeline.paragraphRanges[0].startMs) {
      isReadingTitle = true;
      currentParagraphIndex = -1;
    } else {
      for (let i = 0; i < timeline.paragraphRanges.length; i++) {
        const range = timeline.paragraphRanges[i];
        if (positionMs >= range.startMs && positionMs < range.endMs) {
          currentParagraphIndex = i;
          break;
        }
      }
      if (
        currentParagraphIndex === -1 &&
        positionMs >= timeline.paragraphRanges[timeline.paragraphRanges.length - 1].endMs
      ) {
        currentParagraphIndex = timeline.paragraphRanges.length - 1;
      }
    }
  }

  // Aktif paragraf değiştikçe yumuşakça odakla
  useEffect(() => {
    if (activeTab !== "fluent") return;

    if (isReadingRecap && lastScrolledIndexRef.current !== 999) {
      lastScrolledIndexRef.current = 999;
      scrollViewRef.current?.scrollToEnd({ animated: !reduceMotion });
    } else if (
      currentParagraphIndex >= 0 &&
      currentParagraphIndex !== lastScrolledIndexRef.current
    ) {
      lastScrolledIndexRef.current = currentParagraphIndex;
      const y = paragraphOffsetsRef.current[currentParagraphIndex];
      if (typeof y === "number") {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 60),
          animated: !reduceMotion,
        });
      }
    }
  }, [currentParagraphIndex, isReadingRecap, activeTab, reduceMotion]);

  if (!section) return null;

  // Okunan kelime: paragrafın okunan oranına göre tahmin edilir.
  const currentRange =
    currentParagraphIndex >= 0 ? timeline.paragraphRanges[currentParagraphIndex] : undefined;
  const currentWord =
    settings.wordHighlight && currentRange && !isReadingRecap
      ? activeWordIndex(
          splitWords(paragraphs[currentParagraphIndex] ?? ""),
          (positionMs - currentRange.startMs) /
            Math.max(1, currentRange.endMs - currentRange.startMs)
        )
      : -1;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 px-5 pt-4"
        style={{ backgroundColor: reading.colors.background }}
      >
        {/* Üst Bar */}
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            onPress={onClose}
            className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          >
            <ChevronDown size={24} color={reading.colors.ink} strokeWidth={2.2} />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-xs font-semibold"
              style={{ color: reading.colors.muted }}
            >
              Bölüm {section.order} / {totalSections}
            </Text>
            <Text
              numberOfLines={1}
              className="text-base font-bold"
              style={{ color: reading.colors.ink }}
            >
              {section.title}
            </Text>
          </View>
        </View>

        {/* Sekmeler */}
        <View className="mt-3.5 flex-row rounded-[14px] bg-brand-surface p-1">
          <Pressable
            onPress={() => setActiveTab("fluent")}
            className={`flex-1 items-center justify-center rounded-[10px] py-2 ${
              activeTab === "fluent" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                activeTab === "fluent" ? "text-brand-indigo" : "text-brand-ink-soft"
              }`}
            >
              Anlatım
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("source")}
            className={`flex-1 items-center justify-center rounded-[10px] py-2 ${
              activeTab === "source" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                activeTab === "source" ? "text-brand-indigo" : "text-brand-ink-soft"
              }`}
            >
              Orijinal not
            </Text>
          </Pressable>
        </View>

        {/* Metin İçeriği */}
        <ScrollView
          ref={scrollViewRef}
          className="mt-4 flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "fluent" ? (
            <View className="gap-2.5">
              {/* Başlık seslendirilme aşaması */}
              {isReadingTitle ? (
                <View className="mb-1 flex-row items-center gap-2 rounded-xl bg-brand-lavender/60 px-3 py-2">
                  <AudioLines size={16} color="#1928B4" strokeWidth={2.2} />
                  <Text className="text-xs font-semibold text-brand-indigo">
                    Bölüm başlığı seslendiriliyor...
                  </Text>
                </View>
              ) : null}

              {paragraphs.length > 0 ? (
                paragraphs.map((p, i) => {
                  const isCurrent = i === currentParagraphIndex;
                  return (
                    <Pressable
                      key={i}
                      onLayout={(e) => {
                        paragraphOffsetsRef.current[i] = e.nativeEvent.layout.y;
                      }}
                      onPress={() => {
                        const range = timeline.paragraphRanges[i];
                        if (range) onSeekTo?.(range.startMs);
                      }}
                      className={`rounded-[14px] p-3 ${
                        isCurrent ? "border shadow-sm" : "bg-transparent active:opacity-70"
                      }`}
                      style={
                        isCurrent
                          ? {
                              backgroundColor: reading.colors.current,
                              borderColor: reading.colors.border,
                            }
                          : undefined
                      }
                    >
                      {isCurrent ? (
                        <View className="mb-1 flex-row items-center gap-1.5">
                          <AudioLines size={13} color="#1928B4" strokeWidth={2.2} />
                          <Text className="text-[11px] font-bold uppercase tracking-wider text-brand-indigo">
                            {isPlaying ? "Şimdi okunuyor" : "Duraklatıldı"}
                          </Text>
                        </View>
                      ) : null}
                      <Text
                        style={[
                          reading.text,
                          isCurrent ? reading.strong : null,
                          !isCurrent && i < currentParagraphIndex
                            ? { color: reading.colors.muted }
                            : null,
                        ]}
                      >
                        {isCurrent && currentWord >= 0
                          ? splitWords(p).map((word, w) => (
                              <Text
                                key={w}
                                style={
                                  w === currentWord
                                    ? {
                                        backgroundColor: reading.colors.wordBg,
                                        color: reading.colors.wordInk,
                                      }
                                    : undefined
                                }
                              >
                                {word}
                              </Text>
                            ))
                          : p}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-sm text-brand-ink-soft">
                    Bu bölümün metni henüz yükleniyor...
                  </Text>
                </View>
              )}

              {/* Tekrar / Özet Kutusu */}
              {recap ? (
                <Pressable
                  onLayout={(e) => {
                    recapOffsetRef.current = e.nativeEvent.layout.y;
                  }}
                  onPress={() => {
                    if (timeline.recapRange) onSeekTo?.(timeline.recapRange.startMs);
                  }}
                  className={`mt-3 rounded-[18px] p-4 gap-1.5 ${
                    isReadingRecap
                      ? "border-[2px] border-brand-indigo bg-[#EEF0FB] shadow-sm"
                      : "border-[1.5px] border-dashed border-[#C5CCF7] bg-[#F8F9FE] active:opacity-90"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-extrabold uppercase tracking-widest text-brand-indigo">
                      Tekrar
                    </Text>
                    {isReadingRecap ? (
                      <View className="flex-row items-center gap-1">
                        <AudioLines size={12} color="#1928B4" strokeWidth={2.2} />
                        <Text className="text-[11px] font-bold text-brand-indigo">
                          {isPlaying ? "Özet okunuyor" : "Duraklatıldı"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    className={`text-base leading-[24px] ${
                      isReadingRecap ? "font-medium text-brand-ink" : "text-[#2A2F55]"
                    }`}
                  >
                    {recap}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-[13px] leading-5 text-brand-ink-soft">
                PDF'ten çıkarılan ham not. Dinlediğin anlatım bu metinden hazırlandı.
              </Text>
              <View className="rounded-2xl bg-brand-surface p-4">
                {sectionDetail?.sourceText?.trim() ? (
                  <Text selectable className="font-mono text-sm leading-5 text-[#2A2F55]">
                    {sectionDetail.sourceText.trim()}
                  </Text>
                ) : (
                  paragraphs.map((p, i) => (
                    <Text
                      key={i}
                      className="mb-2 font-mono text-sm leading-5 text-[#2A2F55]"
                    >
                      • {p}
                    </Text>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Alt Mini Oynatıcı Çubuğu */}
        <View className="absolute bottom-6 left-5 right-5 flex-row items-center gap-3 rounded-[20px] bg-brand-indigo px-4 py-2.5 shadow-lg shadow-indigo-900/30">
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text
                numberOfLines={1}
                className="flex-1 pr-2 text-[13px] font-semibold text-white"
              >
                {section.title}
              </Text>
              <Text
                style={{ fontVariant: ["tabular-nums"] }}
                className="text-xs font-medium text-[#C9D0FD]"
              >
                {formatClock(positionMs)} / {formatClock(durationMs)}
              </Text>
            </View>
            <View className="h-1 overflow-hidden rounded-full bg-white/25">
              <View
                className="h-full rounded-full bg-white"
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Duraklat" : "Oynat"}
            onPress={onTogglePlayPause}
            className="h-11 w-11 items-center justify-center rounded-full bg-white active:opacity-90"
          >
            {isPlaying ? (
              <Pause size={18} color="#1928B4" fill="#1928B4" />
            ) : (
              <Play size={18} color="#1928B4" fill="#1928B4" className="ml-0.5" />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
