import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { AudioLines, Pause, Play, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "@/context/player-context";

/**
 * Sayfalar arası dolaşırken çalan sesi yönetmeyi sağlayan yüzen mini oynatıcı.
 * Tam ekran oynatıcı ve quiz ekranları haricinde tüm sayfalarda görünür.
 */
export function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const player = usePlayer();

  const {
    currentDocument,
    currentSection,
    currentSectionIndex,
    isPlaying,
    isLoading,
    isBuffering,
    positionMs,
    durationMs,
    togglePlayPause,
    closeSession,
    outroLabel,
  } = player;

  // Aktif bir dinleme oturumu yoksa render edilmez
  if (!currentDocument || !currentSection) {
    return null;
  }

  // Tam ekran oynatıcı veya quiz açıkken mini oynatıcı gizlenir
  const isPlayerScreen =
    pathname === "/player" ||
    pathname === "/(app)/player" ||
    pathname.endsWith("/player");
  const isQuizScreen =
    pathname === "/quiz" ||
    pathname === "/(app)/quiz" ||
    pathname.endsWith("/quiz");

  if (isPlayerScreen || isQuizScreen) {
    return null;
  }

  // Alt sekme menüsünün olduğu sayfalar (Kütüphane, Tekrar, İndirilenler, Hesap)
  const isTabScreen =
    pathname === "/" ||
    pathname === "/review" ||
    pathname === "/downloads" ||
    pathname === "/account" ||
    pathname.startsWith("/(tabs)");

  // Sekme çubuğu yüksekliği: ~56px + safeArea bottom + padding
  const tabBarHeight = 56 + Math.max(insets.bottom, 12);
  const bottomOffset = isTabScreen
    ? tabBarHeight + 8
    : Math.max(insets.bottom + 8, 16);

  const progressRatio =
    durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  const sectionLabel = outroLabel
    ? outroLabel
    : `${currentSectionIndex + 1}. ${currentSection.title || "Bölüm"}`;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 z-40 px-3.5"
      style={{ bottom: bottomOffset }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Oynatıcıyı aç: ${currentDocument.title}`}
        onPress={() => router.push("/(app)/player")}
        className="overflow-hidden rounded-2xl border border-[#E2E6F5] bg-white shadow-lg shadow-black/15 active:opacity-95"
      >
        {/* Üst İlerleme Çizgisi */}
        <View className="h-[2.5px] w-full bg-[#EEF0FB]">
          <View
            className="h-full bg-brand-indigo"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </View>

        {/* Ana İçerik */}
        <View className="flex-row items-center gap-2.5 px-3 py-2">
          {/* Sol İkon Rozeti */}
          <View
            className={`h-10 w-10 items-center justify-center rounded-xl ${
              isPlaying ? "bg-brand-indigo/10" : "bg-black/5"
            }`}
          >
            <AudioLines
              size={18}
              strokeWidth={2.4}
              color={isPlaying ? "#1928B4" : "#8E94B8"}
            />
          </View>

          {/* Başlık ve Bölüm Bilgisi */}
          <View className="flex-1 justify-center pr-1">
            <Text
              numberOfLines={1}
              className="text-[13px] font-bold text-brand-ink"
            >
              {currentDocument.title}
            </Text>
            <Text
              numberOfLines={1}
              className={`text-xs ${
                outroLabel
                  ? "font-bold text-brand-indigo"
                  : "font-medium text-brand-ink-soft"
              }`}
            >
              {sectionLabel}
            </Text>
          </View>

          {/* Sağ Aksiyon Butonları */}
          <View className="flex-row items-center gap-1">
            {/* Oynat / Duraklat Butonu */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Duraklat" : "Oynat"}
              hitSlop={6}
              onPress={(e) => {
                e.stopPropagation?.();
                void togglePlayPause();
              }}
              className="h-9 w-9 items-center justify-center rounded-full bg-brand-indigo active:opacity-80"
            >
              {isLoading || isBuffering ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : isPlaying ? (
                <Pause size={15} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={15} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </Pressable>

            {/* Kapat Butonu */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Oynatıcıyı kapat"
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                void closeSession();
              }}
              className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
            >
              <X size={16} strokeWidth={2.2} color="#8E94B8" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
