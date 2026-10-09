import { Pressable, Text, View } from "react-native";
import { Target } from "lucide-react-native";
import { withPossessiveAccusative } from "@/lib/format";
import type { GetCollectionsApiResponse } from "@/networks/api/study/study";

export type StudyGoal = NonNullable<NonNullable<GetCollectionsApiResponse["Data"]>["goal"]>;

function goalMessage(goal: StudyGoal): string {
  if (goal.daysLeft < 0) return "Sınav tarihi geçti. Yeni bir hedef belirleyebilirsin.";
  if (goal.documentCount === 0) return "İlk notunu yükle; ne kadar dinlemen gerektiğini hesaplayalım.";
  const progress = `${goal.documentCount} belgenin ${withPossessiveAccusative(goal.finishedCount)} bitirdin.`;
  if (goal.dailyMinutes === null) return `${progress} Şimdi tekrar zamanı!`;
  if (goal.daysLeft === 0) return `${progress} Bugün sınav günü, başarılar!`;
  return `${progress} Günde ~${goal.dailyMinutes} dk dinlersen yetişirsin.`;
}

/** "38 gün kaldı · KPSS hedefi" kartı; hedef yoksa ekleme daveti. */
export function GoalCard({ goal, onPress }: { goal: StudyGoal | null; onPress: () => void }) {
  if (!goal) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sınav hedefi ekle"
        onPress={onPress}
        className="mt-3.5 flex-row items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed border-[#B7BCD6] bg-brand-lavender p-4"
      >
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
          <Target size={24} color="#1928B4" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-base font-bold text-brand-ink">Sınav hedefi ekle</Text>
          <Text className="text-[13px] leading-[18px] text-brand-ink-soft">
            Sınav gününü seç; kaç gün kaldığını ve günde ne kadar dinlemen gerektiğini
            gösterelim.
          </Text>
        </View>
      </Pressable>
    );
  }

  const today = goal.daysLeft === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.examName} hedefi, ${today ? "bugün" : `${goal.daysLeft} gün kaldı`}. ${goalMessage(goal)} Düzenlemek için dokun.`}
      onPress={onPress}
      className="mt-3.5 flex-row items-center gap-4 rounded-[20px] bg-brand-indigo p-4"
    >
      <View className="h-[76px] w-[76px] items-center justify-center rounded-[18px] bg-white/12">
        <Text className="font-display text-[30px] leading-[30px] text-white">
          {today ? "!" : Math.max(0, goal.daysLeft)}
        </Text>
        <Text className="text-[11px] font-bold text-[#C9D0FD]">
          {today ? "bugün" : goal.daysLeft < 0 ? "geçti" : "gün kaldı"}
        </Text>
      </View>
      <View className="flex-1 gap-1.5">
        <Text className="text-base font-bold text-white">{goal.examName} hedefi</Text>
        <Text className="text-[13px] leading-[18px] text-brand-mist">{goalMessage(goal)}</Text>
        <View className="h-[5px] overflow-hidden rounded-[3px] bg-white/22">
          <View className="h-full bg-white" style={{ width: `${goal.progressPercent}%` }} />
        </View>
      </View>
    </Pressable>
  );
}
