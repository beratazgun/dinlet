import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Check, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCraftQuery } from "@tanstack-query-craft";
import { FormError } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { GetReviewSummaryApiResponse } from "@/networks/api/review/review";

type Summary = NonNullable<GetReviewSummaryApiResponse["Data"]>;
type ReviewItem = Summary["items"][number];

/** Aşama rozetinin renkleri: ilk günler koyu, sonrakiler açık. */
const STAGE_TONES = [
  { bg: "#1928B4", fg: "#FFFFFF" },
  { bg: "#2D40E5", fg: "#FFFFFF" },
  { bg: "#EEF0FB", fg: "#1928B4" },
  { bg: "#F4F5FD", fg: "#575C7A" },
];

/** "2026-10-09" → "Cuma, 9 Ekim" */
function formatToday(day: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const text = new Date(year, month - 1, date).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
}

/** Sıradaki tekrar ne zaman: "yarın", "3 gün sonra". */
function whenLabel(dueOn: string, today: string): string {
  const toUtc = (day: string) => {
    const [year, month, date] = day.split("-").map(Number) as [number, number, number];
    return Date.UTC(year, month - 1, date);
  };
  const days = Math.round((toUtc(dueOn) - toUtc(today)) / 86_400_000);
  if (days <= 0) return "bugün";
  if (days === 1) return "yarın";
  return `${days} gün sonra`;
}

function HeroCard({ summary }: { summary: Summary }) {
  const minutes = Math.max(1, Math.round(summary.estimatedMs / 60_000));
  const hasDue = summary.dueCount > 0;

  return (
    <View className="mt-[18px] gap-3 rounded-[22px] bg-brand-indigo p-[18px]">
      <Text className="text-xs font-bold uppercase tracking-[0.96px] text-[#C9D0FD]">
        {summary.streakDays > 0 ? `${summary.streakDays} gündür aralıksız` : "Bugün başla"}
      </Text>
      <Text className="font-display text-2xl leading-[26px] tracking-[-0.48px] text-white">
        {hasDue ? `${summary.dueCount} bölüm · yaklaşık ${minutes} dk` : "Bugün tekrar yok"}
      </Text>
      <Text className="text-sm leading-5 text-brand-mist">
        {hasDue
          ? "Sadece tekrar özetleri ve sorular çalar. Unuttuklarına daha sık döneriz."
          : "Sonuna kadar dinlediğin bölümler 1, 3, 7 ve 21 gün sonra burada sorularıyla belirir."}
      </Text>
      {hasDue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tekrara başla"
          onPress={() => router.push("/quiz")}
          className="h-11 flex-row items-center gap-2 self-start rounded-[14px] bg-white px-[18px]"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M8 5.5v13l11-6.5z" fill="#1928B4" />
          </Svg>
          <Text className="text-[15px] font-bold text-brand-indigo">Tekrara başla</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LockedCard({ lockedBy }: { lockedBy: "PLAN" | "CONSENT" }) {
  const isPlan = lockedBy === "PLAN";
  return (
    <View className="mt-3 gap-2 rounded-2xl bg-brand-lavender p-4">
      <View className="flex-row items-center gap-2">
        <Lock size={16} color="#1928B4" />
        <Text className="text-[15px] font-bold text-brand-ink">
          {isPlan ? "Sesli sorular Pro'ya özel" : "Sorular için açık rıza gerekiyor"}
        </Text>
      </View>
      <Text className="text-[13px] leading-[19px] text-brand-ink-soft">
        {isPlan
          ? "Pro'da her bölümün sonunda üç soru hazırlanır; bitirdiğin bölümler aralıklı tekrarla geri gelir."
          : "Sorular yurt dışındaki yapay zekâ servisiyle hazırlanır. Rıza verirsen yeni notlarında sorular da üretilir."}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(isPlan ? "/pro" : "/consents")}
        className="mt-1 self-start"
      >
        <Text className="text-sm font-bold text-brand-indigo">
          {isPlan ? "Pro'ya geç" : "Rızayı yönet"}
        </Text>
      </Pressable>
    </View>
  );
}

function ItemRow({ item, today }: { item: ReviewItem; today: string }) {
  const tone = STAGE_TONES[Math.min(item.stage, STAGE_TONES.length - 1)]!;
  const meta = [
    item.documentTitle,
    `${item.questionCount} soru`,
    item.isDue ? null : whenLabel(item.dueOn, today),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.stageLabel}: ${item.sectionTitle}. ${meta}`}
      onPress={() =>
        router.push({ pathname: "/documents/[id]", params: { id: String(item.documentId) } })
      }
      className="flex-row items-center gap-3 border-b border-[#EEF0F7] py-[11px]"
    >
      <View
        className="h-[26px] min-w-[52px] items-center justify-center rounded-lg px-2"
        style={{ backgroundColor: tone.bg }}
      >
        <Text className="text-[11px] font-bold" style={{ color: tone.fg }}>
          {item.stageLabel}
        </Text>
      </View>
      <View className="min-w-0 flex-1 gap-px">
        <Text numberOfLines={1} className="text-[15px] font-semibold text-brand-ink">
          {item.sectionTitle}
        </Text>
        <Text numberOfLines={1} className="text-xs text-brand-muted">
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/** "Bugünkü tekrar": haftalık şerit, seri, bugünün yükü ve sıradakiler. */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const summary = useCraftQuery("review", "getReviewSummary", [], {
    refetchOnScreenFocus: true,
  });
  const data = summary.data?.data;

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 12, 60),
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={summary.isRefetching}
            onRefresh={() => void summary.refetch()}
            tintColor="#1928B4"
          />
        }
      >
        {summary.isPending ? (
          <View className="items-center py-24">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : summary.isError || !data ? (
          <FormError>{getApiErrorMessage(summary.error)}</FormError>
        ) : (
          <>
            <Text className="text-sm font-medium text-brand-ink-soft">
              {formatToday(data.today)}
            </Text>
            <Text
              accessibilityRole="header"
              className="mt-0.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
            >
              Bugünkü tekrar
            </Text>

            <View
              accessibilityLabel={`Bu hafta ${data.week.filter((day) => day.done).length} gün tekrar yaptın`}
              className="mt-3.5 flex-row justify-between"
            >
              {data.week.map((day) => (
                <View key={day.day} className="items-center gap-1.5">
                  <Text className="text-[11px] font-bold text-brand-muted">{day.label}</Text>
                  <View
                    className="h-[34px] w-[34px] items-center justify-center rounded-full border-2"
                    style={{
                      backgroundColor: day.done ? "#1928B4" : "#FFFFFF",
                      borderColor: day.done ? "#1928B4" : day.isToday ? "#2D40E5" : "#E1E4F3",
                    }}
                  >
                    {day.done ? <Check size={14} strokeWidth={3.2} color="#FFFFFF" /> : null}
                  </View>
                </View>
              ))}
            </View>

            <HeroCard summary={data} />
            {data.lockedBy && data.items.length === 0 ? (
              <LockedCard lockedBy={data.lockedBy} />
            ) : null}

            <View className="mt-2.5">
              {data.items.map((item) => (
                <ItemRow key={item.sectionId} item={item} today={data.today} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
