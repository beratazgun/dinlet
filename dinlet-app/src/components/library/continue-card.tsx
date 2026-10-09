import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { formatClock } from "@/lib/format";

const DECOR_BARS = [20, 38, 56, 30, 46, 18];

function AnimatedEqualizerBar({
  baseHeight,
  isPlaying,
  delay,
}: {
  baseHeight: number;
  isPlaying: boolean;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(baseHeight)).current;

  useEffect(() => {
    if (!isPlaying) {
      Animated.timing(anim, {
        toValue: baseHeight,
        duration: 250,
        useNativeDriver: false,
      }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: Math.max(10, baseHeight * 0.4),
          duration: 280 + delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: Math.min(56, baseHeight * 1.3),
          duration: 280 + delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: baseHeight,
          duration: 240,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isPlaying, baseHeight, delay, anim]);

  return (
    <Animated.View
      className="w-1 rounded-sm bg-brand-accent"
      style={{ height: anim }}
    />
  );
}

export interface ContinueCardItem {
  sectionTitle: string;
  documentTitle: string;
  sectionOrder: number;
  sectionCount?: number | null;
  durationMs?: number | null;
  positionMs: number;
}

export function ContinueCard({
  item,
  isPlaying = false,
  livePositionMs,
  liveDurationMs,
  onPress,
  onTogglePlayPause,
}: {
  item: ContinueCardItem;
  isPlaying?: boolean;
  livePositionMs?: number;
  liveDurationMs?: number;
  onPress: () => void;
  onTogglePlayPause?: () => void;
}) {
  const effectivePos = livePositionMs !== undefined ? livePositionMs : item.positionMs;
  const effectiveDur = liveDurationMs !== undefined ? liveDurationMs : item.durationMs;

  const ratio =
    effectiveDur && effectiveDur > 0
      ? Math.max(0, Math.min(1, effectivePos / effectiveDur))
      : 0;

  const remainingMs =
    effectiveDur && effectiveDur > 0
      ? Math.max(0, effectiveDur - effectivePos)
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Devam et: ${item.sectionTitle}, ${item.documentTitle}`}
      onPress={onPress}
      className="mt-5 gap-3.5 overflow-hidden rounded-[22px] bg-brand-indigo p-[18px] active:opacity-95"
    >
      {/* Arka plandaki ses çubukları (Çalarken hareketli ekolayzır) */}
      <View
        pointerEvents="none"
        className="absolute -right-1.5 top-3.5 flex-row items-center gap-1 opacity-[0.22]"
      >
        {DECOR_BARS.map((height, index) => (
          <AnimatedEqualizerBar
            key={index}
            baseHeight={height}
            isPlaying={isPlaying}
            delay={index * 50}
          />
        ))}
      </View>

      {/* Kart Üst Başlığı */}
      <View className="flex-row items-center gap-1.5">
        {isPlaying ? (
          <View className="h-2 w-2 rounded-full bg-[#52E394]" />
        ) : null}
        <Text className="text-xs font-bold uppercase tracking-[0.96px] text-[#C9D0FD]">
          {isPlaying ? "Şimdi dinleniyor" : "Kaldığın yerden devam et"}
        </Text>
      </View>

      {/* Başlık ve Oynat/Duraklat Butonu */}
      <View className="flex-row items-center gap-3.5">
        <View className="min-w-0 flex-1 gap-[3px]">
          <Text
            numberOfLines={1}
            className="font-display-bold text-xl tracking-[-0.4px] text-white"
          >
            {item.sectionTitle}
          </Text>
          <Text numberOfLines={1} className="text-sm text-brand-mist">
            {item.documentTitle} · Bölüm {item.sectionOrder}
            {item.sectionCount ? `/${item.sectionCount}` : ""}
          </Text>
        </View>

        {/* Canlı Oynat / Duraklat Butonu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Duraklat" : "Oynat"}
          onPress={(e) => {
            e.stopPropagation();
            if (onTogglePlayPause) {
              onTogglePlayPause();
            } else {
              onPress();
            }
          }}
          className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white active:opacity-85 shadow-md shadow-indigo-950/20"
        >
          {isPlaying ? (
            <View className="flex-row items-center gap-[4px]">
              <View className="h-4.5 w-[4px] rounded-[1.5px] bg-brand-indigo" />
              <View className="h-4.5 w-[4px] rounded-[1.5px] bg-brand-indigo" />
            </View>
          ) : (
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M8 5.5v13l11-6.5z" fill="#1928B4" />
            </Svg>
          )}
        </Pressable>
      </View>

      {/* İlerleme Çubuğu & Kalan Süre */}
      <View className="flex-row items-center gap-2.5">
        <View className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-white/22">
          <View
            className="h-full rounded-[3px] bg-white"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </View>
        {remainingMs !== null ? (
          <Text
            style={{ fontVariant: ["tabular-nums"] }}
            className="text-xs font-semibold text-brand-mist"
          >
            {formatClock(remainingMs)} kaldı
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
