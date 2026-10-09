import { Pressable, Text, View } from "react-native";
import type { GetMineApiResponse } from "@/networks/api/subscription/subscription";

type Subscription = NonNullable<GetMineApiResponse["Data"]>;

/** Plan rozeti ve bu ayki sayfa kullanımı. */
export function PlanCard({
  subscription,
  onPress,
}: {
  subscription: Subscription;
  onPress: () => void;
}) {
  const { usedPages, monthlyPages, remainingPages } = subscription.usage;
  const isPro = subscription.plan?.raw === "PRO";
  const ratio = monthlyPages > 0 ? Math.min(1, usedPages / monthlyPages) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isPro ? "Pro" : "Free"} plan. Bu ay ${usedPages} / ${monthlyPages} sayfa, ${remainingPages} kaldı`}
      onPress={onPress}
      className="mt-3 flex-row items-center gap-3 rounded-2xl bg-brand-lavender px-3.5 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View
        className={`rounded-md px-2 py-1 ${isPro ? "bg-brand-indigo" : "bg-brand-ink-soft"}`}
      >
        <Text className="text-[11px] font-bold tracking-[0.66px] text-white">
          {isPro ? "PRO" : "FREE"}
        </Text>
      </View>
      <View className="flex-1 gap-1.5">
        <View className="flex-row justify-between">
          <Text className="text-[13px] font-semibold text-brand-ink">
            Bu ay {usedPages} / {monthlyPages} sayfa
          </Text>
          <Text className="text-[13px] font-medium text-brand-ink-soft">
            {remainingPages} kaldı
          </Text>
        </View>
        <View className="h-[5px] overflow-hidden rounded-[3px] bg-[#DDE1F7]">
          <View
            className="h-full rounded-[3px] bg-brand-blue-vivid"
            style={{ width: `${ratio * 100}%` }}
          />
        </View>
      </View>
    </Pressable>
  );
}
