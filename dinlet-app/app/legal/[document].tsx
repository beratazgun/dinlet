import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftQuery } from "@tanstack-query-craft";
import { AuthButton, BackButton, FormError, type LegalDocument } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";

/** "2026-10-01" → "1 Ekim 2026" */
function formatVersion(version: string) {
  const date = new Date(`${version}T00:00:00`);
  if (Number.isNaN(date.getTime())) return version;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Aydınlatma Metni, Kullanım Koşulları ve açık rıza metni. Metinler
 * backend'den gelir; sürüm, onay kaydına yazılan sürümle aynıdır. Oturum
 * olsun olmasın açılabilir.
 */
export default function LegalDocumentScreen() {
  const insets = useSafeAreaInsets();
  const { document } = useLocalSearchParams<{ document: LegalDocument }>();
  const query = useCraftQuery("legal", "getDocument", [{ document }], {
    staleTime: 1000 * 60 * 60,
  });
  const content = query.data?.data;

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 12, 60),
          paddingBottom: Math.max(insets.bottom + 12, 36),
        }}
      >
        <BackButton onPress={() => router.back()} />

        {query.isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : query.isError || !content ? (
          <View className="mt-6 gap-4">
            <FormError>{getApiErrorMessage(query.error)}</FormError>
            <AuthButton variant="ghost" onPress={() => void query.refetch()}>
              Tekrar dene
            </AuthButton>
          </View>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              className="mt-3 font-display text-[28px] leading-[31px] tracking-[-0.84px] text-brand-ink"
            >
              {content.title}
            </Text>
            <Text className="mt-1.5 text-sm text-brand-muted">
              Sürüm: {formatVersion(content.version)}
            </Text>

            <View className="mt-6 gap-6">
              {content.sections.map((section) => (
                <View key={section.heading} className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="font-display-bold text-lg text-brand-ink"
                  >
                    {section.heading}
                  </Text>
                  {section.body.map((paragraph, index) =>
                    paragraph.startsWith("• ") ? (
                      <View key={index} className="flex-row gap-2 pl-1">
                        <Text className="text-[15px] leading-[23px] text-brand-indigo">•</Text>
                        <Text className="flex-1 text-[15px] leading-[23px] text-brand-body">
                          {paragraph.slice(2)}
                        </Text>
                      </View>
                    ) : (
                      <Text key={index} className="text-[15px] leading-[23px] text-brand-body">
                        {paragraph}
                      </Text>
                    )
                  )}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
