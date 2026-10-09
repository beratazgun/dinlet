import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

const VARIANTS = {
  /** Lacivert dolgu — ekranın ana eylemi. */
  primary: {
    box: "h-14 rounded-2xl bg-brand-indigo",
    label: "text-[17px] font-bold text-white",
    spinner: "#FFFFFF",
  },
  /** Beyaz dolgu — lacivert zeminde ana eylem. */
  inverse: {
    box: "h-14 rounded-2xl bg-white",
    label: "text-[17px] font-bold text-brand-indigo",
    spinner: "#1928B4",
  },
  /** Yarı saydam çerçeve — lacivert zeminde ikincil eylem. */
  "inverse-outline": {
    box: "h-[52px] rounded-2xl border-[1.5px] border-white/35",
    label: "text-base font-semibold text-white",
    spinner: "#FFFFFF",
  },
  /** Koyu dolgu — Apple ile devam et. */
  dark: {
    box: "h-[52px] rounded-[14px] bg-brand-ink",
    label: "text-base font-semibold text-white",
    spinner: "#FFFFFF",
  },
  /** Beyaz, ince çerçeve — Google ile devam et. */
  outline: {
    box: "h-[52px] rounded-[14px] border-[1.5px] border-brand-line bg-white",
    label: "text-base font-semibold text-brand-ink",
    spinner: "#0E1238",
  },
  /** Zeminsiz — üçüncül eylem. */
  ghost: {
    box: "h-[50px] rounded-2xl",
    label: "text-base font-bold text-brand-indigo",
    spinner: "#1928B4",
  },
} as const;

export interface AuthButtonProps {
  children: string;
  onPress?: () => void;
  variant?: keyof typeof VARIANTS;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AuthButton({
  children,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  className = "",
}: AuthButtonProps) {
  const styles = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2.5 ${styles.box} ${className}`}
      style={({ pressed }) => ({
        opacity: disabled && !loading ? 0.5 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {loading ? (
        <ActivityIndicator color={styles.spinner} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text className={styles.label}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}
