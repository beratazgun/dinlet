import { Pressable, Text, View } from "react-native";
import type { GetCollectionsApiResponse } from "@/networks/api/study/study";
import { FolderGlyph } from "./folder-glyph";

export type StudyFolder = NonNullable<GetCollectionsApiResponse["Data"]>["folders"][number];

/** Klasör kartı: simge, ad, "4 belge · 3 bitti" ve ilerleme çubuğu. */
export function FolderCard({
  folder,
  onPress,
  onLongPress,
}: {
  folder: StudyFolder;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const meta = `${folder.documentCount} belge · ${folder.finishedCount} bitti`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${folder.name} klasörü, ${meta}`}
      accessibilityHint="Düzenlemek için basılı tut"
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-1 gap-3 rounded-[18px] border-[1.5px] border-brand-hairline bg-white p-3.5"
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <FolderGlyph color={folder.color} />
      <View className="gap-0.5">
        <Text numberOfLines={1} className="text-[15px] font-bold text-brand-ink">
          {folder.name}
        </Text>
        <Text className="text-xs text-brand-muted">{meta}</Text>
      </View>
      <View className="h-1 overflow-hidden rounded-sm bg-brand-surface">
        <View
          className="h-full bg-brand-blue-vivid"
          style={{ width: `${folder.progressPercent}%` }}
        />
      </View>
    </Pressable>
  );
}
