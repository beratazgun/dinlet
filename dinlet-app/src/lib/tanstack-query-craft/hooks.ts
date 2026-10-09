/** biome-ignore-all lint/suspicious/noExplicitAny: registry generic'leri için any zorunlu */
import { useCallback, useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type {
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  UseSuspenseInfiniteQueryOptions,
  UseSuspenseInfiniteQueryResult,
  UseSuspenseQueryOptions,
  UseSuspenseQueryResult,
} from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";

import { getQueryKey, getRegisteredModules } from "./helpers";
import { createCraftClient, type CraftClient } from "./invalidate-queries";
import { useRefreshOnFocus } from "./react-native";
import type {
  AppError,
  CraftKeysOfKind,
  ExtractArgs,
  ExtractResult,
  GetModuleItem,
  QueryDataOf,
  QueryFnDataOf,
  QueryKeysOf,
  TanstackQueryCraftRegistry,
} from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Kind'a göre tiplenmiş hook'lar (React Native Destekli)
 * ─────────────────────────────────────────────────────────────────────────
 * `useQuery({ ...getRegisteredModules(...) })` kalıbı çalışır ama bir
 * `defineSuspenseQuery` tanımının `useQuery`'ye verilmesini engellemez; iki
 * options tipi yapısal olarak uyumludur. Bu hook'lar key'i brand'ine göre
 * daralttığı için yanlış eşleşme derleme zamanında hata verir.
 *
 * Factory argümanları dizi olarak, TanStack override'ları son parametrede
 * verilir. Factory'nin zorunlu parametresi varsa argüman dizisi de zorunludur:
 *
 * ```ts
 * useCraftQuery("auth", "getMe")
 * useCraftQuery("job", "getJob", [{ code }])
 * useCraftQuery("auth", "getMe", [], { retry: false, refetchOnScreenFocus: true })
 * ```
 */

export type ReactNativeQueryExtraOptions = {
  /**
   * Ekran tekrar odaklandığında (React Navigation / Expo Router screen focus)
   * bu query'yi otomatik refetch eder.
   */
  refetchOnScreenFocus?: boolean;
};

type QueryOverrides<TItem> = Partial<
  UseQueryOptions<QueryFnDataOf<TItem>, AppError, QueryDataOf<TItem>>
> &
  ReactNativeQueryExtraOptions;

type SuspenseQueryOverrides<TItem> = Partial<
  UseSuspenseQueryOptions<QueryFnDataOf<TItem>, AppError, QueryDataOf<TItem>>
> &
  ReactNativeQueryExtraOptions;

type InfiniteOverrides<TItem> = Partial<
  UseInfiniteQueryOptions<QueryFnDataOf<TItem>, AppError, any, any, any>
> &
  ReactNativeQueryExtraOptions;

type SuspenseInfiniteOverrides<TItem> = Partial<
  UseSuspenseInfiniteQueryOptions<QueryFnDataOf<TItem>, AppError, any, any, any>
> &
  ReactNativeQueryExtraOptions;

type MutationOverrides<TItem> = Partial<
  Omit<
    UseMutationOptions<
      MutationSignature<TItem>["data"],
      AppError,
      MutationSignature<TItem>["variables"]
    >,
    "onMutate"
  >
>;

type HookParams<TItem, TOverrides> =
  [] extends ExtractArgs<TItem>
    ? [args?: ExtractArgs<TItem>, overrides?: TOverrides]
    : [args: ExtractArgs<TItem>, overrides?: TOverrides];

type MutationSignature<TItem> =
  ExtractResult<TItem> extends UseMutationOptions<
    infer TData,
    any,
    infer TVariables,
    any
  >
    ? { data: TData; variables: TVariables }
    : { data: unknown; variables: void };

function resolveDefinition(
  moduleName: string,
  key: string,
  args: unknown[] | undefined
): Record<string, any> {
  const resolve = getRegisteredModules as (...params: any[]) => unknown;
  return resolve(moduleName, key, ...(args ?? [])) as Record<string, any>;
}

type Callback = ((...args: any[]) => unknown) | undefined;

function chainCallbacks(first: Callback, second: Callback): Callback {
  if (!first || !second) return first ?? second;
  return async (...args: any[]) => {
    await first(...args);
    return second(...args);
  };
}

export function useCraftQuery<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends CraftKeysOfKind<TModule, "query">,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...[args, overrides]: HookParams<TItem, QueryOverrides<TItem>>
): UseQueryResult<QueryDataOf<TItem>, AppError> {
  const definition = resolveDefinition(moduleName, key as string, args);
  const { refetchOnScreenFocus, ...cleanOverrides } = overrides ?? {};

  const result = useQuery({ ...definition, ...cleanOverrides } as any) as any;

  if (refetchOnScreenFocus) {
    useRefreshOnFocus(result.refetch);
  }

  return result;
}

export function useCraftSuspenseQuery<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends CraftKeysOfKind<TModule, "suspenseQuery">,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...[args, overrides]: HookParams<TItem, SuspenseQueryOverrides<TItem>>
): UseSuspenseQueryResult<QueryDataOf<TItem>, AppError> {
  const definition = resolveDefinition(moduleName, key as string, args);
  const { refetchOnScreenFocus, ...cleanOverrides } = overrides ?? {};

  const result = useSuspenseQuery({ ...definition, ...cleanOverrides } as any) as any;

  if (refetchOnScreenFocus) {
    useRefreshOnFocus(result.refetch);
  }

  return result;
}

export function useCraftInfiniteQuery<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends CraftKeysOfKind<TModule, "infiniteQuery">,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...[args, overrides]: HookParams<TItem, InfiniteOverrides<TItem>>
): UseInfiniteQueryResult<QueryDataOf<TItem>, AppError> {
  const definition = resolveDefinition(moduleName, key as string, args);
  const { refetchOnScreenFocus, ...cleanOverrides } = overrides ?? {};

  const result = useInfiniteQuery({ ...definition, ...cleanOverrides } as any) as any;

  if (refetchOnScreenFocus) {
    useRefreshOnFocus(result.refetch);
  }

  return result;
}

export function useCraftSuspenseInfiniteQuery<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends CraftKeysOfKind<TModule, "suspenseInfiniteQuery">,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...[args, overrides]: HookParams<TItem, SuspenseInfiniteOverrides<TItem>>
): UseSuspenseInfiniteQueryResult<QueryDataOf<TItem>, AppError> {
  const definition = resolveDefinition(moduleName, key as string, args);
  const { refetchOnScreenFocus, ...cleanOverrides } = overrides ?? {};

  const result = useSuspenseInfiniteQuery({
    ...definition,
    ...cleanOverrides,
  } as any) as any;

  if (refetchOnScreenFocus) {
    useRefreshOnFocus(result.refetch);
  }

  return result;
}

export function useCraftMutation<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends CraftKeysOfKind<TModule, "mutation">,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...[args, overrides]: HookParams<TItem, MutationOverrides<TItem>>
): UseMutationResult<
  MutationSignature<TItem>["data"],
  AppError,
  MutationSignature<TItem>["variables"]
> {
  const definition = resolveDefinition(moduleName, key as string, args);

  return useMutation({
    ...definition,
    ...overrides,
    onSuccess: chainCallbacks(definition.onSuccess, overrides?.onSuccess),
    onError: chainCallbacks(definition.onError, overrides?.onError),
    onSettled: chainCallbacks(definition.onSettled, overrides?.onSettled),
  } as any) as any;
}

/**
 * Belirli bir craft query'sini ekran odağına girdiğinde (React Native screen focus)
 * refetch etmek için özelleştirilmiş hook.
 */
export function useCraftRefreshOnFocus<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends QueryKeysOf<TModule>,
  TItem = GetModuleItem<TModule, TKey>,
>(moduleName: TModule, key: TKey, ...args: ExtractArgs<TItem>) {
  const queryClient = useQueryClient();
  const firstTimeRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        return;
      }

      const queryKey = getQueryKey(moduleName, key as any, ...(args as any)) as readonly unknown[];
      void queryClient.refetchQueries({
        queryKey,
        stale: true,
        type: "active",
      });
    }, [queryClient, moduleName, key, JSON.stringify(args)])
  );
}

/**
 * Bileşenler içinde tipli cache kontrolü (`invalidate`, `fetch`, `setData` vb.)
 * yapmak için CraftClient'a erişim sağlayan hook.
 */
export function useCraftClient(): CraftClient {
  const queryClient = useQueryClient();
  const clientRef = useRef<CraftClient | null>(null);

  if (!clientRef.current || clientRef.current.queryClient !== queryClient) {
    clientRef.current = createCraftClient(queryClient);
  }

  return clientRef.current;
}

