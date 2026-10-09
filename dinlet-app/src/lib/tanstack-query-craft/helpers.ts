/** biome-ignore-all lint/suspicious/noExplicitAny: registry generic'leri için any zorunlu */
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { moduleRegistry } from "./registry";
import type {
  AnyQueryDefinition,
  ExtractArgs,
  ExtractResult,
  FactoryOrValue,
  GetModuleItem,
  InfiniteQueryDefinition,
  KindBrand,
  ModuleDefinition,
  ModuleKeys,
  MutationDefinition,
  MutationsMap,
  QueriesMap,
  QueryDefinition,
  QueryFactory,
  QueryKeysOf,
  SuspenseInfiniteQueryDefinition,
  SuspenseQueryDefinition,
  TanstackQueryCraftRegistry,
} from "./types";

/**
 * `TOptions` üzerinden options objesinin *literal* tipini koruyoruz.
 *
 * Doğrudan `options: QueryDefinition<TQueryFnData, TData>` yazıldığında TData
 * için hiçbir inference sitesi bulunmadığından (select/initialData yoksa) TData
 * `any`'ye düşüyor ve tüm `data` tipleri sessizce `any` oluyordu. Literal tipi
 * koruyunca hem queryFn'in dönüşü hem varsa `select` doğru çözülüyor; queryKey
 * de daralmış hâlde kalıyor.
 */
export function defineQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TOptions extends QueryDefinition<TQueryFnData, TData> = QueryDefinition<
    TQueryFnData,
    TData
  >,
>(options: TOptions): TOptions & KindBrand<"query"> {
  return options;
}

export function defineSuspenseQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TOptions extends SuspenseQueryDefinition<TQueryFnData, TData> =
    SuspenseQueryDefinition<TQueryFnData, TData>,
>(options: TOptions): TOptions & KindBrand<"suspenseQuery"> {
  return options;
}

export function defineInfiniteQuery<
  TQueryFnData = unknown,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: InfiniteQueryDefinition<TQueryFnData, TData, TQueryKey, TPageParam>
): InfiniteQueryDefinition<TQueryFnData, TData, TQueryKey, TPageParam> {
  return options;
}

export function defineSuspenseInfiniteQuery<
  TQueryFnData = unknown,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: SuspenseInfiniteQueryDefinition<
    TQueryFnData,
    TData,
    TQueryKey,
    TPageParam
  >
): SuspenseInfiniteQueryDefinition<TQueryFnData, TData, TQueryKey, TPageParam> {
  return options;
}

export function defineMutation<TData = unknown, TVariables = void>(
  options: MutationDefinition<TData, TVariables>
): MutationDefinition<TData, TVariables> {
  return options;
}

/**
 * Argüman alan query tanımına, ürettiği key'lerin ortak statik önekini
 * (`baseKey`) iliştirir. Argümansız `invalidate` factory'yi çağırmadan bu öneki
 * kullanır; aksi hâlde zorunlu argüman bekleyen factory patlar ya da
 * `[..., undefined]` gibi hiçbir şeyle eşleşmeyen bir key üretir.
 */
export function defineQueryFactory<
  TArgs extends any[],
  TDefinition extends AnyQueryDefinition,
>(
  baseKey: QueryKey,
  factory: (...args: TArgs) => TDefinition
): QueryFactory<TArgs, TDefinition> {
  return Object.assign(factory, { baseKey });
}

/**
 * Modül adları benzersizdir; HMR veya Fast Refresh sırasında aynı adın
 * yeniden kaydı güvenle karşılanır.
 */
export function defineModule<
  TQueries extends QueriesMap,
  TMutations extends MutationsMap,
>(
  moduleName: string,
  definition: ModuleDefinition<TQueries, TMutations>
): ModuleDefinition<TQueries, TMutations> {
  moduleRegistry.set(moduleName, definition);
  return definition;
}

export function isQueryDefinition(obj: unknown): obj is AnyQueryDefinition {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "queryKey" in obj &&
    Array.isArray((obj as Record<string, unknown>).queryKey)
  );
}

/**
 * Brand yalnız tip düzeyinde var; runtime'da infinite tanımı TanStack'in
 * zorunlu kıldığı `initialPageParam` alanından ayırt ediyoruz.
 */
export function isInfiniteQueryDefinition(
  obj: unknown
): obj is
  | InfiniteQueryDefinition<any, any, any, any>
  | SuspenseInfiniteQueryDefinition<any, any, any, any> {
  return isQueryDefinition(obj) && "initialPageParam" in obj;
}

export function getQueryFactoryBaseKey(item: unknown): QueryKey | undefined {
  if (typeof item !== "function" || !("baseKey" in item)) return undefined;
  return Array.isArray((item as Record<string, unknown>).baseKey)
    ? ((item as Record<string, unknown>).baseKey as QueryKey)
    : undefined;
}

export function resolveModuleItem(
  item: FactoryOrValue<any>,
  args: any[] = []
): any {
  if (typeof item === "function") {
    return item(...args);
  }
  return item;
}

function requireModule(moduleName: string): ModuleDefinition<any, any> {
  const module = moduleRegistry.get(moduleName);

  if (!module) {
    throw new Error(
      `[tanstack-query-craft] "${moduleName}" modülü kayıtlı değil. ` +
        `Modülün src/networks/index.ts içinde export edildiğinden ve ` +
        `uygulama başlangıcında \`import "@/networks"\` satırının ` +
        `bulunduğundan emin olun. Kayıtlı modüller: ${
          Array.from(moduleRegistry.keys()).join(", ") || "(yok)"
        }`
    );
  }

  return module;
}

export function getRegisteredModules<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends ModuleKeys<TModule>,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...args: ExtractArgs<TItem>
): ExtractResult<TItem> {
  const module = requireModule(moduleName as string);

  const item =
    module.queries?.[key as string] ?? module.mutations?.[key as string];

  if (!item) {
    throw new Error(
      `[tanstack-query-craft] "${String(moduleName)}" modülünde "${String(
        key
      )}" key'i bulunamadı.`
    );
  }

  return resolveModuleItem(item, args);
}

/**
 * Bir query'nin queryKey'ini döndürür.
 *
 * `setQueryData`, optimistic update ve manuel prefetch senaryolarında tüm
 * options objesini alıp `.queryKey` okumaya gerek kalmaz.
 */
export function getQueryKey<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey extends QueryKeysOf<TModule>,
  TItem = GetModuleItem<TModule, TKey>,
>(
  moduleName: TModule,
  key: TKey,
  ...args: ExtractArgs<TItem>
): ExtractResult<TItem> extends { queryKey: infer TQueryKey }
  ? TQueryKey
  : QueryKey {
  const module = requireModule(moduleName as string);
  const rawItem = module.queries?.[key as string];

  if (!rawItem) {
    throw new Error(
      `[tanstack-query-craft] "${String(moduleName)}" modülünde "${String(
        key
      )}" adlı bir query yok.`
    );
  }

  const config = resolveModuleItem(rawItem, args);

  if (!isQueryDefinition(config)) {
    throw new Error(
      `[tanstack-query-craft] "${String(moduleName)}.${String(
        key
      )}" bir queryKey içermiyor.`
    );
  }

  return config.queryKey as any;
}

export function listModules() {
  return Array.from(moduleRegistry.entries()).map(([moduleName, module]) => ({
    moduleName,
    queries: Object.keys(module.queries ?? {}),
    mutations: Object.keys(module.mutations ?? {}),
  }));
}
