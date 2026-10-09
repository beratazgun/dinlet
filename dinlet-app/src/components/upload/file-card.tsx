import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { FileUp } from "lucide-react-native";

/** Seçilen PDF: küçük "PDF" kapağı, ad, durum satırı ve "Değiştir". */
export function FileCard({
  name,
  detail,
  progress,
  busy,
  error,
  onChange,
}: {
  name: string;
  /** "48 sayfa · 6,2 MB" ya da "Yükleniyor… %45" */
  detail: string;
  /** 0–1 arası yükleme oranı; verilirse ince ilerleme çubuğu çizilir. */
  progress?: number;
  busy?: boolean;
  error?: string | null;
  onChange: () => void;
}) {
  return (
    <View
      className={`mt-3.5 gap-3 rounded-[18px] border-[1.5px] bg-white p-3.5 ${
        error ? "border-[#F6C3CB]" : "border-brand-hairline"
      }`}
    >
      <View className="flex-row items-center gap-3.5">
        <View className="h-[54px] w-[46px] items-center justify-end rounded-[10px] bg-brand-indigo pb-2">
          <Text className="text-[11px] font-bold tracking-[0.55px] text-white">PDF</Text>
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text numberOfLines={1} className="text-[15px] font-bold text-brand-ink">
            {name}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {busy ? <ActivityIndicator size="small" color="#575C7A" /> : null}
            <Text
              numberOfLines={2}
              className={`flex-1 text-[13px] ${error ? "text-brand-danger" : "text-brand-ink-soft"}`}
            >
              {error ?? detail}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Başka bir PDF seç"
          onPress={onChange}
          className="h-9 justify-center rounded-[10px] bg-brand-lavender px-3"
        >
          <Text className="text-[13px] font-bold text-brand-indigo">Değiştir</Text>
        </Pressable>
      </View>
      {progress !== undefined ? (
        <View className="h-1 overflow-hidden rounded-sm bg-brand-hairline">
          <View
            className="h-full rounded-sm bg-brand-blue-vivid"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Henüz dosya seçilmemişken: kesikli çerçeveli "PDF seç" alanı. */
export function PickFileCard({ onPick }: { onPick: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="PDF seç"
      onPress={onPick}
      className="mt-3.5 items-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-[#B7BCD6] bg-white px-4 py-7"
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-lavender">
        <FileUp size={24} color="#1928B4" />
      </View>
      <Text className="text-base font-bold text-brand-ink">PDF seç</Text>
      <Text className="text-center text-[13px] text-brand-ink-soft">
        Dosyalar, iCloud Drive veya Google Drive'dan bir PDF seç.
      </Text>
    </Pressable>
  );
}
