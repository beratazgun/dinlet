import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { PlayGlyph } from "@/components/store";
import { usePlayer } from "@/context";
import { useSamplePlayer } from "@/hooks/use-sample-player";
import { formatDuration } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { purchaseProduct, showPurchaseUnavailable } from "@/lib/purchases";
import { splitCategories } from "@/lib/store-format";
import { getDocumentApi } from "@/networks/api/documents/documents";
import type { GetItemApiResponse } from "@/networks/api/store/store";

type ItemDetail = NonNullable<GetItemApiResponse["Data"]>;

function FeatureChips({ item, inverse }: { item: ItemDetail; inverse: boolean }) {
  const chips = inverse
    ? [
        `${item.sectionCount} bölüm`,
        item.rewriteMode?.raw === "FLUENT" ? "Akıcı anlatım" : "Düz okuma",
        item.questionCount > 0 ? "Bölüm sonu soruları" : null,
        item.hasQuickVersion ? "Hızlı tekrar" : null,
      ]
    : [
        item.rewriteMode?.raw === "FLUENT" ? "Tam anlatım" : "Düz okuma",
        item.hasQuickVersion ? "Hızlı tekrar sürümü" : null,
        item.questionCount > 0 ? `${item.questionCount} sesli soru` : null,
        "Metin görünümü",
      ];
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {chips.filter(Boolean).map((chip) => (
        <View
          key={chip}
          className="rounded-full px-[9px] py-[5px]"
          style={{ backgroundColor: inverse ? "rgba(255,255,255,0.14)" : "#EEF0FB" }}
        >
          <Text className="text-xs font-bold" style={{ color: inverse ? "#FFFFFF" : "#1928B4" }}>
            {chip}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Pakette daha uygun" kartları (sahip olunmayan ücretli içerikte). */
function BundleOffers({ item }: { item: ItemDetail }) {
  if (item.isOwned || item.bundles.length === 0) return null;
  return (
    <View className="mt-4 gap-2">
      {item.bundles.map((bundle) => (
        <Pressable
          key={bundle.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/store/bundles/[id]", params: { id: String(bundle.id) } })
          }
          className="flex-row items-center gap-3 rounded-2xl bg-brand-lavender p-3.5"
        >
          <View className="flex-1 gap-0.5">
            <Text className="text-[11px] font-extrabold tracking-[0.66px] text-brand-indigo">
              PAKETTE DAHA UYGUN
            </Text>
            <Text className="text-[15px] font-bold text-brand-ink">{bundle.title}</Text>
            <Text className="text-xs text-brand-muted">
              {`${bundle.itemCount} içerik · ${bundle.sectionCount} bölüm`}
            </Text>
          </View>
          <Text className="text-sm font-extrabold text-brand-indigo">
            {bundle.price?.display ?? "İncele"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Mağaza içeriği. Ücretsiz içerik koyu başlıklı "Kütüphaneme ekle"
 * görünümü; ücretli içerik kapaklı, kilitli içindekiler ve "Satın al".
 */
export default function StoreItemScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = Number(params.id);
  const query = useCraftQuery("store", "getItem", [{ id: itemId }], {
    refetchOnScreenFocus: true,
  });
  const addItem = useCraftMutation("store", "addItem");
  const sample = useSamplePlayer();
  const [buying, setBuying] = useState(false);
  const [startingPlayback, setStartingPlayback] = useState(false);

  const item = query.data?.data;

  const refreshAfterAdd = () => {
    void queryClient.invalidateQueries({ queryKey: ["store"] });
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const addToLibrary = () =>
    new Promise<boolean>((resolve) =>
      addItem.mutate(
        { id: itemId },
        {
          onSuccess: () => {
            refreshAfterAdd();
            resolve(true);
          },
          onError: (error) => {
            Alert.alert("Eklenemedi", getApiErrorMessage(error));
            resolve(false);
          },
        }
      )
    );

  const buy = async () => {
    if (!item?.productId) return;
    setBuying(true);
    try {
      const result = await purchaseProduct(item.productId);
      if (result === "unavailable") {
        showPurchaseUnavailable();
        return;
      }
      if (result === "purchased") await addToLibrary();
    } finally {
      setBuying(false);
    }
  };

  const startListening = async (documentId: number) => {
    setStartingPlayback(true);
    try {
      const document = (await getDocumentApi({ id: documentId })).data;
      if (!document) return;
      sample.stop();
      await player.playDocumentSection(document, 0);
      router.push("/player");
    } catch (error) {
      Alert.alert("Açılamadı", getApiErrorMessage(error));
    } finally {
      setStartingPlayback(false);
    }
  };

  const openDocument = (documentId: number) =>
    router.push({ pathname: "/documents/[id]", params: { id: String(documentId) } });

  if (query.isPending || !item) {
    return (
      <View
        className="flex-1 bg-brand-offwhite px-5"
        style={{ paddingTop: Math.max(insets.top + 8, 56) }}
      >
        <StatusBar style="dark" />
        <BackButton onPress={() => router.back()} />
        {query.isPending ? (
          <View className="items-center py-24">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : (
          <FormError>{getApiErrorMessage(query.error)}</FormError>
        )}
      </View>
    );
  }

  const { exams, subjects } = splitCategories(item);
  const footerPadding = Math.max(insets.bottom + 16, 32);

  /* ─────────────────────────── Ücretsiz içerik ─────────────────────────── */
  if (item.isFree) {
    return (
      <View className="flex-1 bg-brand-offwhite">
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
          <View
            className="gap-2.5 bg-brand-blue-deep px-5 pb-[22px]"
            style={{ paddingTop: Math.max(insets.top + 8, 56) }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => router.back()}
              className="-ml-2.5 h-11 w-11 items-center justify-center"
            >
              <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
            <View className="self-start rounded-md bg-[rgba(255,255,255,0.14)] px-2 py-1">
              <Text className="text-[11px] font-extrabold tracking-[0.66px] text-white">
                {[item.source?.display, item.credit]
                  .filter(Boolean)
                  .join(" · ")
                  .toLocaleUpperCase("tr-TR")}
              </Text>
            </View>
            <Text
              accessibilityRole="header"
              className="font-display text-[28px] leading-[30px] tracking-[-0.84px] text-white"
            >
              {item.title}
            </Text>
            <FeatureChips item={item} inverse />
          </View>

          <View className="px-5 pt-4">
            <Text className="text-sm leading-[21px] text-brand-body">{item.description}</Text>
            <Text className="mb-0.5 mt-4 text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
              Bölümler
            </Text>
            {item.sections.map((section) => {
              const key = `section-${section.order}`;
              const playing = sample.playingKey === key;
              return (
                <View
                  key={section.order}
                  className="min-h-[52px] flex-row items-center gap-3 border-b border-[#EEF0F7] py-[9px]"
                >
                  <Text className="w-7 text-[13px] font-extrabold text-brand-muted">
                    {String(section.order).padStart(2, "0")}
                  </Text>
                  <View className="min-w-0 flex-1 gap-px">
                    <Text className="text-[15px] font-semibold text-brand-ink">{section.title}</Text>
                    {section.durationMs ? (
                      <Text className="text-xs text-brand-muted">
                        {formatDuration(section.durationMs)}
                      </Text>
                    ) : null}
                  </View>
                  {section.isSample && section.audioUrl ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={playing ? "Örneği durdur" : `Örnek dinle: ${section.title}`}
                      onPress={() => void sample.toggle(key, section.audioUrl)}
                      className="h-8 flex-row items-center gap-1 rounded-[10px] bg-brand-surface px-2.5"
                    >
                      <PlayGlyph size={11} color="#1928B4" playing={playing} />
                      <Text className="text-xs font-extrabold text-brand-indigo">
                        {playing ? "Durdur" : "Örnek"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 gap-2 border-t border-[#E9EBF5] bg-white px-5 pt-3.5"
          style={{ paddingBottom: footerPadding }}
        >
          {item.libraryDocumentId ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => openDocument(item.libraryDocumentId!)}
              className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-surface"
            >
              <Check size={18} color="#1928B4" strokeWidth={2.6} />
              <Text className="text-[17px] font-bold text-brand-indigo">Kütüphanende · Aç</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={addItem.isPending}
              onPress={() => void addToLibrary()}
              className="h-14 items-center justify-center rounded-2xl bg-brand-indigo"
              style={({ pressed }) => ({ opacity: pressed || addItem.isPending ? 0.85 : 1 })}
            >
              {addItem.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[17px] font-bold text-white">
                  Kütüphaneme ekle · Ücretsiz
                </Text>
              )}
            </Pressable>
          )}
          <Text className="text-center text-xs text-brand-muted">Sayfa hakkından düşmez.</Text>
        </View>
      </View>
    );
  }

  /* ─────────────────────────── Ücretli içerik ─────────────────────────── */
  const overline = [exams[0]?.name, subjects[0]?.name, item.source?.display]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: 190,
        }}
      >
        <BackButton onPress={() => router.back()} />
        <View className="mt-1 flex-row gap-3.5">
          <View className="h-24 w-[76px] justify-end rounded-2xl bg-brand-indigo p-3">
            <View className="flex-row items-end gap-[3px]">
              {[12, 26, 18, 32].map((height, index) => (
                <View
                  key={index}
                  className="w-1 rounded-sm"
                  style={{ height, backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#96A6F9" }}
                />
              ))}
            </View>
          </View>
          <View className="flex-1 gap-1.5">
            <Text className="text-xs font-bold text-brand-ink-soft">{overline}</Text>
            <Text
              accessibilityRole="header"
              className="font-display text-2xl leading-[26px] tracking-[-0.48px] text-brand-ink"
            >
              {item.title}
            </Text>
            <Text className="text-[13px] text-brand-ink-soft">
              {[
                `${item.sectionCount} bölüm`,
                item.totalDurationMs ? formatDuration(item.totalDurationMs) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        <View className="mt-3.5">
          <FeatureChips item={item} inverse={false} />
        </View>
        <Text className="mt-3.5 text-sm leading-[21px] text-brand-body">{item.description}</Text>

        <Text className="mb-0.5 mt-4 text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
          İçindekiler
        </Text>
        {item.sections.map((section) => {
          const key = `section-${section.order}`;
          const playing = sample.playingKey === key;
          const locked = !item.isOwned && !section.isSample;
          return (
            <View
              key={section.order}
              className="min-h-11 flex-row items-center gap-3 border-b border-[#EEF0F7] py-2"
            >
              <Text className="w-6 text-xs font-extrabold text-brand-muted">
                {String(section.order).padStart(2, "0")}
              </Text>
              <Text className="flex-1 text-sm font-semibold text-brand-ink">{section.title}</Text>
              {section.isSample && section.audioUrl && !item.isOwned ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={playing ? "Örneği durdur" : `Ücretsiz dinle: ${section.title}`}
                  onPress={() => void sample.toggle(key, section.audioUrl)}
                  hitSlop={8}
                  className="flex-row items-center gap-1 py-1.5"
                >
                  <PlayGlyph size={11} color="#1928B4" playing={playing} />
                  <Text className="text-xs font-extrabold text-brand-indigo">
                    {playing ? "Durdur" : "Ücretsiz dinle"}
                  </Text>
                </Pressable>
              ) : null}
              {locked ? (
                <Lock size={14} color="#8A8FAD" strokeWidth={2.2} accessibilityLabel="Kilitli" />
              ) : null}
            </View>
          );
        })}

        <BundleOffers item={item} />
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 gap-2 border-t border-[#E9EBF5] bg-white px-5 pt-3.5"
        style={{ paddingBottom: footerPadding }}
      >
        {!item.isOwned ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={buying || addItem.isPending}
              onPress={() => void buy()}
              className="h-14 items-center justify-center rounded-2xl bg-brand-indigo"
              style={({ pressed }) => ({ opacity: pressed || buying ? 0.85 : 1 })}
            >
              {buying || addItem.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[17px] font-bold text-white">
                  {item.price ? `Satın al · ${item.price.display}` : "Satın al"}
                </Text>
              )}
            </Pressable>
            <Text className="text-center text-xs leading-[17px] text-brand-muted">
              Tek seferlik ödeme, App Store / Google Play hesabından. Sayfa hakkından düşmez.
            </Text>
          </>
        ) : item.libraryDocumentId ? (
          <>
            <View className="flex-row items-center gap-2.5">
              <Check size={20} color="#1928B4" strokeWidth={2.6} />
              <Text className="text-sm font-bold text-brand-indigo">Kütüphanende</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => openDocument(item.libraryDocumentId!)}
                className="h-[52px] flex-1 items-center justify-center rounded-2xl bg-brand-lavender"
              >
                <Text className="text-[15px] font-bold text-brand-indigo">Notu aç</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={startingPlayback}
                onPress={() => void startListening(item.libraryDocumentId!)}
                className="h-[52px] flex-1 items-center justify-center rounded-2xl bg-brand-indigo"
              >
                {startingPlayback ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-[15px] font-bold text-white">Dinlemeye başla</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={addItem.isPending}
              onPress={() => void addToLibrary()}
              className="h-14 items-center justify-center rounded-2xl bg-brand-indigo"
            >
              {addItem.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[17px] font-bold text-white">Kütüphaneme ekle</Text>
              )}
            </Pressable>
            <Text className="text-center text-xs text-brand-muted">
              Bu içeriğe sahipsin; kütüphanenden kaldırdıysan yeniden ekleyebilirsin.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
