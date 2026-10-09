import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  useQueryClient,
} from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";

let isReactNativeQueryConfigured = false;

/**
 * React Native için AppState durumunu TanStack Query'nin `focusManager`ına bağlar.
 * Web platformunda browser zaten window focus'u kendisi yönetir.
 */
export function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

/**
 * https://tanstack.com/query/latest/docs/framework/react/react-native
 *
 * 1. Online status management: NetInfo ile onlineManager'ı dinler.
 * 2. App focus management: AppState 'change' ile focusManager'ı günceller.
 *
 * Uygulama başında bir kez çağrılır.
 */
export function setupReactNativeQuery(): () => void {
  if (isReactNativeQueryConfigured) {
    return () => {};
  }
  isReactNativeQueryConfigured = true;

  // 1. Online Manager Setup (NetInfo)
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });

  // 2. App State Focus Setup
  const appStateSubscription = AppState.addEventListener(
    "change",
    onAppStateChange
  );

  return () => {
    appStateSubscription.remove();
    isReactNativeQueryConfigured = false;
  };
}

/**
 * React Native ekranı tekrar odaklandığında (Screen Focus) stale query'leri
 * veya verilen refetch fonksiyonunu çalıştıran hook.
 *
 * TanStack Query React Native dokümantasyonundaki resmi `useRefreshOnFocus` kalıbı:
 * İlk render (mount) atlanır çünkü `useFocusEffect` mount anında da tetiklenir.
 *
 * @param refetch İsteğe bağlı özel refetch fonksiyonu. Verilmezse aktif ve bayat (stale) tüm query'ler yenilenir.
 */
export function useRefreshOnFocus<T = unknown>(
  refetch?: () => Promise<T> | void
) {
  const queryClient = useQueryClient();
  const firstTimeRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        return;
      }

      if (refetch) {
        void refetch();
      } else {
        void queryClient.refetchQueries({
          stale: true,
          type: "active",
        });
      }
    }, [queryClient, refetch])
  );
}

/**
 * Belirli queryKey'leri ekran odağına girdiğinde refetch etmek için yardımcı hook.
 */
export function useRefreshQueryKeysOnFocus(queryKeys: Array<readonly unknown[]>) {
  const queryClient = useQueryClient();
  const firstTimeRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        return;
      }

      for (const queryKey of queryKeys) {
        void queryClient.refetchQueries({
          queryKey,
          stale: true,
          type: "active",
        });
      }
    }, [queryClient, queryKeys])
  );
}
