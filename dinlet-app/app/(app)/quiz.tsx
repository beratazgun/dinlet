import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Brain, CircleCheck, Sparkles, Trophy, Volume2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { usePlayer } from "@/context/player-context";
import { useClipPlayer } from "@/hooks/use-clip-player";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { getRandomQuote, MOTIVATIONAL_QUOTES, SUCCESS_QUOTES } from "@/lib/quiz-feedback";
import type { GetReviewSessionApiResponse } from "@/networks/api/review/review";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Session = NonNullable<GetReviewSessionApiResponse["Data"]>;
type Phase = "recap" | "question" | "thinking" | "answer" | "saving" | "done";

const RING_RADIUS = 31;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function CountdownRing({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
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
        <Circle
          cx={36}
          cy={36}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={7}
        />
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

/**
 * Sesli soru (aktif hatırlama): bölümün tekrar özeti çalar, sonra her soru
 * okunur, öğrenci cevabı içinden söyler, doğru cevap okunur ve "Bildim /
 * Bilemedim" ile işaretler. Bölüm bitince sonuç gönderilir.
 */
export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const clips = useClipPlayer();
  const params = useLocalSearchParams<{
    sectionId?: string;
    documentId?: string;
  }>();
  const isSectionMode = !!params.sectionId;
  const sectionIdNum = Number(params.sectionId ?? 0);

  const sectionQuery = useCraftQuery(
    "sections",
    "getSection",
    [{ id: sectionIdNum }],
    { enabled: isSectionMode && sectionIdNum > 0 },
  );
  const session = useCraftQuery("review", "getReviewSession", [], {
    staleTime: 0,
    enabled: !isSectionMode,
  });
  const submitReview = useCraftMutation("review", "submitReview");

  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("recap");
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "known" | "missed";
    quote: string;
  } | null>(null);
  const answersRef = useRef<{ questionId: number; known: boolean }[]>([]);
  const tallyRef = useRef({ known: 0, missed: 0 });
  // Her adım bir "koşu" numarası alır; atlanan adımın geç biten sesi yok sayılır.
  const runRef = useRef(0);

  // Animasyon Değerleri
  const questionAnim = useRef(new Animated.Value(1)).current;
  const answerAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.7)).current;

  // Soru değiştiğinde yumuşak geçiş
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    questionAnim.setValue(0);
    Animated.timing(questionAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [questionIndex, sectionIndex, questionAnim]);

  // Cevap aşaması açılış animasyonu
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

  // Geri bildirim animasyonu
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

  // Özet / Tamamlandı animasyonu
  useEffect(() => {
    if (phase === "done") {
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

  const sectionDetail = sectionQuery.data?.data;
  const sectionFromParam: Session["sections"][number] | undefined =
    sectionDetail
      ? {
          sectionId: sectionDetail.id,
          sectionOrder: sectionDetail.order,
          sectionTitle: sectionDetail.title,
          documentId: Number(params.documentId ?? 0),
          documentTitle: sectionDetail.title,
          stage: 1,
          stageLabel: "Bölüm",
          recapAudioUrl: null,
          recapDurationMs: null,
          questions: (sectionDetail.questions ?? []).map((q) => ({
            id: q.id,
            order: q.order,
            question: q.question,
            answer: q.answer,
            detail: q.detail,
            questionAudioUrl: q.questionAudioUrl,
            questionDurationMs: q.questionDurationMs,
            answerAudioUrl: q.answerAudioUrl,
            answerDurationMs: q.answerDurationMs,
          })),
        }
      : undefined;

  const sections = isSectionMode
    ? sectionFromParam
      ? [sectionFromParam]
      : []
    : (session.data?.data?.sections ?? []);

  const section = sections[sectionIndex];
  const question = section?.questions[questionIndex];
  const thinkSeconds = Math.round(
    (session.data?.data?.thinkMs ?? 5_000) / 1000,
  );

  // Tekrar başlarken açık dinleme durur.
  useEffect(() => {
    void player.pause();
    // Yalnızca açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sesler: özet → soru → (düşünme) → cevap.
  useEffect(() => {
    if (!section) return;
    const run = ++runRef.current;
    const current = () => run === runRef.current;

    if (phase === "recap") {
      if (!section.recapAudioUrl) {
        setPhase("question");
        return;
      }
      void clips.play(section.recapAudioUrl).then((finished) => {
        if (finished && current()) setPhase("question");
      });
    } else if (phase === "question" && question) {
      void clips.play(question.questionAudioUrl).then((finished) => {
        if (finished && current()) {
          setRemaining(thinkSeconds);
          setPhase("thinking");
        }
      });
    } else if (phase === "answer" && question) {
      void clips.play(question.answerAudioUrl);
    }
    // `clips` kararlı; diğerleri adımı belirler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sectionIndex, questionIndex, section?.sectionId]);

  // Düşünme geri sayımı.
  useEffect(() => {
    if (phase !== "thinking") return;
    if (remaining <= 0) {
      setPhase("answer");
      return;
    }
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, remaining]);

  const isPending = isSectionMode ? sectionQuery.isPending : session.isPending;
  const isError = isSectionMode ? sectionQuery.isError : session.isError;
  const queryError = isSectionMode ? sectionQuery.error : session.error;

  function skipTo(next: Phase) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    runRef.current += 1;
    clips.stop();
    setPhase(next);
  }

  async function choose(known: boolean) {
    if (!section || !question) return;
    clips.stop();
    answersRef.current.push({ questionId: question.id, known });
    tallyRef.current[known ? "known" : "missed"] += 1;

    if (questionIndex + 1 < section.questions.length) {
      setQuestionIndex(questionIndex + 1);
      setPhase("question");
      return;
    }

    if (isSectionMode) {
      setPhase("done");
      return;
    }

    setPhase("saving");
    try {
      await submitReview.mutateAsync({
        params: { sectionId: section.sectionId },
        body: { answers: answersRef.current },
      });
      answersRef.current = [];
      if (sectionIndex + 1 < sections.length) {
        setSectionIndex(sectionIndex + 1);
        setQuestionIndex(0);
        setPhase("recap");
      } else {
        setPhase("done");
        void queryClient.invalidateQueries({ queryKey: ["me", "review"] });
      }
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
      setPhase("answer");
    }
  }

  function handleChoose(known: boolean) {
    if (feedback || phase === "saving") return;
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
      void choose(known);
    }, known ? 1000 : 1300);
  }

  function handleSkipFeedback() {
    if (!feedback) return;
    const wasKnown = feedback.type === "known";
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedback(null);
    void choose(wasKnown);
  }

  function close() {
    runRef.current += 1;
    clips.stop();
    void queryClient.invalidateQueries({ queryKey: ["me", "review"] });
    router.back();
  }

  const header = section
    ? phase === "recap"
      ? `${section.sectionTitle} · Özet`
      : `${section.sectionTitle} · Soru ${questionIndex + 1}/${section.questions.length}`
    : "Tekrar";

  return (
    <View
      className="flex-1 bg-brand-indigo px-6"
      style={{
        paddingTop: Math.max(insets.top + 8, 56),
        paddingBottom: Math.max(insets.bottom + 8, 34),
      }}
    >
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          hitSlop={8}
          onPress={close}
          className="-ml-2.5 h-11 w-11 items-center justify-center"
        >
          <X size={24} strokeWidth={2} color="#FFFFFF" />
        </Pressable>
        <Text
          numberOfLines={1}
          className="mx-2 flex-1 text-center text-[13px] font-bold text-[#C9D0FD]"
        >
          {header}
        </Text>
        <View className="w-11" />
      </View>

      {section ? (
        <View className="mt-2.5 flex-row gap-1.5">
          {section.questions.map((item, index) => (
            <View
              key={item.id}
              className="h-1 flex-1 rounded-sm"
              style={{
                backgroundColor:
                  index < questionIndex ||
                  (index === questionIndex && phase === "answer")
                    ? "#FFFFFF"
                    : index === questionIndex && phase !== "recap"
                      ? "#96A6F9"
                      : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </View>
      ) : null}

      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center">
          <Text className="text-center text-base text-brand-mist">
            {getApiErrorMessage(queryError)}
          </Text>
        </View>
      ) : sections.length === 0 || phase === "done" ? (
        (() => {
          const total = tallyRef.current.known + tallyRef.current.missed;
          const known = tallyRef.current.known;
          const missed = tallyRef.current.missed;
          const percent = total > 0 ? Math.round((known / total) * 100) : 100;
          const isPerfect = total > 0 && known === total;
          const isGood = percent >= 50;

          return (
            <>
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

                <View className="items-center gap-2">
                  <Text className="text-center font-display text-[30px] leading-[36px] tracking-[-0.9px] text-white">
                    {isSectionMode
                      ? phase === "done"
                        ? isPerfect
                          ? "Kusursuz Hatırlama! 🎉"
                          : isGood
                            ? "Tebrikler, Çok İyi! 👏"
                            : "Harika Bir Pratik! 💡"
                        : "Bu bölümde soru yok"
                      : sections.length === 0
                        ? "Bugün tekrar yok"
                        : isPerfect
                          ? "Bugünkü Tekrar Kusursuz! 🏆"
                          : "Bugünkü Tekrar Bitti! 🎉"}
                  </Text>
                  <Text className="text-center text-sm font-medium text-[#C9D0FD]">
                    {isSectionMode
                      ? section?.sectionTitle ?? "Bölüm Soruları"
                      : total > 0
                        ? `${total} soru tamamlandı`
                        : "Aktif soru bulunamadı"}
                  </Text>
                </View>

                {total > 0 ? (
                  <View className="w-full rounded-3xl bg-white/10 p-5">
                    <View className="mb-4 flex-row items-center justify-between">
                      <Text className="text-xs font-bold uppercase tracking-wider text-brand-mist">
                        Başarı Oranı
                      </Text>
                      <View className="rounded-full bg-white/20 px-3 py-1">
                        <Text className="text-sm font-extrabold text-white">%{percent}</Text>
                      </View>
                    </View>

                    <View className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <View
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${percent}%` }}
                      />
                    </View>

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
                ) : (
                  <Text className="text-center text-[15px] leading-[22px] text-brand-mist">
                    {isSectionMode
                      ? "Bu bölüm için henüz soru üretilmemiş."
                      : "Bitirdiğin bölümler 1, 3, 7 ve 21 gün sonra burada sorularıyla belirir."}
                  </Text>
                )}

                {total > 0 ? (
                  <Text className="px-3 text-center text-sm leading-5 text-brand-mist">
                    {isPerfect
                      ? "Tüm soruları doğru hatırladın. Bilgiler hafızanda sağlam bir şekilde yer edindi!"
                      : isGood
                        ? "Soruların çoğunu bildin! Hatırlayamadıkların ise aralıklı tekrarlar sayesinde kalıcılaşacak."
                        : "Aktif hatırlama sürecinin en kıymetli anı eksikleri görmektir. Tekrarlar sayesinde pekişecek!"}
                  </Text>
                ) : null}
              </Animated.View>

              <Pressable
                accessibilityRole="button"
                onPress={close}
                className="h-14 items-center justify-center rounded-2xl bg-white active:opacity-90"
              >
                <Text className="text-[17px] font-bold text-brand-indigo">
                  Tamamla
                </Text>
              </Pressable>
            </>
          );
        })()
      ) : (
        <>
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
            <View className="flex-row items-center gap-2">
              <Volume2 size={18} strokeWidth={2} color="#C9D0FD" />
              <Text className="text-[13px] font-bold text-[#C9D0FD]">
                {phase === "recap"
                  ? "Tekrar özeti okunuyor"
                  : phase === "thinking"
                    ? "Düşünme zamanı"
                    : "Sesli okunuyor"}
              </Text>
            </View>

            {phase === "recap" ? (
              <View className="gap-2">
                <Text className="font-display text-[32px] leading-[37px] tracking-[-0.96px] text-white">
                  {section!.sectionTitle}
                </Text>
                <Text className="text-[15px] text-brand-mist">
                  {section!.documentTitle} · {section!.stageLabel} tekrarı
                </Text>
              </View>
            ) : (
              <Text
                accessibilityRole="header"
                className="font-display text-[32px] leading-[37px] tracking-[-0.96px] text-white"
              >
                {question?.question}
              </Text>
            )}

            {phase === "thinking" ? (
              <View className="flex-row items-center gap-4">
                <CountdownRing remaining={remaining} total={thinkSeconds} />
                <Text className="flex-1 text-[15px] leading-[22px] text-brand-mist">
                  Cevabı içinden söyle. Birazdan doğru cevap okunacak.
                </Text>
              </View>
            ) : null}

            {phase === "answer" || phase === "saving" ? (
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
                  {question?.answer}
                </Text>
                {question?.detail ? (
                  <Text className="text-sm leading-5 text-brand-ink-soft">
                    {question.detail}
                  </Text>
                ) : null}
              </Animated.View>
            ) : null}
            {error ? (
              <Text className="text-sm text-[#FFD1D8]">{error}</Text>
            ) : null}
          </Animated.View>

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
          ) : phase === "recap" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => skipTo("question")}
              className="h-14 items-center justify-center rounded-2xl border-[1.5px] border-white/40"
            >
              <Text className="text-base font-bold text-white">Özeti atla</Text>
            </Pressable>
          ) : phase === "question" || phase === "thinking" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => skipTo("answer")}
              className="h-14 items-center justify-center rounded-2xl border-[1.5px] border-white/40"
            >
              <Text className="text-base font-bold text-white">
                Cevabı hemen göster
              </Text>
            </Pressable>
          ) : (
            <View>
              <View className="flex-row gap-2.5">
                <Pressable
                  accessibilityRole="button"
                  disabled={phase === "saving"}
                  onPress={() => handleChoose(false)}
                  className="h-14 flex-1 items-center justify-center rounded-2xl bg-white/12 active:opacity-80"
                >
                  <Text className="text-base font-bold text-white">
                    Bilemedim
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={phase === "saving"}
                  onPress={() => handleChoose(true)}
                  className="h-14 flex-1 items-center justify-center rounded-2xl bg-white active:opacity-90"
                >
                  {phase === "saving" ? (
                    <ActivityIndicator color="#1928B4" />
                  ) : (
                    <Text className="text-base font-bold text-brand-indigo">
                      Bildim
                    </Text>
                  )}
                </Pressable>
              </View>
              <Text className="mt-3 text-center text-xs text-[#C9D0FD]">
                “Bilemedim” dersen bu bölüm yarın tekrar gelir.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
