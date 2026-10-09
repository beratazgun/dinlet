import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Check,
  ChevronLeft,
  Headphones,
  MoreHorizontal,
  Play,
  Trash2,
} from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation } from "@tanstack-query-craft";
import { formatDuration } from "@/lib/format";
import type { GetDocumentApiResponse } from "@/networks/api/documents/documents";

type DocumentDetail = NonNullable<GetDocumentApiResponse["Data"]>;

const PILL_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
  QUEUED: { label: "Sırada", bg: "#F1F2F6", fg: "#575C7A" },
  EXTRACTING: { label: "Metin çıkarılıyor", bg: "#E6E9FF", fg: "#2D40E5" },
  SCRIPTING: { label: "Anlatım hazırlanıyor", bg: "#E6E9FF", fg: "#2D40E5" },
  SYNTHESIZING: { label: "Seslendiriliyor", bg: "#E6E9FF", fg: "#2D40E5" },
};

export function DocumentProcessingView({
  document,
  onPlaySection,
}: {
  document: DocumentDetail;
  onPlaySection?: (sectionId: number) => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useCraftMutation("documents", "deleteItem");

  function confirmDelete() {
    Alert.alert(
      "İşlemi İptal Et ve Sil",
      `"${document.title}" işlenirken silinecek. Bu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => void handleDelete(),
        },
      ],
    );
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ id: document.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      ]);
      router.replace("/");
    } catch {
      Alert.alert("Hata", "Not silinemedi. Lütfen tekrar deneyin.");
    }
  }

  const statusRaw = document.status?.raw ?? "QUEUED";
  const pill = PILL_CONFIG[statusRaw] ?? PILL_CONFIG.SYNTHESIZING;

  const percent = Math.min(99, Math.max(0, document.progress?.percent ?? 0));
  const isFluent = document.rewriteMode?.raw === "FLUENT";
  const modeText = isFluent ? "Akıcı anlatım" : "Düz okuma";

  // Daire çevre hesabı: r = 52, çevre = 2 * PI * 52 ≈ 326.7
  const CIRCLE_R = 52;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
  const strokeDashoffset =
    CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * percent) / 100;

  const totalSections = document.sections.length;
  const readySections = document.sections.filter(
    (s) => s.status?.raw === "READY",
  );
  const readyCount = readySections.length;

  // Hat adımları durumu
  const isQueued = statusRaw === "QUEUED";
  const isExtracting = statusRaw === "EXTRACTING";
  const isScripting = statusRaw === "SCRIPTING";
  const isSynthesizing = statusRaw === "SYNTHESIZING";

  type StepItem = {
    key: string;
    label: string;
    note: string;
    state: "done" | "active" | "todo";
  };

  const steps: StepItem[] = [
    {
      key: "queued",
      label: isQueued ? "Sıraya alınıyor" : "Sıraya alındı",
      note: "",
      state: isQueued ? "active" : "done",
    },
    {
      key: "extract",
      label: isExtracting ? "Metin çıkarılıyor" : "Metin çıkarıldı",
      note: isQueued || isExtracting ? "" : `${document.pageCount} sayfa`,
      state: isQueued ? "todo" : isExtracting ? "active" : "done",
    },
    {
      key: "split",
      label:
        isScripting && totalSections === 0
          ? "Bölümlere ayrılıyor"
          : "Bölümlere ayrıldı",
      note:
        totalSections > 0 && !isExtracting && !isQueued
          ? `${totalSections} bölüm`
          : "",
      state:
        isQueued || isExtracting
          ? "todo"
          : isScripting && !isFluent
            ? "active"
            : totalSections > 0
              ? "done"
              : "todo",
    },
  ];

  if (isFluent) {
    steps.push({
      key: "script",
      label:
        isScripting && totalSections > 0
          ? "Akıcı anlatım hazırlanıyor"
          : "Akıcı anlatım hazırlandı",
      note: "",
      state:
        isQueued || isExtracting ? "todo" : isScripting ? "active" : "done",
    });
  }

  steps.push(
    {
      key: "synth",
      label: isSynthesizing
        ? "Seslendiriliyor"
        : readyCount === totalSections && totalSections > 0
          ? "Seslendirildi"
          : "Seslendirme",
      note: isSynthesizing ? `${readyCount} / ${totalSections}` : "",
      state: isSynthesizing
        ? "active"
        : isQueued || isExtracting || isScripting
          ? "todo"
          : "done",
    },
    {
      key: "ready",
      label: "Hazır",
      note: "",
      state: "todo",
    },
  );

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 48,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Üst Başlık, Rozet ve Seçenekler */}
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          className="-ml-2.5 h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={24} color="#0E1238" strokeWidth={2} />
        </Pressable>

        <View className="flex-row items-center gap-2">
          <View
            className="rounded-lg px-2.5 py-1.5"
            style={{ backgroundColor: pill.bg }}
          >
            <Text className="text-xs font-bold" style={{ color: pill.fg }}>
              {pill.label}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Seçenekler"
            onPress={confirmDelete}
            className="-mr-2.5 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          >
            <MoreHorizontal size={22} color="#0E1238" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {/* İlerleme Halkası ve Belge Bilgisi */}
      <View className="mt-3 flex-row items-center gap-4.5">
        <View className="relative h-[118px] w-[118px] items-center justify-center">
          <Svg width={118} height={118} viewBox="0 0 118 118">
            <Circle
              cx={59}
              cy={59}
              r={CIRCLE_R}
              stroke="#EEF0FB"
              strokeWidth={10}
              fill="none"
            />
            <Circle
              cx={59}
              cy={59}
              r={CIRCLE_R}
              stroke="#1928B4"
              strokeWidth={10}
              strokeDasharray={`${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              transform="rotate(-90 59 59)"
            />
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            <Text className="font-display text-[30px] font-extrabold tracking-[-0.9px] text-brand-ink">
              %{percent}
            </Text>
          </View>
        </View>

        <View className="flex-1 gap-1">
          <Text
            numberOfLines={2}
            className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.44px] text-brand-ink"
          >
            {document.title}
          </Text>
          <Text className="text-sm text-brand-ink-soft">
            {document.pageCount} sayfa · {modeText}
          </Text>
        </View>
      </View>

      {/* İşleme Adımları Kartı */}
      <View className="mt-5.5 rounded-[18px] bg-brand-lavender p-4">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isDone = step.state === "done";
          const isActive = step.state === "active";

          return (
            <View key={step.key} className="flex-row items-stretch gap-3">
              {/* Sol Çizgi ve Nokta */}
              <View className="w-[22px] items-center">
                <View
                  className={`h-[22px] w-[22px] items-center justify-center rounded-full ${
                    isDone
                      ? "bg-brand-indigo"
                      : isActive
                        ? "border-2 border-brand-indigo bg-white"
                        : "border-2 border-[#C5CAE3] bg-white"
                  }`}
                >
                  {isDone ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3.4} />
                  ) : isActive ? (
                    <View className="h-2 w-2 rounded-full bg-brand-indigo" />
                  ) : null}
                </View>

                {!isLast ? (
                  <View
                    className={`w-[2px] flex-1 ${
                      isDone ? "bg-brand-indigo" : "bg-[#D5D9EE]"
                    }`}
                    style={{ minHeight: 20 }}
                  />
                ) : null}
              </View>

              {/* Sağ Metin */}
              <View className="flex-1 pb-3.5 pt-0.5">
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text
                    numberOfLines={1}
                    className={`min-w-0 flex-1 text-[15px] ${
                      isActive
                        ? "font-bold text-brand-ink"
                        : isDone
                          ? "font-semibold text-brand-ink"
                          : "font-medium text-brand-muted"
                    }`}
                  >
                    {step.label}
                  </Text>
                  {step.note ? (
                    <Text className="flex-none text-xs font-semibold text-brand-ink-soft">
                      {step.note}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Şimdi Dinleyebilirsin Alanı (Bölümler hazır oldukça gösterilir) */}
      {readyCount > 0 ? (
        <View className="mt-5 rounded-[18px] border-[1.5px] border-brand-line bg-white p-4">
          <View className="flex-row items-center justify-between pb-3">
            <View className="flex-row items-center gap-2">
              <Headphones size={18} color="#1928B4" strokeWidth={2.2} />
              <Text className="font-display text-base font-extrabold text-brand-ink">
                Şimdi dinleyebilirsin
              </Text>
            </View>
            <Text className="text-xs font-bold text-brand-indigo">
              {readyCount} / {totalSections} bölüm
            </Text>
          </View>

          <View className="divide-y divide-[#EEF0F7]">
            {document.sections.map((sec, i) => {
              const isSecReady = sec.status?.raw === "READY";
              const isSecBusy =
                sec.status?.raw === "SYNTHESIZING" ||
                sec.status?.raw === "SCRIPTING";

              return (
                <Pressable
                  key={sec.id}
                  disabled={!isSecReady}
                  onPress={() => onPlaySection?.(sec.id)}
                  className="flex-row items-center justify-between gap-3 py-2.5 active:opacity-70"
                >
                  <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
                    <Text
                      className={`font-mono text-xs font-bold flex-none ${
                        isSecReady ? "text-brand-indigo" : "text-brand-muted"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      className={`min-w-0 flex-1 text-[14px] ${
                        isSecReady
                          ? "font-semibold text-brand-ink"
                          : "font-medium text-brand-ink-soft"
                      }`}
                    >
                      {sec.title}
                    </Text>
                  </View>

                  {isSecReady ? (
                    <View className="flex-none flex-row items-center gap-2">
                      {sec.durationMs ? (
                        <Text className="text-xs font-medium text-brand-ink-soft">
                          {formatDuration(sec.durationMs)}
                        </Text>
                      ) : null}
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-surface">
                        <Play size={12} color="#1928B4" fill="#1928B4" />
                      </View>
                    </View>
                  ) : isSecBusy ? (
                    <View className="flex-none flex-row items-center gap-1.5">
                      <ActivityIndicator size="small" color="#2D40E5" />
                      <Text className="text-xs font-medium text-brand-blue-vivid">
                        Seslendiriliyor…
                      </Text>
                    </View>
                  ) : (
                    <Text className="flex-none text-xs font-medium text-brand-muted">
                      Sırada
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Alt Bilgilendirme */}
      <Text className="mt-6 text-center text-[13px] leading-[19px] text-brand-ink-soft">
        Tamamı hazır olunca bildirim göndereceğiz. Uygulamayı kapatabilirsin.
      </Text>

      {/* İptal / Sil Butonu */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="İşlemi iptal et ve notu sil"
        onPress={confirmDelete}
        disabled={deleteMutation.isPending}
        className="mt-6 flex-row items-center justify-center gap-2 py-3 active:opacity-70"
      >
        {deleteMutation.isPending ? (
          <ActivityIndicator size="small" color="#D92D45" />
        ) : (
          <Trash2 size={16} color="#D92D45" strokeWidth={2} />
        )}
        <Text className="text-sm font-semibold text-[#D92D45]">
          İşlemi iptal et ve notu sil
        </Text>
      </Pressable>
    </ScrollView>
  );
}
