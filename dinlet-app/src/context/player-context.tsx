import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { resolveAudioUrl } from "@/lib/audio-url";
import { getUserSettings } from "@/lib/settings-storage";
import { useDownloads } from "./downloads-context";
import { getSectionApi, saveProgressApi } from "@/networks/api/sections/sections";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";
import type { GetSectionApiResponse } from "@/networks/api/sections/sections";

export type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;
export type SectionSummary = DocumentDetail["sections"][number];
export type SectionDetail = NonNullable<GetSectionApiResponse["Data"]>;

export type SleepTimerOption =
  | "off"
  | "15m"
  | "30m"
  | "45m"
  | "60m"
  | "end_of_section";

export const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
export type SpeedOption = (typeof SPEED_OPTIONS)[number];

export interface PlayerContextValue {
  currentDocument: DocumentDetail | null;
  sections: SectionSummary[];
  currentSectionIndex: number;
  currentSection: SectionSummary | null;
  currentSectionDetail: SectionDetail | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number;
  speed: SpeedOption;
  sleepTimerOption: SleepTimerOption;
  sleepTimerRemainingSec: number | null;
  errorMessage: string | null;
  hasNextSection: boolean;
  hasPrevSection: boolean;

  playDocumentSection: (
    doc: DocumentDetail,
    sectionIndex: number,
    startPositionMs?: number
  ) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
  nextSection: () => Promise<void>;
  previousSection: () => Promise<void>;
  cycleSpeed: () => Promise<void>;
  setSpeed: (speed: SpeedOption) => Promise<void>;
  setSleepTimer: (option: SleepTimerOption) => void;
  /** Bölüm sonu okunuyorsa ("Hafıza kancası", "Soru 2/3") etiketi. */
  outroLabel: string | null;
  /** Bölüm sonu aktif soru ekranı durumu. */
  activeOutroQuiz: OutroQuizState | null;
  /** Soru düşünme süresini atlayıp cevaba geç. */
  skipOutroThinking: () => void;
  /** Sıradaki soruya geç (Bildim / Bilemedim). */
  nextOutroQuestion: (known?: boolean) => void;
  /** Bölüm sonu soru özetini tamamlayıp ilerle. */
  completeOutroSummary: () => void;
  /** Bölüm sonu outro ve soruları kapat / atla. */
  dismissOutro: () => void;
  /** Oturumu kapatıp oynatıcıyı sıfırla. */
  closeSession: () => Promise<void>;
  /** Çalan ses hızlı tekrar sürümü mü? */
  isQuickAudio: boolean;
  /** Bölüm kullanıcının kendi sesiyle çalıyor ("Senin sesinle"). */
  isOwnVoice: boolean;
}

export interface OutroQuizQuestion {
  id: number;
  question: string;
  answer: string;
  detail: string;
}

export interface OutroQuizSummary {
  known: number;
  missed: number;
  total: number;
}

export interface OutroQuizState {
  sectionTitle: string;
  documentTitle: string;
  totalQuestions: number;
  questionIndex: number;
  question: OutroQuizQuestion;
  phase: "question" | "thinking" | "answer" | "summary";
  remainingSeconds: number;
  thinkSeconds: number;
  summary?: OutroQuizSummary;
}

/** Bölüm sonu sorusunda düşünme süresi. */
const OUTRO_THINK_MS = 5_000;

const PlayerContext = createContext<PlayerContextValue | null>(null);

const SLEEP_TIMER_SECONDS: Record<Exclude<SleepTimerOption, "off" | "end_of_section">, number> = {
  "15m": 15 * 60,
  "30m": 30 * 60,
  "45m": 45 * 60,
  "60m": 60 * 60,
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const downloads = useDownloads();
  const [currentDocument, setCurrentDocument] = useState<DocumentDetail | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentSectionDetail, setCurrentSectionDetail] = useState<SectionDetail | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [speed, setSpeedState] = useState<SpeedOption>(1);
  const [sleepTimerOption, setSleepTimerOption] = useState<SleepTimerOption>("off");
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outroLabel, setOutroLabel] = useState<string | null>(null);
  const [activeOutroQuiz, setActiveOutroQuiz] = useState<OutroQuizState | null>(null);
  const [isQuickAudio, setIsQuickAudio] = useState(false);
  /** Bölüm kullanıcının kendi sesiyle kaydından çalıyor. */
  const [isOwnVoice, setIsOwnVoice] = useState(false);

  const skipThinkingRef = useRef(false);
  const nextQuestionRef = useRef(false);
  const outroTallyRef = useRef({ known: 0, missed: 0 });
  const summaryDoneRef = useRef(false);

  // Bölüm sonu (kancalar + sorular) için ayrı oynatıcı ve iptal numarası.
  const outroPlayerRef = useRef<AudioPlayer | null>(null);
  const outroRunRef = useRef(0);
  /** Bölüm sonu sırası çalışıyor mu (klip ya da düşünme aralığı). */
  const outroActiveRef = useRef(false);
  /** Bölüm sonu kullanıcı tarafından duraklatıldı mı. */
  const outroPausedRef = useRef(false);
  /**
   * Ana ses bitti (ya da özet atlanarak bitmiş sayıldı) ve sıradaki bölüme
   * geçilmedi. Bu durumda "oynat" bölümü baştan, temiz biçimde başlatır.
   */
  const sectionEndedRef = useRef(false);
  const currentSectionDetailRef = useRef<SectionDetail | null>(null);
  currentSectionDetailRef.current = currentSectionDetail;
  const isQuickAudioRef = useRef(false);
  const isOwnVoiceRef = useRef(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  // Güncel değerleri closure sızıntısı olmadan tutan referanslar
  const currentDocumentRef = useRef<DocumentDetail | null>(null);
  currentDocumentRef.current = currentDocument;

  const currentSectionIndexRef = useRef<number>(0);
  currentSectionIndexRef.current = currentSectionIndex;

  const sleepTimerOptionRef = useRef<SleepTimerOption>("off");
  sleepTimerOptionRef.current = sleepTimerOption;

  const speedRef = useRef<SpeedOption>(speed);
  speedRef.current = speed;

  const positionMsRef = useRef(positionMs);
  positionMsRef.current = positionMs;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const durationMsRef = useRef(durationMs);
  durationMsRef.current = durationMs;

  const lastSavedPositionRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);

  // Bölümler arası otomatik geçiş bayrağı (çift tetiklenmeyi önler)
  const isAdvancingRef = useRef<boolean>(false);

  const sections = currentDocument?.sections ?? [];
  const currentSection = sections[currentSectionIndex] ?? null;
  const hasNextSection = currentSectionIndex < sections.length - 1;
  const hasPrevSection = currentSectionIndex > 0;

  // Ses oturumu ayarları
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch((err) => {
      console.warn("[PlayerContext] setAudioModeAsync error:", err);
    });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.release();
        playerRef.current = null;
      }
    };
  }, []);

  // İlerleme kaydetme yardımcısı
  const persistProgress = useCallback(
    async (secId: number, pos: number, completed = false) => {
      try {
        await saveProgressApi({ id: secId }, { positionMs: Math.round(pos), completed });
        lastSavedPositionRef.current = pos;
        lastSaveTimeRef.current = Date.now();
      } catch (err) {
        console.warn("[PlayerContext] saveProgress error:", err);
      }
    },
    []
  );

  // Uyku zamanlayıcısı geri sayımı
  useEffect(() => {
    if (sleepTimerOption === "off" || sleepTimerOption === "end_of_section") {
      setSleepTimerRemainingSec(null);
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerRemainingSec((prev) => {
        if (prev === null || prev <= 1) {
          if (playerRef.current) {
            playerRef.current.pause();
          }
          if (outroActiveRef.current) {
            outroPausedRef.current = true;
            outroPlayerRef.current?.pause();
          }
          setIsPlaying(false);
          setSleepTimerOption("off");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerOption]);

  const setSleepTimer = useCallback((option: SleepTimerOption) => {
    setSleepTimerOption(option);
    if (option === "off" || option === "end_of_section") {
      setSleepTimerRemainingSec(null);
    } else {
      setSleepTimerRemainingSec(SLEEP_TIMER_SECONDS[option]);
    }
  }, []);

  /** Çalan bölüm sonunu keser (yeni bölüm, geri sarma). */
  const stopOutro = useCallback(() => {
    outroRunRef.current += 1;
    outroActiveRef.current = false;
    outroPausedRef.current = false;
    const outroPlayer = outroPlayerRef.current;
    outroPlayerRef.current = null;
    if (outroPlayer) {
      try {
        outroPlayer.pause();
        outroPlayer.remove();
      } catch {
        // yut
      }
    }
    setOutroLabel(null);
    setActiveOutroQuiz(null);
  }, []);

  /** Bölüm sonunu kesmeden duraklatır / sürdürür. */
  const setOutroPaused = useCallback((paused: boolean) => {
    outroPausedRef.current = paused;
    const clip = outroPlayerRef.current;
    if (clip) {
      try {
        if (paused) clip.pause();
        else clip.play();
      } catch {
        // yut
      }
    }
    setIsPlaying(!paused);
  }, []);

  const skipOutroThinking = useCallback(() => {
    skipThinkingRef.current = true;
    const clip = outroPlayerRef.current;
    try {
      clip?.pause();
    } catch {
      // yut
    }
  }, []);

  const nextOutroQuestion = useCallback((known?: boolean) => {
    if (known !== undefined) {
      if (known) outroTallyRef.current.known += 1;
      else outroTallyRef.current.missed += 1;
    }
    nextQuestionRef.current = true;
    const clip = outroPlayerRef.current;
    try {
      clip?.pause();
    } catch {
      // yut
    }
  }, []);

  const completeOutroSummary = useCallback(() => {
    summaryDoneRef.current = true;
  }, []);

  const dismissOutro = useCallback(() => {
    summaryDoneRef.current = true;
    stopOutro();
  }, [stopOutro]);

  /**
   * Bölüm sonu: saklanan hafıza kancaları, ardından (ayar açıksa) sorular —
   * soru, düşünme aralığı, cevap. Kesilirse `false` döner.
   */
  const playOutro = useCallback(
    async (detail: SectionDetail | null): Promise<boolean> => {
      const settings = getUserSettings();
      const run = ++outroRunRef.current;
      outroActiveRef.current = true;
      outroPausedRef.current = false;
      setActiveOutroQuiz(null);

      const releaseClip = () => {
        const clip = outroPlayerRef.current;
        outroPlayerRef.current = null;
        try {
          clip?.remove();
        } catch {
          // yut
        }
      };

      const playClip = async (url: string, abortSignal?: () => boolean): Promise<boolean> => {
        const uri = resolveAudioUrl(url);
        if (!uri) return true;
        return new Promise<boolean>((resolve) => {
          const clip = createAudioPlayer({ uri }, { updateInterval: 250 });
          outroPlayerRef.current = clip;
          // Anlatım hızı ne olursa olsun (ör. 2x), sorular ve cevaplar her zaman 1x (normal hızda) çalınır.
          clip.setPlaybackRate(1);
          let settled = false;
          const settle = (value: boolean) => {
            if (settled) return;
            settled = true;
            clearInterval(guard);
            subscription.remove();
            resolve(value);
          };
          const subscription = clip.addListener("playbackStatusUpdate", (clipStatus: AudioStatus) => {
            if (clipStatus.didJustFinish) settle(true);
          });
          const guard = setInterval(() => {
            if (run !== outroRunRef.current || (abortSignal && abortSignal())) settle(false);
          }, 200);
          if (!outroPausedRef.current) clip.play();
        });
      };

      // Bölüm sonu soruları (aktif hatırlama ekranıyla birlikte)
      if (settings.quizAtSectionEnd && detail?.questions && detail.questions.length > 0) {
        const questions = detail.questions;
        const totalQ = questions.length;
        const thinkSec = Math.round(OUTRO_THINK_MS / 1000);
        outroTallyRef.current = { known: 0, missed: 0 };
        summaryDoneRef.current = false;

        for (let qIdx = 0; qIdx < totalQ; qIdx++) {
          if (run !== outroRunRef.current) return false;
          const q = questions[qIdx];
          skipThinkingRef.current = false;
          nextQuestionRef.current = false;

          // 2.1 Soru okunuyor
          setActiveOutroQuiz({
            sectionTitle: detail.title ?? "Bölüm",
            documentTitle: currentDocumentRef.current?.title ?? "Not",
            totalQuestions: totalQ,
            questionIndex: qIdx,
            question: q,
            phase: "question",
            remainingSeconds: thinkSec,
            thinkSeconds: thinkSec,
          });
          setOutroLabel(`Soru ${qIdx + 1}/${totalQ}`);

          if (q.questionAudioUrl) {
            await playClip(q.questionAudioUrl, () => skipThinkingRef.current);
            releaseClip();
            if (run !== outroRunRef.current) return false;
          }

          // 2.2 Düşünme aralığı (sayaç halkası geri sayar)
          setActiveOutroQuiz((prev) => (prev ? { ...prev, phase: "thinking" } : null));
          let remainingMs = OUTRO_THINK_MS;
          while (remainingMs > 0 && !skipThinkingRef.current && !nextQuestionRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (run !== outroRunRef.current) return false;
            if (!outroPausedRef.current) remainingMs -= 250;
            const curSec = Math.max(Math.ceil(remainingMs / 1000), 0);
            setActiveOutroQuiz((prev) => (prev ? { ...prev, remainingSeconds: curSec } : null));
          }
          if (run !== outroRunRef.current) return false;

          // 2.3 Cevap okunuyor (cevap kartı açılır)
          setActiveOutroQuiz((prev) => (prev ? { ...prev, phase: "answer", remainingSeconds: 0 } : null));
          setOutroLabel(`Soru ${qIdx + 1}/${totalQ} · cevap`);

          if (q.answerAudioUrl) {
            await playClip(q.answerAudioUrl, () => nextQuestionRef.current);
            releaseClip();
            if (run !== outroRunRef.current) return false;
          }

          // Kullanıcının cevabı görüp değerlendirmesi için süre tanınır (veya Bildim/Bilemedim ile anında geçer)
          let waitAnswerMs = 15000;
          while (waitAnswerMs > 0 && !nextQuestionRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (run !== outroRunRef.current) return false;
            if (!outroPausedRef.current) waitAnswerMs -= 250;
          }
        }

        if (run !== outroRunRef.current) return false;

        // 2.4 Bölüm sonu Özet Ekranı
        setActiveOutroQuiz({
          sectionTitle: detail.title ?? "Bölüm",
          documentTitle: currentDocumentRef.current?.title ?? "Not",
          totalQuestions: totalQ,
          questionIndex: totalQ - 1,
          question: questions[totalQ - 1],
          phase: "summary",
          remainingSeconds: 0,
          thinkSeconds: thinkSec,
          summary: {
            known: outroTallyRef.current.known,
            missed: outroTallyRef.current.missed,
            total: totalQ,
          },
        });
        setOutroLabel("Özet");

        // Kullanıcı özet ekranında "Devam Et" butonuna basana veya kapatana kadar bekle
        while (!summaryDoneRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (run !== outroRunRef.current) return false;
        }
      }

      if (run === outroRunRef.current) {
        releaseClip();
        outroActiveRef.current = false;
        setOutroLabel(null);
        setActiveOutroQuiz(null);
      }
      return run === outroRunRef.current;
    },
    []
  );
  // Dahili ses yükleme ve başlatma fonksiyonu
  const playDocumentSectionInternal = useCallback(
    async (doc: DocumentDetail, sectionIdx: number, startPositionMs?: number) => {
      const docSections = doc.sections ?? [];
      const section = docSections[sectionIdx];
      if (!section) return;

      stopOutro();
      const prevEnded = sectionEndedRef.current;
      sectionEndedRef.current = false;
      // Değişmeden önceki bölüm ve konumu (ilerleme doğru bölüme yazılsın).
      const prevSection = currentDocumentRef.current?.sections?.[currentSectionIndexRef.current];
      const prevPositionMs = positionMsRef.current;
      const prevWasQuick = isQuickAudioRef.current;

      setIsLoading(true);
      setErrorMessage(null);
      setCurrentDocument(doc);
      currentDocumentRef.current = doc;
      setCurrentSectionIndex(sectionIdx);
      currentSectionIndexRef.current = sectionIdx;

      const initialPos = startPositionMs ?? 0;
      setPositionMs(initialPos);
      positionMsRef.current = initialPos;
      setDurationMs(section.durationMs ?? 0);

      // Arka planda bölüm detayını (paragraflar, özet) getir. Eski bölümün
      // detayı bölüm sonunda yanlış soruları okutmasın diye sıfırlanır.
      if (currentSectionDetailRef.current?.id !== section.id) {
        setCurrentSectionDetail(null);
        currentSectionDetailRef.current = null;
      }
      // Dinleme modu "hızlı" değilse detay beklenir: kullanıcının kendi sesiyle
      // kaydı varsa (`ownVoice`) Dinlet sesi yerine o çalar.
      const isQuickMode = getUserSettings().listenMode === "quick" && Boolean(section.quickAudioUrl);
      const detailRequest = getSectionApi({ id: section.id })
        .then((res) => {
          const activeSec = currentDocumentRef.current?.sections?.[currentSectionIndexRef.current];
          if (res.data && activeSec?.id === section.id) setCurrentSectionDetail(res.data);
          return res.data ?? null;
        })
        .catch(() => null);
      const detail = isQuickMode ? null : await detailRequest;
      const activeAfterDetail = currentDocumentRef.current?.sections?.[currentSectionIndexRef.current];
      // Beklerken başka bölüme geçildiyse bu yükleme bırakılır.
      if (activeAfterDetail?.id !== section.id) return;

      // Önceki oynatıcıyı temizle
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (playerRef.current) {
        try {
          if (prevSection && prevPositionMs > 0 && !prevWasQuick && !prevEnded && !isAdvancingRef.current) {
            void persistProgress(prevSection.id, prevPositionMs, false);
          }
          playerRef.current.pause();
          playerRef.current.release();
        } catch {
          // yut
        }
        playerRef.current = null;
      }

      // Dinleme modu "hızlı" ve bölümün hızlı sürümü hazırsa o çalar.
      const quickUri =
        getUserSettings().listenMode === "quick" ? resolveAudioUrl(section.quickAudioUrl) : null;
      isQuickAudioRef.current = Boolean(quickUri);
      setIsQuickAudio(Boolean(quickUri));
      const ownVoiceUri = quickUri ? null : resolveAudioUrl(detail?.ownVoice?.audioUrl);
      isOwnVoiceRef.current = Boolean(ownVoiceUri);
      setIsOwnVoice(Boolean(ownVoiceUri));
      const localAudioUri = quickUri || ownVoiceUri ? null : downloads.getLocalAudioUri(section.id);
      const targetAudioUri =
        quickUri || ownVoiceUri || localAudioUri || resolveAudioUrl(section.audioUrl);
      if (!targetAudioUri) {
        setErrorMessage("Bu bölümün ses kaydı henüz hazır değil.");
        setIsLoading(false);
        setIsPlaying(false);
        isAdvancingRef.current = false;
        return;
      }

      try {
        const newPlayer = createAudioPlayer(
          { uri: targetAudioUri },
          {
            updateInterval: 250,
            keepAudioSessionActive: true,
          }
        );

        newPlayer.setPlaybackRate(speedRef.current);

        const sub = newPlayer.addListener("playbackStatusUpdate", (status: AudioStatus) => {
          // Bölüm sonu çalarken oynat/duraklat durumunu bölüm sonu yönetir.
          if (!outroActiveRef.current) setIsPlaying(status.playing);
          setIsBuffering(status.isBuffering);

          const currentMs = Math.round(status.currentTime * 1000);
          setPositionMs(currentMs);
          positionMsRef.current = currentMs;

          if (status.duration > 0) {
            setDurationMs(Math.round(status.duration * 1000));
          }

          // Periyodik ilerleme kaydı (her 10 saniyede bir). Hızlı tekrar sesinin
          // konumu asıl sesle uyuşmadığı için kaydedilmez.
          const now = Date.now();
          if (
            !isQuickAudioRef.current &&
            status.playing &&
            now - lastSaveTimeRef.current > 10000 &&
            Math.abs(currentMs - lastSavedPositionRef.current) > 3000
          ) {
            const activeDoc = currentDocumentRef.current;
            const activeIdx = currentSectionIndexRef.current;
            const activeSec = activeDoc?.sections?.[activeIdx];
            if (activeSec) {
              void persistProgress(activeSec.id, currentMs, false);
            }
          }

          // "Tekrar özeti" kapalıysa ses, özetin başladığı yerde bitmiş sayılır
          // (özet sesin sonunda, öncesinde ~1,2 sn sessizlikle).
          const recapMs =
            (isOwnVoiceRef.current
              ? currentSectionDetailRef.current?.ownVoice?.recapDurationMs
              : currentSectionDetailRef.current?.recapDurationMs) ?? 0;
          const skipRecap =
            !getUserSettings().recapAtSectionEnd &&
            !isQuickAudioRef.current &&
            recapMs > 0 &&
            status.duration > 0 &&
            currentMs >= status.duration * 1000 - recapMs - 600;
          if (skipRecap && status.playing) newPlayer.pause();

          // Bölümün bittiğini tespit etme (didJustFinish veya süre sonuna ulaşma)
          const isFinished =
            skipRecap ||
            status.didJustFinish ||
            (status.duration > 0 &&
              status.currentTime >= status.duration - 0.25 &&
              !status.playing);

          if (isFinished && !isAdvancingRef.current && !sectionEndedRef.current) {
            isAdvancingRef.current = true;
            sectionEndedRef.current = true;
            const activeDoc = currentDocumentRef.current;
            const activeIdx = currentSectionIndexRef.current;
            const allSecs = activeDoc?.sections ?? [];
            const activeSec = allSecs[activeIdx];

            if (activeSec) {
              void persistProgress(
                activeSec.id,
                activeSec.durationMs ?? Math.round(status.duration * 1000),
                true
              );
            }

            const afterOutro = (finishedOutro: boolean) => {
            // Bölüm sonu kesildiyse (duraklatma, başka bölüm) ilerleme yok.
            if (!finishedOutro) {
              isAdvancingRef.current = false;
              return;
            }
            // Uyku zamanlayıcısı "bölüm bittiğinde" ise durdur
            if (sleepTimerOptionRef.current === "end_of_section") {
              setSleepTimerOption("off");
              setIsPlaying(false);
              isAdvancingRef.current = false;
              return;
            }

            // Sıradaki bölüme otomatik geçiş
            if (activeDoc && activeIdx < allSecs.length - 1) {
              const nextIdx = activeIdx + 1;
              setTimeout(() => {
                void playDocumentSectionInternal(activeDoc, nextIdx, 0).finally(() => {
                  setTimeout(() => {
                    isAdvancingRef.current = false;
                  }, 800);
                });
              }, 200);
            } else {
              setIsPlaying(false);
              isAdvancingRef.current = false;
            }
            };
            // Bölüm sonu (kancalar, sorular) çalarken oynatıcı "çalıyor" görünür.
            setIsPlaying(true);
            void playOutro(currentSectionDetailRef.current).then(afterOutro);
          }
        });

        subscriptionRef.current = sub;
        playerRef.current = newPlayer;

        if (initialPos > 0) {
          await newPlayer.seekTo(initialPos / 1000);
        }

        newPlayer.play();
        setIsLoading(false);
        setIsPlaying(true);
        lastSaveTimeRef.current = Date.now();
        lastSavedPositionRef.current = initialPos;
        isAdvancingRef.current = false;
      } catch (err: unknown) {
        console.error("[PlayerContext] createAudioPlayer error:", err);
        setErrorMessage("Ses yüklenemedi. Lütfen bağlantınızı kontrol edin.");
        setIsLoading(false);
        setIsPlaying(false);
        isAdvancingRef.current = false;
      }
    },
    [persistProgress, playOutro, stopOutro]
  );

  const playDocumentSection = useCallback(
    async (doc: DocumentDetail, sectionIndex: number, startPositionMs?: number) => {
      isAdvancingRef.current = false;
      await playDocumentSectionInternal(doc, sectionIndex, startPositionMs);
    },
    [playDocumentSectionInternal]
  );

  /** Hızlı tekrar sesinin konumu asıl sesle uyuşmadığı için kaydedilmez. */
  const persistCurrentPosition = useCallback(() => {
    if (isQuickAudioRef.current) return;
    const sec = currentDocumentRef.current?.sections?.[currentSectionIndexRef.current];
    if (sec) void persistProgress(sec.id, positionMsRef.current, false);
  }, [persistProgress]);

  const pause = useCallback(async () => {
    if (outroActiveRef.current) {
      setOutroPaused(true);
      return;
    }
    if (playerRef.current && isPlayingRef.current) {
      playerRef.current.pause();
      setIsPlaying(false);
      persistCurrentPosition();
    }
  }, [persistCurrentPosition, setOutroPaused]);

  const resume = useCallback(async () => {
    if (outroActiveRef.current) {
      setOutroPaused(false);
      return;
    }
    const doc = currentDocumentRef.current;
    const idx = currentSectionIndexRef.current;
    // Ses hiç yüklenmediyse ya da bölüm bittiyse bölümü (yeniden) başlat.
    if (!playerRef.current || sectionEndedRef.current) {
      if (doc && doc.sections?.[idx]) {
        isAdvancingRef.current = false;
        const startMs = sectionEndedRef.current ? 0 : positionMsRef.current;
        await playDocumentSectionInternal(doc, idx, startMs);
      }
      return;
    }
    if (!isPlayingRef.current) {
      playerRef.current.play();
      setIsPlaying(true);
    }
  }, [playDocumentSectionInternal, setOutroPaused]);

  const togglePlayPause = useCallback(async () => {
    const playing = outroActiveRef.current ? !outroPausedRef.current : isPlayingRef.current;
    if (playing && playerRef.current) await pause();
    else await resume();
  }, [pause, resume]);

  const seekTo = useCallback(
    async (targetMs: number) => {
      if (!playerRef.current) return;
      // Bölüm sonundayken geri sarma: bölüm sonunu kes, ana sese dön.
      const wasInOutro = outroActiveRef.current && !outroPausedRef.current;
      if (outroActiveRef.current || sectionEndedRef.current) {
        stopOutro();
        sectionEndedRef.current = false;
        isAdvancingRef.current = false;
      }
      const maxMs = durationMsRef.current;
      const clamped = Math.max(0, maxMs > 0 ? Math.min(targetMs, maxMs) : targetMs);
      setPositionMs(clamped);
      positionMsRef.current = clamped;
      await playerRef.current.seekTo(clamped / 1000);
      if (wasInOutro) {
        playerRef.current.play();
        setIsPlaying(true);
      }
      persistCurrentPosition();
    },
    [persistCurrentPosition, stopOutro]
  );

  const seekBy = useCallback(
    async (deltaMs: number) => {
      await seekTo(positionMsRef.current + deltaMs);
    },
    [seekTo]
  );

  const nextSection = useCallback(async () => {
    const doc = currentDocumentRef.current;
    const idx = currentSectionIndexRef.current;
    const docSections = doc?.sections ?? [];
    if (doc && idx < docSections.length - 1) {
      isAdvancingRef.current = false;
      await playDocumentSectionInternal(doc, idx + 1, 0);
    }
  }, [playDocumentSectionInternal]);

  const previousSection = useCallback(async () => {
    const doc = currentDocumentRef.current;
    const idx = currentSectionIndexRef.current;
    if (doc && idx > 0) {
      isAdvancingRef.current = false;
      await playDocumentSectionInternal(doc, idx - 1, 0);
    }
  }, [playDocumentSectionInternal]);

  const setSpeed = useCallback(async (newSpeed: SpeedOption) => {
    setSpeedState(newSpeed);
    speedRef.current = newSpeed;
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(newSpeed);
    }
  }, []);

  const cycleSpeed = useCallback(async () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speedRef.current);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    await setSpeed(SPEED_OPTIONS[nextIndex]);
  }, [setSpeed]);

  const closeSession = useCallback(async () => {
    stopOutro();
    dismissOutro();
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentDocument(null);
    setCurrentSectionDetail(null);
    setPositionMs(0);
    setDurationMs(0);
  }, [dismissOutro, stopOutro]);

  return (
    <PlayerContext.Provider
      value={{
        currentDocument,
        sections,
        currentSectionIndex,
        currentSection,
        currentSectionDetail,
        isPlaying,
        isBuffering,
        isLoading,
        positionMs,
        durationMs,
        speed,
        sleepTimerOption,
        sleepTimerRemainingSec,
        errorMessage,
        hasNextSection,
        hasPrevSection,
        playDocumentSection,
        togglePlayPause,
        pause,
        resume,
        seekTo,
        seekBy,
        nextSection,
        previousSection,
        cycleSpeed,
        setSpeed,
        setSleepTimer,
        outroLabel,
        activeOutroQuiz,
        skipOutroThinking,
        nextOutroQuestion,
        completeOutroSummary,
        dismissOutro,
        closeSession,
        isQuickAudio,
        isOwnVoice,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
