import { Pressable, Text, View } from "react-native";
import { formatDuration } from "@/lib/format";
import type { ListDocumentApiResponse } from "@/networks/api/documents/documents";

export type LibraryDocument = NonNullable<ListDocumentApiResponse["Data"]>[number];
type DocumentStatus = NonNullable<LibraryDocument["status"]>["raw"];

const PILLS: Record<"ready" | "working" | "queued" | "partial" | "failed", { label: string; bg: string; fg: string }> = {
  ready: { label: "Hazır", bg: "#EEF0FB", fg: "#1928B4" },
  working: { label: "İşleniyor", bg: "#E6E9FF", fg: "#2D40E5" },
  queued: { label: "Sırada", bg: "#F1F2F6", fg: "#575C7A" },
  partial: { label: "Kısmen hazır", bg: "#FFF1E6", fg: "#B54708" },
  failed: { label: "Okunamadı", bg: "#FDECEF", fg: "#D92D45" },
};

function pillFor(status: DocumentStatus | undefined) {
  switch (status) {
    case "READY":
      return PILLS.ready;
    case "PARTIAL":
      return PILLS.partial;
    case "FAILED":
      return PILLS.failed;
    case "QUEUED":
      return PILLS.queued;
    default:
      return PILLS.working;
  }
}

/** Durum satırının yanındaki açıklama. */
function metaFor(document: LibraryDocument): string {
  const { sections } = document;
  switch (document.status?.raw) {
    case "READY":
      return document.totalDurationMs
        ? `${sections.total} bölüm · ${formatDuration(document.totalDurationMs)}`
        : `${sections.total} bölüm`;
    case "PARTIAL":
      return `${sections.failed} bölüm seslendirilemedi`;
    case "FAILED":
      return document.failureReason ?? "PDF işlenemedi";
    case "QUEUED":
      return `${document.pageCount} sayfa · birazdan başlar`;
    default:
      return sections.total > 0
        ? `%${document.progressPercent} · ${sections.ready}/${sections.total} bölüm dinlenebilir`
        : `%${document.progressPercent} · metin hazırlanıyor`;
  }
}

const PROCESSING: (DocumentStatus | undefined)[] = ["EXTRACTING", "SCRIPTING", "SYNTHESIZING"];

export function isDocumentInFlight(document: LibraryDocument): boolean {
  return document.status?.raw === "QUEUED" || PROCESSING.includes(document.status?.raw);
}

export function DocumentRow({
  document,
  onPress,
}: {
  document: LibraryDocument;
  onPress: () => void;
}) {
  const status = document.status?.raw;
  const pill = pillFor(status);
  const listenable = status === "READY" || status === "PARTIAL";
  const thumbBg = listenable ? "bg-brand-indigo" : "bg-brand-surface";
  const thumbFg = listenable ? "bg-white" : "bg-brand-accent";
  const meta = metaFor(document);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${document.title}. ${pill.label}. ${meta}`}
      onPress={onPress}
      className="flex-row items-center gap-3.5 border-b border-[#EEF0F7] py-3.5"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className={`h-14 w-[46px] justify-end gap-1 rounded-[10px] p-2 ${thumbBg}`}>
        <View className={`h-1 w-[80%] rounded-sm ${thumbFg}`} />
        <View className={`h-1 w-full rounded-sm opacity-50 ${thumbFg}`} />
        <View className={`h-1 w-[60%] rounded-sm opacity-50 ${thumbFg}`} />
      </View>

      <View className="min-w-0 flex-1 gap-1.5">
        <Text numberOfLines={1} className="text-base font-bold text-brand-ink">
          {document.title}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: pill.bg }}>
            <Text className="text-xs font-bold" style={{ color: pill.fg }}>
              {pill.label}
            </Text>
          </View>
          <Text numberOfLines={1} className="flex-1 text-[13px] text-brand-ink-soft">
            {meta}
          </Text>
        </View>
        {PROCESSING.includes(status) ? (
          <View className="h-1 overflow-hidden rounded-sm bg-brand-hairline">
            <View
              className="h-full rounded-sm bg-brand-blue-vivid"
              style={{ width: `${document.progressPercent}%` }}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
