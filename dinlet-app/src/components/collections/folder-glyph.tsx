import { View } from "react-native";

/** Backend'in `FOLDER_COLORS` paletiyle aynı sıra. */
export const FOLDER_COLORS = [
  "#1928B4",
  "#2D40E5",
  "#96A6F9",
  "#1322A0",
  "#0E1238",
  "#B54708",
  "#0F7B6C",
  "#C11574",
] as const;

/** Sekmeli klasör simgesi (tasarımdaki 36×30 renkli şekil). */
export function FolderGlyph({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <View
      accessibilityElementsHidden
      style={{ width: 36 * scale, height: 30 * scale, marginTop: 4 * scale }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: -4 * scale,
          width: 16 * scale,
          height: 8 * scale,
          borderTopLeftRadius: 4 * scale,
          borderTopRightRadius: 4 * scale,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: 36 * scale,
          height: 30 * scale,
          borderRadius: 7 * scale,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
