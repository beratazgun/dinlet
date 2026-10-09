import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Laptop, Smartphone, Trash2 } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey, useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import { AuthButton, FormError } from "@/components/auth";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import type { ListSessionsApiResponse } from "@/networks/api/auth/auth";

type SessionItem = NonNullable<ListSessionsApiResponse["Data"]>[number];

function getDeviceLabel(ua?: string | null): { name: string; isMobile: boolean } {
  if (!ua) return { name: "Bilinmeyen Cihaz", isMobile: true };
  const lower = ua.toLowerCase();
  if (lower.includes("iphone")) return { name: "iPhone", isMobile: true };
  if (lower.includes("ipad")) return { name: "iPad", isMobile: true };
  if (lower.includes("android")) return { name: "Android Cihaz", isMobile: true };
  if (lower.includes("macintosh") || lower.includes("mac os")) return { name: "Mac", isMobile: false };
  if (lower.includes("windows")) return { name: "Windows PC", isMobile: false };
  if (lower.includes("linux")) return { name: "Linux Cihaz", isMobile: false };
  return { name: "Mobil Oturum", isMobile: true };
}

export function ActiveSessionsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const sessionsQuery = useCraftQuery("auth", "listSessions", [], {
    enabled: visible,
  });
  const terminateSessions = useCraftMutation("auth", "terminateSessions");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessions: SessionItem[] = sessionsQuery.data?.data ?? [];
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  async function handleTerminateOthers() {
    if (otherSessions.length === 0) return;
    setErrorMessage(null);
    try {
      await terminateSessions.mutateAsync({
        sessionIds: otherSessions.map((s) => s.id),
      });
      await queryClient.invalidateQueries({
        queryKey: getQueryKey("auth", "listSessions"),
      });
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={onClose}
          className="absolute inset-0 bg-[rgba(14,18,56,0.48)]"
        />
        <View
          accessibilityViewIsModal
          className="max-h-[80%] rounded-t-[28px] bg-white px-6 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom + 12, 36) }}
        >
          <View className="h-[5px] w-10 self-center rounded-[3px] bg-[#DDE0EE]" />

          <Text
            accessibilityRole="header"
            className="mb-1 mt-5 font-display text-[22px] font-extrabold tracking-[-0.44px] text-brand-ink"
          >
            Aktif Oturumlar
          </Text>
          <Text className="text-sm text-brand-ink-soft">
            Hesabına giriş yapılmış olan tüm cihazlar.
          </Text>

          {errorMessage ? (
            <View className="mt-3">
              <FormError>{errorMessage}</FormError>
            </View>
          ) : null}

          {sessionsQuery.isLoading ? (
            <View className="my-8 items-center justify-center">
              <ActivityIndicator color="#1928B4" />
            </View>
          ) : (
            <ScrollView className="mt-4" contentContainerStyle={{ gap: 10 }}>
              {sessions.map((session) => {
                const { name, isMobile } = getDeviceLabel(session.userAgent);
                return (
                  <View
                    key={session.id}
                    className="flex-row items-center justify-between rounded-2xl bg-brand-lavender p-3.5"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
                        {isMobile ? (
                          <Smartphone size={20} color="#1928B4" strokeWidth={2} />
                        ) : (
                          <Laptop size={20} color="#1928B4" strokeWidth={2} />
                        )}
                      </View>
                      <View className="gap-0.5">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-[15px] font-bold text-brand-ink">{name}</Text>
                          {session.isCurrent ? (
                            <View className="rounded bg-brand-surface px-1.5 py-0.5">
                              <Text className="text-[11px] font-bold text-brand-indigo">
                                Bu cihaz
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-xs text-brand-ink-soft">
                          {session.ipAddress ? `IP: ${session.ipAddress} · ` : ""}
                          {session.createdAt?.display ?? "Aktif"}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {otherSessions.length > 0 ? (
            <View className="mt-5">
              <AuthButton
                variant="outline"
                loading={terminateSessions.isPending}
                onPress={() => void handleTerminateOthers()}
              >
                Diğer oturumları kapat
              </AuthButton>
            </View>
          ) : (
            <View className="mt-5">
              <AuthButton variant="ghost" onPress={onClose}>
                Tamam
              </AuthButton>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
