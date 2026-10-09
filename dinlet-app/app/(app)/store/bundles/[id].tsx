import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { StoreCatalogRow } from "@/components/store";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { purchaseProduct, showPurchaseUnavailable } from "@/lib/purchases";

/** Paket: içindeki içerikler ve tek satın almayla hepsini kütüphaneye ekleme. */
export default function StoreBundleScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const bundleId = Number(params.id);
  const query = useCraftQuery("store", "getBundle", [{ id: bundleId }], {
    refetchOnScreenFocus: true,
  });
  const addBundle = useCraftMutation("store", "addBundle");
  const [buying, setBuying] = useState(false);
  const bundle = query.data?.data;

  const allInLibrary = bundle
    ? bundle.items.length > 0 && bundle.items.every((item) => item.libraryDocumentId)
    : false;

  const addAll = () =>
    addBundle.mutate(
      { id: bundleId },
      {
        onSuccess: (response) => {
          void queryClient.invalidateQueries({ queryKey: ["store"] });
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
          const added = response.data?.entries.filter((entry) => entry.isNew).length ?? 0;
          Alert.alert(
            "Kütüphanene eklendi",
            added > 0 ? `${added} içerik kütüphanende.` : "Paketteki içerikler zaten kütüphanende."
          );
        },
        onError: (error) => Alert.alert("Eklenemedi", getApiErrorMessage(error)),
      }
    );

  const buy = async () => {
    if (!bundle) return;
    setBuying(true);
    try {
      const result = await purchaseProduct(bundle.productId);
      if (result === "unavailable") showPurchaseUnavailable();
      else if (result === "purchased") addAll();
    } finally {
      setBuying(false);
    }
  };

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: 170,
        }}
      >
        <BackButton onPress={() => router.back()} />
        {query.isPending ? (
          <View className="items-center py-24">
            <ActivityIndicator color="#1928B4" />
          </View>
        ) : !bundle ? (
          <FormError>{getApiErrorMessage(query.error)}</FormError>
        ) : (
          <>
            <View className="mt-1 gap-2 rounded-[22px] bg-brand-indigo p-[18px]">
              <Text className="text-[11px] font-extrabold tracking-[0.66px] text-[#C9D0FD]">
                PAKET
              </Text>
              <Text
                accessibilityRole="header"
                className="font-display text-2xl leading-[26px] tracking-[-0.48px] text-white"
              >
                {bundle.title}
              </Text>
              <Text className="text-[13px] text-brand-mist">
                {`${bundle.itemCount} içerik · ${bundle.sectionCount} bölüm`}
              </Text>
            </View>
            <Text className="mt-3.5 text-sm leading-[21px] text-brand-body">
              {bundle.description}
            </Text>
            <Text className="mb-0.5 mt-4 text-[13px] font-bold uppercase tracking-[0.78px] text-brand-muted">
              Paketteki içerikler
            </Text>
            {bundle.items.map((item) => (
              <StoreCatalogRow key={item.id} item={item} />
            ))}
          </>
        )}
      </ScrollView>

      {bundle ? (
        <View
          className="absolute bottom-0 left-0 right-0 gap-2 border-t border-[#E9EBF5] bg-white px-5 pt-3.5"
          style={{ paddingBottom: Math.max(insets.bottom + 16, 32) }}
        >
          {bundle.isOwned && allInLibrary ? (
            <View className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-surface">
              <Check size={18} color="#1928B4" strokeWidth={2.6} />
              <Text className="text-[17px] font-bold text-brand-indigo">Hepsi kütüphanende</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={buying || addBundle.isPending}
              onPress={() => (bundle.isOwned ? addAll() : void buy())}
              className="h-14 items-center justify-center rounded-2xl bg-brand-indigo"
              style={({ pressed }) => ({ opacity: pressed || buying ? 0.85 : 1 })}
            >
              {buying || addBundle.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[17px] font-bold text-white">
                  {bundle.isOwned
                    ? "Hepsini kütüphaneme ekle"
                    : bundle.price
                      ? `Paketi satın al · ${bundle.price.display}`
                      : "Paketi satın al"}
                </Text>
              )}
            </Pressable>
          )}
          <Text className="text-center text-xs text-brand-muted">
            Tek seferlik ödeme, App Store / Google Play hesabından. Sayfa hakkından düşmez.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
