import Svg, { Path, Rect } from "react-native-svg";

/** Dolu oynat üçgeni; `playing` iken duraklat çubukları. */
export function PlayGlyph({
  size = 14,
  color,
  playing = false,
}: {
  size?: number;
  color: string;
  playing?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {playing ? (
        <>
          <Rect x={6} y={5} width={4} height={14} rx={1} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1} fill={color} />
        </>
      ) : (
        <Path d="M8 5.5v13l11-6.5z" fill={color} />
      )}
    </Svg>
  );
}
