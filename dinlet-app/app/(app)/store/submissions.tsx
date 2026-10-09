import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { BackButton, FormError } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { ListMineApiResponse } from "@/networks/api/store/store";

type Submission = NonNullable<ListMineApiResponse["Data"]>[number];

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: "#FEF6E7", fg: "#B54708" },
  APPROVED: { bg: "#EEF0FB", fg: "#1928B4" },
  REJECTED: { bg: "#FEF3F2", fg: "#B42318" },
  WITHDRAWN: { bg: "#F4F5FD", fg: "#575C7A" },
};

/** "Paylaştıklarım": mağazaya gönderdiğin notlar ve durumları. */
export default function MySubmissionsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const query = useCraftQuery("store", "listMine", [{ limit: 100 }], {
    refetchOnScreenFocus: true,
  });
  const withdraw = useCraftMutation("store", "withdraw");
  const items = query.data?.data ?? [];

  const confirmWithdraw = (item: Submission) => {
    const approved = item.status?.raw === "APPROVED";
    Alert.alert(
      approved ? "Mağazadan kaldırılsın mı?" : "Başvuru geri çekilsin mi?",
      approved
        ? "Not mağazada görünmez olur. Daha önce ekleyenlerin kütüphanesinde kalır."
        : "Not incelemeden çıkar; istersen sonra yeniden gönderebilirsin.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: approved ? "Kaldır" : "Geri çek",
          style: "destructive",
          onPress: () =>
            withdraw.mutate(
              { id: item.id },
              {
                onSuccess: () => {
                  void queryClient.invalidateQueries({ queryKey: ["store"] });
                },
                onError: (error) => Alert.alert("Yapılamadı", getApiErrorMessage(error)),
              }
            ),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View className="mb-2">
            <BackButton onPress={() => router.back()} />
            <Text
              accessibilityRole="header"
              className="mb-1 mt-1.5 font-display text-[28px] tracking-[-0.84px] text-brand-ink"
            >
              Paylaştıklarım
            </Text>
            <Text className="text-sm leading-5 text-brand-ink-soft">
              Mağazaya gönderdiğin notlar. Paylaşmak için bir notun “…” menüsünden “Mağazada
              paylaş”ı seç.
            </Text>
            {query.isError ? (
              <View className="mt-3">
                <FormError>{getApiErrorMessage(query.error)}</FormError>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const status = item.status?.raw ?? "PENDING";
          const tone = STATUS_TONES[status] ?? STATUS_TONES.PENDING!;
          const open = status === "PENDING" || status === "APPROVED";
          return (
            <View className="gap-2 border-b border-[#EEF0F7] py-3.5">
              <View className="flex-row items-start gap-3">
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold text-brand-ink">{item.title}</Text>
                  <Text className="text-xs text-brand-muted">{item.createdAt?.display}</Text>
                </View>
                <View className="rounded-md px-2 py-1" style={{ backgroundColor: tone.bg }}>
                  <Text className="text-[11px] font-extrabold" style={{ color: tone.fg }}>
                    {item.status?.display}
                  </Text>
                </View>
              </View>
              {status === "REJECTED" && item.rejectionReason ? (
                <Text className="text-[13px] leading-[19px] text-[#7A271A]">
                  {item.rejectionReason}
                </Text>
              ) : null}
              {status === "PENDING" ? (
                <Text className="text-[13px] leading-[19px] text-brand-ink-soft">
                  Editörlerimiz inceliyor; sonuç bildirim olarak gelecek.
                </Text>
              ) : null}
              <View className="flex-row gap-4">
                {status === "APPROVED" && item.storeItemId ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      router.push({
                        pathname: "/store/items/[id]",
                        params: { id: String(item.storeItemId) },
                      })
                    }
                    className="py-1"
                  >
                    <Text className="text-sm font-bold text-brand-indigo">Mağazada gör</Text>
                  </Pressable>
                ) : null}
                {status === "REJECTED" && item.documentId ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      router.push({
                        pathname: "/store/share/[documentId]",
                        params: { documentId: String(item.documentId) },
                      })
                    }
                    className="py-1"
                  >
                    <Text className="text-sm font-bold text-brand-indigo">Yeniden gönder</Text>
                  </Pressable>
                ) : null}
                {open ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={withdraw.isPending}
                    onPress={() => confirmWithdraw(item)}
                    className="py-1"
                  >
                    <Text className="text-sm font-bold text-brand-danger">
                      {status === "APPROVED" ? "Mağazadan kaldır" : "Geri çek"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          query.isPending ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#1928B4" />
            </View>
          ) : query.isError ? null : (
            <Text className="py-12 text-center text-[15px] leading-[22px] text-brand-muted">
              Henüz paylaştığın bir not yok.
            </Text>
          )
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 56),
          paddingBottom: Math.max(insets.bottom + 24, 32),
        }}
      />
    </View>
  );
}
