import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { BottomPanel } from "@/components/ui/bottom-panel";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { GetCoverageApiResponse } from "@/networks/api/documents/documents";
import { getSectionApi } from "@/networks/api/sections/sections";

type Coverage = NonNullable<GetCoverageApiResponse["Data"]>;
type Missing = Coverage["missing"][number];

const RADIUS = 45;
const LENGTH = 2 * Math.PI * RADIUS;

const KIND_LABELS = { date: "Tarih", number: "Sayı", name: "Özel isim" } as const;

function Ring({ percent }: { percent: number }) {
  return (
    <View className="relative h-[104px] w-[104px]">
      <Svg width={104} height={104} viewBox="0 0 104 104">
        <Circle cx={52} cy={52} r={RADIUS} fill="none" stroke="#EEF0FB" strokeWidth={10} />
        <Circle
          cx={52}
          cy={52}
          r={RADIUS}
          fill="none"
          stroke="#1928B4"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${(LENGTH * percent) / 100} ${LENGTH}`}
          transform="rotate(-90 52 52)"
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="font-display text-[28px] text-brand-ink">%{percent}</Text>
      </View>
    </View>
  );
}

/** Ham notta terimi vurgular ("Notta göster"). */
function SourcePanel({
  visible,
  onClose,
  title,
  source,
  term,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  source: string | null;
  term: string;
}) {
  const lines = (source ?? "").split("\n").filter((line) => line.trim());
  return (
    <BottomPanel visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="mt-[18px] font-display text-xl text-brand-ink">
        {title}
      </Text>
      <Text className="mt-1 text-sm text-brand-ink-soft">PDF'ten çıkarılan ham not</Text>
      <ScrollView className="mt-3 max-h-[420px] rounded-2xl bg-brand-surface p-4">
        {source === null ? (
          <ActivityIndicator color="#1928B4" />
        ) : (
          lines.map((line, index) => {
            const at = line.toLocaleLowerCase("tr-TR").indexOf(term.toLocaleLowerCase("tr-TR"));
            return (
              <Text key={index} className="mb-2 text-sm leading-5 text-brand-body">
                {at < 0 ? (
                  line
                ) : (
                  <>
                    {line.slice(0, at)}
                    <Text className="bg-[#FFE3CF] font-bold text-[#5C4033]">
                      {line.slice(at, at + term.length)}
                    </Text>
                    {line.slice(at + term.length)}
                  </>
                )}
              </Text>
            );
          })
        )}
      </ScrollView>
    </BottomPanel>
  );
}

/** Kapsam güvencesi: nottaki tarih, sayı ve isimlerin anlatımda geçme oranı. */
export default function CoverageScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = Number(id);
  const coverage = useCraftQuery("documents", "getCoverage", [{ id: documentId }]);
  const regenerate = useCraftMutation("sections", "regenerate");
  const [regenerating, setRegenerating] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<{ item: Missing; text: string | null } | null>(null);

  const data = coverage.data?.data;

  async function openSource(item: Missing) {
    setSource({ item, text: null });
    try {
      const section = await getSectionApi({ id: item.sectionId });
      setSource({ item, text: section.data.sourceText });
    } catch (error) {
      setSource(null);
      Alert.alert("Not açılamadı", getApiErrorMessage(error));
    }
  }

  async function regenerateSection(sectionId: number) {
    try {
      await regenerate.mutateAsync({ id: sectionId });
      setRegenerating((current) => new Set(current).add(sectionId));
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (error) {
      Alert.alert("Yeniden üretilemedi", getApiErrorMessage(error));
    }
  }

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 8, 34),
        }}
      >
        <BackButton onPress={() => router.back()} />

        {coverage.isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : coverage.isError || !data ? (
          <FormError>{getApiErrorMessage(coverage.error)}</FormError>
        ) : (
          <>
            <View className="mt-1.5 flex-row items-center gap-[18px]">
              <Ring percent={data.percent} />
              <View className="flex-1 gap-1">
                <Text accessibilityRole="header" className="font-display text-2xl text-brand-ink">
                  Kapsam
                </Text>
                <Text className="text-sm leading-5 text-brand-ink-soft">
                  {data.total === 0
                    ? "Notunda ölçülecek tarih, sayı veya isim bulunmadı."
                    : `Notundaki ${data.total} bilginin ${data.covered}'i anlatımda geçiyor. Özet değil, tam anlatım.`}
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row gap-2">
              {(["date", "number", "name"] as const).map((kind) => {
                const tile = data.kinds[kind];
                const short = tile.covered < tile.total;
                return (
                  <View
                    key={kind}
                    className={`flex-1 gap-0.5 rounded-[14px] p-3 ${short ? "bg-[#FFF1E6]" : "bg-brand-lavender"}`}
                  >
                    <Text className={`font-display text-xl ${short ? "text-[#B54708]" : "text-brand-ink"}`}>
                      {tile.covered}/{tile.total}
                    </Text>
                    <Text className={`text-xs font-semibold ${short ? "text-[#5C4033]" : "text-brand-ink-soft"}`}>
                      {KIND_LABELS[kind]}
                    </Text>
                  </View>
                );
              })}
            </View>

            {data.missing.length > 0 ? (
              <>
                <Text className="mb-1.5 mt-[22px] text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
                  Anlatımda geçmeyenler{data.missingCount > data.missing.length ? ` (${data.missingCount})` : ""}
                </Text>
                {data.missing.map((item, index) => {
                  const pending = regenerating.has(item.sectionId);
                  return (
                    <View
                      key={`${item.sectionId}-${item.term}-${index}`}
                      className="mb-2.5 gap-2.5 rounded-2xl border-[1.5px] border-[#FBD9BC] bg-[#FFF6EE] p-3.5"
                    >
                      <View className="flex-row justify-between gap-2.5">
                        <Text className="flex-1 text-[15px] font-bold text-brand-ink">{item.term}</Text>
                        <Text className="text-xs font-semibold text-[#5C4033]">
                          Bölüm {item.sectionOrder}
                          {item.pageStart ? ` · s. ${item.pageStart}` : ""}
                        </Text>
                      </View>
                      <Text className="text-[13px] leading-[19px] text-[#5C4033]">“{item.snippet}”</Text>
                      <View className="flex-row gap-2">
                        {data.canRegenerate ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={pending}
                            onPress={() => void regenerateSection(item.sectionId)}
                            className={`h-[38px] justify-center rounded-[10px] px-3 ${pending ? "bg-[#E6C3A5]" : "bg-[#B54708]"}`}
                          >
                            <Text className="text-[13px] font-bold text-white">
                              {pending ? "Yeniden üretiliyor…" : "Bölümü yeniden üret"}
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void openSource(item)}
                          className="h-[38px] justify-center rounded-[10px] bg-white px-3"
                        >
                          <Text className="text-[13px] font-bold text-[#B54708]">Notta göster</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : data.total > 0 ? (
              <Text className="mt-6 text-center text-[15px] text-brand-ink-soft">
                Notundaki tüm tarih, sayı ve isimler anlatımda geçiyor.
              </Text>
            ) : null}

            <View className="min-h-6 flex-1" />
            <Text className="text-center text-xs leading-[18px] text-brand-muted">
              Kontrol, notundaki tarih, sayı ve özel isimlerin anlatımda geçip geçmediğine bakar.
            </Text>
          </>
        )}
      </ScrollView>

      <SourcePanel
        visible={source !== null}
        onClose={() => setSource(null)}
        title={source ? `Bölüm ${source.item.sectionOrder}: ${source.item.sectionTitle}` : ""}
        source={source?.text ?? null}
        term={source?.item.term ?? ""}
      />
    </View>
  );
}
