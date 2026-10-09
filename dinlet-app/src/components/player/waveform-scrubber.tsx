import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  LayoutChangeEvent,
  Text,
  View,
} from "react-native";
import { formatClock } from "@/lib/format";

const WAVEFORM_HEIGHTS = [
  18, 28, 40, 24, 46, 34, 52, 30, 22, 44, 38, 26, 50, 42, 20, 34, 48, 30, 40,
  24, 36, 52, 28, 18, 32, 46, 38, 22, 30, 44, 26, 36, 20, 40, 48, 30, 24, 34,
  42, 18, 28, 22, 36, 26, 16, 22,
];

interface WaveformScrubberProps {
  positionMs: number;
  durationMs: number;
  onSeek: (targetMs: number) => void;
  playedColor?: string;
  unplayedColor?: string;
}

export function WaveformScrubber({
  positionMs,
  durationMs,
  onSeek,
  playedColor = "#1928B4",
  unplayedColor = "#D5D9EE",
}: WaveformScrubberProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerWidthRef = useRef<number>(0);

  const isDraggingRef = useRef(false);
  const [dragMs, setDragMs] = useState<number | null>(null);

  const animRatio = useRef(new Animated.Value(0)).current;
  const currentRatioRef = useRef(0);

  const safeDuration = Math.max(1, durationMs);
  const targetRatio = Math.max(0, Math.min(1, positionMs / safeDuration));

  // Pozisyon değiştiğinde (özellikle 15s ileri/geri almalarda) yumuşak animasyon
  useEffect(() => {
    if (isDraggingRef.current) return;

    const delta = Math.abs(targetRatio - currentRatioRef.current);
    // 15 saniye atlama veya büyük sıçramalarda akıcı cubic geçiş
    const isJump = delta > 0.03;
    const duration = isJump ? 280 : 250;
    const easing = isJump ? Easing.out(Easing.cubic) : Easing.linear;

    Animated.timing(animRatio, {
      toValue: targetRatio,
      duration,
      easing,
      useNativeDriver: false,
    }).start(() => {
      currentRatioRef.current = targetRatio;
    });
  }, [targetRatio, animRatio]);

  function handleTouch(evt: GestureResponderEvent) {
    if (containerWidthRef.current <= 0) return;
    const locationX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, locationX / containerWidthRef.current));
    animRatio.setValue(ratio);
    currentRatioRef.current = ratio;
    setDragMs(Math.round(ratio * safeDuration));
  }

  function handleTouchStart(evt: GestureResponderEvent) {
    isDraggingRef.current = true;
    handleTouch(evt);
  }

  function handleTouchMove(evt: GestureResponderEvent) {
    handleTouch(evt);
  }

  function handleTouchEnd(evt: GestureResponderEvent) {
    if (containerWidthRef.current <= 0) return;
    const locationX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, locationX / containerWidthRef.current));
    isDraggingRef.current = false;
    setDragMs(null);
    currentRatioRef.current = ratio;
    onSeek(Math.round(ratio * safeDuration));
  }

  function handleLayout(e: LayoutChangeEvent) {
    const width = e.nativeEvent.layout.width;
    containerWidthRef.current = width;
    setContainerWidth(width);
  }

  const animatedFillWidth = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [0, containerWidth || 1],
    extrapolate: "clamp",
  });

  const displayPosMs = dragMs !== null ? dragMs : positionMs;
  const remainingMs = Math.max(0, safeDuration - displayPosMs);

  return (
    <View className="w-full">
      {/* Dalga Formu Dokunma Alanı */}
      <View
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        className="relative h-[52px] w-full justify-center"
        accessibilityRole="adjustable"
        accessibilityLabel={`İlerleme: ${formatClock(displayPosMs)} / ${formatClock(safeDuration)}`}
      >
        {/* Katman 1: Oynatılmamış Gri Çubuklar (Arka Plan) */}
        <View className="absolute inset-0 flex-row items-center justify-between">
          {WAVEFORM_HEIGHTS.map((height, i) => (
            <View
              key={i}
              className="mx-[1.5px] flex-1 rounded-[2px]"
              style={{
                height,
                backgroundColor: unplayedColor,
              }}
            />
          ))}
        </View>

        {/* Katman 2: Oynatılmış Mor/Mavi Çubuklar (Animasyonlu Kırpma Maskesi) */}
        {containerWidth > 0 && (
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: animatedFillWidth,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: containerWidth,
                height: "100%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {WAVEFORM_HEIGHTS.map((height, i) => (
                <View
                  key={i}
                  className="mx-[1.5px] flex-1 rounded-[2px]"
                  style={{
                    height,
                    backgroundColor: playedColor,
                  }}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Zaman Etiketleri */}
      <View className="mt-2 flex-row justify-between">
        <Text
          style={{ fontVariant: ["tabular-nums"] }}
          className="text-[13px] font-semibold text-brand-ink-soft"
        >
          {formatClock(displayPosMs)}
        </Text>
        <Text
          style={{ fontVariant: ["tabular-nums"] }}
          className="text-[13px] font-semibold text-brand-ink-soft"
        >
          −{formatClock(remainingMs)}
        </Text>
      </View>
    </View>
  );
}
