import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  setupReactNativeQuery,
  createCraftClient,
  type CraftClient,
} from "@tanstack-query-craft";

/**
 * React Native için varsayılan QueryClient yapılandırması.
 *
 * Mobil cihazlarda:
 * - AppState ile focus yönetimi (setupReactNativeQuery)
 * - NetInfo ile offline/online yönetimi (setupReactNativeQuery)
 * - Mobil ağ tasarrufu için 2 dakikalık varsayılan staleTime
 */
export const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: Platform.OS === "web",
    },
  },
});

/**
 * Global singleton craft client.
 * Bileşen dışından (ör. background sync, network interceptor vb.)
 * tipli cache operasyonları için kullanılabilir.
 */
export const craftClient: CraftClient = createCraftClient(defaultQueryClient);

export interface QueryProviderProps {
  children: React.ReactNode;
  client?: QueryClient;
}

/**
 * https://tanstack.com/query/latest/docs/framework/react/react-native
 *
 * Uygulamanın root seviyesinde TanStack Query ortamını ve
 * React Native'e özel AppState + NetInfo dinleyicilerini kurar.
 */
export function QueryProvider({
  children,
  client = defaultQueryClient,
}: QueryProviderProps) {
  useEffect(() => {
    const cleanup = setupReactNativeQuery();
    return () => cleanup();
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
