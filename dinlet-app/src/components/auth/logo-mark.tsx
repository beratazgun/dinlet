import { View } from "react-native";

const SIZES = {
  sm: { box: 36, radius: 11, gap: 2.5, bars: [9, 17, 22, 13, 7] },
  md: { box: 48, radius: 14, gap: 3, bars: [11, 20, 27, 16, 9] },
} as const;

export interface LogoMarkProps {
  size?: keyof typeof SIZES;
  /** Beyaz zemin, lacivert çubuklar — koyu (marka) arka planlar için. */
  inverted?: boolean;
}

/** Dinlet işareti: kare zeminde beş ses çubuğu. */
export function LogoMark({ size = "md", inverted = false }: LogoMarkProps) {
  const spec = SIZES[size];
  const bar = inverted ? "bg-brand-indigo" : "bg-white";

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Dinlet"
      className={`flex-row items-center justify-center ${inverted ? "bg-white" : "bg-brand-indigo"}`}
      style={{
        width: spec.box,
        height: spec.box,
        borderRadius: spec.radius,
        gap: spec.gap,
      }}
    >
      {spec.bars.map((height, index) => (
        <View
          key={index}
          className={`w-[3px] rounded-[2px] ${bar}`}
          style={{ height }}
        />
      ))}
    </View>
  );
}
