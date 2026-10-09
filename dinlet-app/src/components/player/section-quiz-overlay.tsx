import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  Vibration,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, Brain, Sparkles, Trophy, Volume2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import type { OutroQuizState } from "@/context/player-context";
import { getRandomQuote, MOTIVATIONAL_QUOTES, SUCCESS_QUOTES } from "@/lib/quiz-feedback";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RING_RADIUS = 31;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const targetRatio = total > 0 ? remaining / total : 0;
  const [smoothRatio, setSmoothRatio] = useState(targetRatio);
  const animRatio = useRef(new Animated.Value(targetRatio)).current;
  const animRatioRef = useRef(targetRatio);
  const numberScale = useRef(new Animated.Value(1)).current;

  // animRatio dinleyicisi: 60 FPS pürüzsüz SVG stroke akışı
  useEffect(() => {
    const listenerId = animRatio.addListener(({ value }) => {
      setSmoothRatio(value);
    });
    return () => {
      animRatio.removeListener(listenerId);
    };
  }, [animRatio]);

  // Geri sayım değiştikçe halkayı basamaklı değil, 1 saniye boyunca kesintisiz erit
  useEffect(() => {
    if (targetRatio >= animRatioRef.current) {
      animRatio.setValue(targetRatio);
      animRatioRef.current = targetRatio;
      setSmoothRatio(targetRatio);
    } else {
      Animated.timing(animRatio, {
        toValue: targetRatio,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      animRatioRef.current = targetRatio;
    }
  }, [targetRatio, animRatio]);

  // Her saniye vuruşunda tatlı nabız (pulse) efekti
  useEffect(() => {
    numberScale.setValue(1.15);
    Animated.spring(numberScale, {
      toValue: 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [remaining, numberScale]);

  return (
    <View className="relative h-[72px] w-[72px] items-center justify-center">
      <Svg width={72} height={72} viewBox="0 0 72 72">
        <Circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={7} />
        <Circle
          cx={36}
          cy={36}
          r={RING_RADIUS}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${RING_LENGTH * Math.max(0, Math.min(1, smoothRatio))} ${RING_LENGTH}`}
          transform="rotate(-90 36 36)"
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Animated.Text
          style={{ transform: [{ scale: numberScale }] }}
          className="font-display text-2xl text-white"
        >
          {remaining}
        </Animated.Text>
      </View>
    </View>
  );
}

interface SectionQuizOverlayProps {
  quiz: OutroQuizState;
  onClose: () => void;
  onSkipThinking: () => void;
  onChoose: (known: boolean) => void;
  onComplete: () => void;
}

/**
 * Bölüm sonu sesli soru ekranı (Çalışma araçları / Sesli soru tasarımı).
 * Oynatıcıda soru sesleri çalarken aktif olarak ve yumuşak animasyonlarla görüntülenir.
 */
export function SectionQuizOverlay({
  quiz,
  onClose,
  onSkipThinking,
  onChoose,
  onComplete,
}: SectionQuizOverlayProps) {
  const insets = useSafeAreaInsets();
  const { questionIndex, totalQuestions, question, phase, remainingSeconds, thinkSeconds, summary } = quiz;

  const [feedback, setFeedback] = useState<{
    type: "known" | "missed";
    quote: string;
  } | null>(null);

  // Animasyon Değerleri
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const questionAnim = useRef(new Animated.Value(1)).current;
  const answerAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.7)).current;

  // Ekran ilk açılış animasyonu (yumuşak fade-in)
  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [overlayOpacity]);

  // Soru değiştiğinde yumuşak fade ve yukarı kayma
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    questionAnim.setValue(0);
    Animated.timing(questionAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [questionIndex, questionAnim]);

  // Cevap aşamasına geçildiğinde cevap kartının yumuşak açılması
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (phase === "answer") {
      answerAnim.setValue(0);
      Animated.timing(answerAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [phase, answerAnim]);

  // Bildim/Bilemedim basıldığında geri bildirim kartı animasyonu
  useEffect(() => {
    if (feedback) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      feedbackAnim.setValue(0);
      Animated.spring(feedbackAnim, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [feedback, feedbackAnim]);

  // Özet ekranına geçiş animasyonu
  useEffect(() => {
    if (phase === "summary") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      summaryAnim.setValue(0);
      badgeScale.setValue(0.7);
      Animated.parallel([
        Animated.timing(summaryAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [phase, summaryAnim, badgeScale]);

  function handleChoose(known: boolean) {
    if (feedback) return;
    try {
      if (known) {
        Vibration.vibrate([0, 30, 40, 30]);
      } else {
        Vibration.vibrate(40);
      }
    } catch {
      // yut
    }

    const quote = getRandomQuote(known ? SUCCESS_QUOTES : MOTIVATIONAL_QUOTES);
    setFeedback({ type: known ? "known" : "missed", quote });

    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFeedback(null);
      onChoose(known);
    }, known ? 1000 : 1300);
  }

  function handleSkipFeedback() {
    if (!feedback) return;
    const wasKnown = feedback.type === "known";
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedback(null);
    onChoose(wasKnown);
  }

  // --- ÖZET EKRANI GÖRÜNÜMÜ ---
  if (phase === "summary" && summary) {
    const total = summary.total || 1;
    const known = summary.known;
    const missed = summary.missed;
    const percent = Math.round((known / total) * 100);

    const isPerfect = known === total;
    const isGood = percent >= 50;

    return (
      <Animated.View
        className="absolute inset-0 z-50 flex-1 bg-brand-indigo px-6"
        style={{
          opacity: overlayOpacity,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 8, 34),
        }}
      >
        <StatusBar style="light" />

        {/* Üst Bar */}
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={8}
            onPress={onClose}
            className="-ml-2.5 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          >
            <X size={24} strokeWidth={2} color="#FFFFFF" />
          </Pressable>
          <Text numberOfLines={1} className="mx-2 flex-1 text-center text-[13px] font-bold text-[#C9D0FD]">
            Bölüm Özeti
          </Text>
          <View className="w-11" />
        </View>

        {/* Ana Özet İçeriği (Yumuşak giriş) */}
        <Animated.View
          style={{
            opacity: summaryAnim,
            transform: [
              {
                translateY: summaryAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          }}
          className="flex-1 items-center justify-center gap-6"
        >
          {/* Rozet İkonu */}
          <Animated.View
            style={{
              transform: [{ scale: badgeScale }],
            }}
            className={`h-24 w-24 items-center justify-center rounded-full ${
              isPerfect
                ? "bg-amber-400/20"
                : isGood
                  ? "bg-emerald-400/20"
                  : "bg-white/10"
            }`}
          >
            {isPerfect ? (
              <Trophy size={48} color="#FBBF24" strokeWidth={2} />
            ) : isGood ? (
              <Sparkles size={46} color="#34D399" strokeWidth={2} />
            ) : (
              <Brain size={46} color="#C9D0FD" strokeWidth={2} />
            )}
          </Animated.View>

          {/* Başlık ve Bölüm Adı */}
          <View className="items-center gap-2">
            <Text className="text-center font-display text-[30px] leading-[36px] tracking-[-0.9px] text-white">
              {isPerfect
                ? "Kusursuz Hatırlama! 🎉"
                : isGood
                  ? "Tebrikler, Çok İyi! 👏"
                  : "Harika Bir Pratik! 💡"}
            </Text>
            <Text className="text-center text-sm font-medium text-[#C9D0FD]">
              {quiz.documentTitle} · {quiz.sectionTitle}
            </Text>
          </View>

          {/* İstatistik Kartı */}
          <View className="w-full rounded-3xl bg-white/10 p-5 backdrop-blur-md">
            {/* Yüzde Barı */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-mist">
                Başarı Oranı
              </Text>
              <View className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-sm font-extrabold text-white">%{percent}</Text>
              </View>
            </View>

            {/* İlerleme Çubuğu */}
            <View className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <View
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${percent}%` }}
              />
            </View>

            {/* 3 Sütun Stat */}
            <View className="flex-row items-center justify-around border-t border-white/10 pt-4">
              <View className="items-center">
                <Text className="text-xs font-medium text-brand-mist">Toplam</Text>
                <Text className="mt-1 font-display text-xl text-white">{total}</Text>
              </View>
              <View className="h-8 w-[1px] bg-white/10" />
              <View className="items-center">
                <Text className="text-xs font-medium text-emerald-300">Bildim</Text>
                <Text className="mt-1 font-display text-xl text-emerald-400">{known}</Text>
              </View>
              <View className="h-8 w-[1px] bg-white/10" />
              <View className="items-center">
                <Text className="text-xs font-medium text-rose-300">Bilemedim</Text>
                <Text className="mt-1 font-display text-xl text-rose-400">{missed}</Text>
              </View>
            </View>
          </View>

          {/* Değerlendirme Mesajı */}
          <Text className="px-3 text-center text-sm leading-5 text-brand-mist">
            {isPerfect
              ? "Tüm soruları doğru hatırladın. Bu bölümün kilit noktaları zihninde sağlam bir yer edindi!"
              : isGood
                ? "Soruların çoğunu bildin! Hatırlayamadıkların ise aralıklı tekrarlar sayesinde kalıcılaşacak."
                : "Aktif hatırlama sürecinin en kıymetli anı eksikleri görmektir. Tekrarlar sayesinde pekişecek!"}
          </Text>
        </Animated.View>

        {/* Devam Et Butonu */}
        <Pressable
          accessibilityRole="button"
          onPress={onComplete}
          className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-white shadow-lg active:opacity-90"
        >
          <Text className="text-base font-bold text-brand-indigo">Devam Et</Text>
          <ArrowRight size={20} color="#1928B4" strokeWidth={2.2} />
        </Pressable>
      </Animated.View>
    );
  }

  // --- SORU / DÜŞÜNME / CEVAP EKRANI GÖRÜNÜMÜ ---
  const headerTitle = `${quiz.sectionTitle} · Soru ${questionIndex + 1}/${totalQuestions}`;

  return (
    <Animated.View
      className="absolute inset-0 z-50 flex-1 bg-brand-indigo px-6"
      style={{
        opacity: overlayOpacity,
        paddingTop: Math.max(insets.top + 8, 56),
        paddingBottom: Math.max(insets.bottom + 8, 34),
      }}
    >
      <StatusBar style="light" />

      {/* Üst Bar */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          hitSlop={8}
          onPress={onClose}
          className="-ml-2.5 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
        >
          <X size={24} strokeWidth={2} color="#FFFFFF" />
        </Pressable>
        <Text numberOfLines={1} className="mx-2 flex-1 text-center text-[13px] font-bold text-[#C9D0FD]">
          {headerTitle}
        </Text>
        <View className="w-11" />
      </View>

      {/* Soru Segment Çubuğu */}
      <View className="mt-2.5 flex-row gap-1.5">
        {Array.from({ length: totalQuestions }).map((_, index) => (
          <View
            key={index}
            className="h-1 flex-1 rounded-sm"
            style={{
              backgroundColor:
                index < questionIndex || (index === questionIndex && phase === "answer")
                  ? "#FFFFFF"
                  : index === questionIndex
                    ? "#96A6F9"
                    : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </View>

      {/* Ana Soru Alanı (Yumuşak geçişli) */}
      <Animated.View
        style={{
          opacity: questionAnim,
          transform: [
            {
              translateY: questionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        }}
        className="flex-1 justify-center gap-[22px]"
      >
        {/* Aşama Etiketi */}
        <View className="flex-row items-center gap-2">
          <Volume2 size={18} strokeWidth={2} color="#C9D0FD" />
          <Text className="text-[13px] font-bold text-[#C9D0FD]">
            {phase === "question"
              ? "Sesli okunuyor"
              : phase === "thinking"
                ? "Düşünme zamanı"
                : "Cevap okunuyor"}
          </Text>
        </View>

        {/* Soru Metni */}
        <Text
          accessibilityRole="header"
          className="font-display text-[30px] leading-[36px] tracking-[-0.9px] text-white"
        >
          {question.question}
        </Text>

        {/* Düşünme Sayacı */}
        {phase === "thinking" ? (
          <View className="flex-row items-center gap-4">
            <CountdownRing remaining={remainingSeconds} total={thinkSeconds} />
            <Text className="flex-1 text-[15px] leading-[22px] text-brand-mist">
              Cevabı içinden söyle. Birazdan doğru cevap okunacak.
            </Text>
          </View>
        ) : null}

        {/* Cevap Kartı (Yumuşak açılış) */}
        {phase === "answer" ? (
          <Animated.View
            style={{
              opacity: answerAnim,
              transform: [
                {
                  translateY: answerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
            className="gap-1.5 rounded-[20px] bg-white p-[18px]"
          >
            <Text className="text-xs font-bold uppercase tracking-[0.96px] text-brand-indigo">
              Cevap
            </Text>
            <Text className="font-display text-[22px] leading-[26px] tracking-[-0.44px] text-brand-ink">
              {question.answer}
            </Text>
            {question.detail ? (
              <Text className="text-sm leading-5 text-brand-ink-soft">{question.detail}</Text>
            ) : null}
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Alt Butonlar & Geri Bildirim Alanı */}
      {feedback ? (
        <Animated.View
          style={{
            opacity: feedbackAnim,
            transform: [
              {
                scale: feedbackAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              },
            ],
          }}
        >
          <Pressable
            onPress={handleSkipFeedback}
            className={`overflow-hidden rounded-3xl p-5 active:opacity-90 ${
              feedback.type === "known"
                ? "border border-emerald-400/40 bg-emerald-500/25"
                : "border border-amber-400/40 bg-amber-500/20"
            }`}
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl">
                {feedback.type === "known" ? "😊" : "🥺"}
              </Text>
              <View className="flex-1">
                <Text className="font-display text-lg text-white">
                  {feedback.type === "known" ? "Harika Bildin! ✨" : "Sorun Değil!"}
                </Text>
                <Text className="mt-0.5 text-xs font-medium text-white/90">
                  {feedback.quote}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      ) : phase === "question" || phase === "thinking" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSkipThinking}
          className="h-14 items-center justify-center rounded-2xl border-[1.5px] border-white/40 active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Cevabı hemen göster</Text>
        </Pressable>
      ) : (
        <View>
          <View className="flex-row gap-2.5">
            <Pressable
              accessibilityRole="button"
              onPress={() => handleChoose(false)}
              className="h-14 flex-1 items-center justify-center rounded-2xl bg-white/12 active:opacity-80"
            >
              <Text className="text-base font-bold text-white">Bilemedim</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleChoose(true)}
              className="h-14 flex-1 items-center justify-center rounded-2xl bg-white active:opacity-90"
            >
              <Text className="text-base font-bold text-brand-indigo">Bildim</Text>
            </Pressable>
          </View>
          <Text className="mt-3 text-center text-xs text-[#C9D0FD]">
            {questionIndex + 1 < totalQuestions ? "Bir sonraki soruya geçilir." : "Sorular tamamlanır."}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
