/** biome-ignore-all lint/suspicious/noExplicitAny: registry generic'leri için any zorunlu */
import type {
  InvalidateQueryFilters,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

import {
  getQueryFactoryBaseKey,
  getQueryKey,
  getRegisteredModules,
  isInfiniteQueryDefinition,
  isQueryDefinition,
  resolveModuleItem,
} from "./helpers";
import { moduleRegistry } from "./registry";
import type {
  ExtractArgs,
  GetModuleItem,
  QueryCacheDataOf,
  QueryDataOf,
  QueryKeysOf,
  TanstackQueryCraftRegistry,
} from "./types";

type RefetchType = NonNullable<InvalidateQueryFilters["refetchType"]>;

const noop = () => {};

const isDev =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

/**
 * `TKey` bilerek kısıtlanmamıştır: `QueryKeysOf<TModule>` generic bir `TModule` üzerinde
 * çözülmemiş koşullu tip olarak kalır ve kısıtlama kontrolünü kırar. Key
 * daraltması, bu tipi kullanan fonksiyon imzalarında yapılır.
 */
export interface InvalidateOptions<
  TModule extends string = string,
  TKey = any,
> {
  /**
   * Query'nin factory argümanları (ör. path/query parametreleri). Verilmezse
   * factory query'lerde `baseKey` kullanılır, yani factory'nin ürettiği tüm
   * key'ler invalidate edilir.
   */
  args?: TModule extends keyof TanstackQueryCraftRegistry
    ? ExtractArgs<GetModuleItem<TModule, TKey>>
    : any[];
  /** queryKey'in son segmentini atarak üst seviyeyi invalidate eder. */
  asParent?: boolean;
  /** `asParent`ın genelleştirilmiş hâli: sondan kaç segment atılacağı. */
  depth?: number;
  /** Sadece tam eşleşen key'i invalidate eder. */
  exact?: boolean;
  /**
   * Varsayılan "all": global QueryClient'ta `refetchOnMount: false` olduğu için
   * pasif query'ler aksi hâlde bir sonraki mount'ta da yenilenmez.
   */
  refetchType?: RefetchType;
}

/** Geçerli (modül, key) çiftlerinin discriminated union'ı. */
export type InvalidateEntry = [keyof TanstackQueryCraftRegistry] extends [never]
  ? {
      moduleName: string;
      key: string;
      options?: InvalidateOptions<any, any>;
    }
  : {
      [TModule in keyof TanstackQueryCraftRegistry]: {
        [TKey in QueryKeysOf<TModule>]: {
          moduleName: TModule;
          key: TKey;
          options?: InvalidateOptions<TModule, TKey>;
        };
      }[QueryKeysOf<TModule>];
    }[keyof TanstackQueryCraftRegistry];

/**
 * QueryClient üzerine, modül + key sözleşmesiyle çalışan bir cache kontrol
 * katmanı kurar. queryKey'leri elle taşımadan invalidate/prefetch/setData
 * yapılmasını sağlar.
 */
export function createCraftClient(queryClient: QueryClient) {
  const resolveQueryKey = (
    moduleName: string,
    key: string,
    args: any[] = []
  ): QueryKey | null => {
    const module = moduleRegistry.get(moduleName);
    const rawItem = module?.queries?.[key];

    if (!rawItem) {
      if (isDev) {
        console.warn(
          `[tanstack-query-craft] "${moduleName}.${key}" bir query değil ` +
            `(mutation veya tanımsız). Invalidate atlandı.`
        );
      }
      return null;
    }

    // Argümansız factory çağrısı zorunlu parametrede patlar ya da
    // `[..., undefined]` gibi hiçbir cache girdisiyle eşleşmeyen bir key
    // üretir. Bu yüzden factory'yi hiç çağırmadan statik öneki kullanıyoruz.
    if (typeof rawItem === "function" && args.length === 0) {
      // Boş önek ([]) tüm cache ile eşleşir; onu da eksik sayıyoruz.
      const baseKey = getQueryFactoryBaseKey(rawItem);
      if (baseKey && baseKey.length > 0) return baseKey;

      if (isDev) {
        console.warn(
          `[tanstack-query-craft] "${moduleName}.${key}" bir factory ama ` +
            `\`baseKey\` içermiyor ve argüman verilmedi. Tanımı ` +
            `\`defineQueryFactory\` ile sarın ya da \`options.args\` verin. ` +
            `Invalidate atlandı.`
        );
      }
      return null;
    }

    const config = resolveModuleItem(rawItem, args);
    return isQueryDefinition(config) ? config.queryKey : null;
  };

  const narrowKey = (
    queryKey: QueryKey,
    options?: { asParent?: boolean; depth?: number }
  ): QueryKey => {
    const requested = options?.depth ?? (options?.asParent ? 1 : 0);
    if (requested <= 0) return queryKey;

    // Tamamen boşaltılmış bir queryKey ([]) tüm cache ile eşleşir. Kazara
    // "her şeyi invalidate et"e dönüşmemesi için en az bir segment bırakıyoruz.
    if (requested >= queryKey.length) {
      if (isDev) {
        console.warn(
          `[tanstack-query-craft] ${JSON.stringify(queryKey)} için istenen ` +
            `daraltma (${requested}) key uzunluğundan büyük; tüm cache'i ` +
            `invalidate etmemek için ilk segment korundu.`
        );
      }
      return queryKey.slice(0, 1);
    }

    return queryKey.slice(0, queryKey.length - requested);
  };

  const invalidateOne = (
    moduleName: string,
    key: string,
    options?: InvalidateOptions<any, any>
  ) => {
    const queryKey = resolveQueryKey(moduleName, key, options?.args);
    if (!queryKey) return Promise.resolve();

    return queryClient.invalidateQueries({
      queryKey: narrowKey(queryKey, options),
      exact: options?.exact,
      refetchType: options?.refetchType ?? "all",
    });
  };

  return {
    invalidate: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
    >(
      moduleName: TModule,
      key: TKey,
      options?: InvalidateOptions<TModule, TKey>
    ) => invalidateOne(moduleName as string, key as string, options),

    invalidateBulk: (entries: Array<InvalidateEntry>) =>
      Promise.all(
        entries.map((entry: any) =>
          invalidateOne(
            entry.moduleName as string,
            entry.key as string,
            entry.options as InvalidateOptions<any, any>
          )
        )
      ),

    invalidateByPrefix: (prefix: QueryKey, refetchType: RefetchType = "all") =>
      queryClient.invalidateQueries({ queryKey: prefix, refetchType }),

    invalidateAll: () => queryClient.invalidateQueries(),

    /**
     * Cache'te veri varsa — bayat ya da son refetch'i hatalı olsa bile — onu
     * döndürür, yoksa çeker. `select` uygulanmaz. Oturum guard'ı gibi verinin
     * güncelliğinin önemli olduğu yerlerde `fetch` kullanın.
     */
    ensure: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
      TItem = GetModuleItem<TModule, TKey>,
    >(
      moduleName: TModule,
      key: TKey,
      ...args: ExtractArgs<TItem>
    ): Promise<QueryCacheDataOf<TItem>> => {
      const options = getRegisteredModules(moduleName, key as any, ...args);
      const request: Promise<unknown> = isInfiniteQueryDefinition(options)
        ? queryClient.ensureInfiniteQueryData(options as any)
        : queryClient.ensureQueryData(options as any);
      return request as Promise<QueryCacheDataOf<TItem>>;
    },

    /**
     * `staleTime`'a uyar: taze cache'i döndürür, bayatsa (veya invalidate
     * edildiyse) yeniden çeker ve hatada reject eder. `select` uygulanır.
     */
    fetch: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
      TItem = GetModuleItem<TModule, TKey>,
    >(
      moduleName: TModule,
      key: TKey,
      ...args: ExtractArgs<TItem>
    ): Promise<QueryDataOf<TItem>> => {
      const options = getRegisteredModules(moduleName, key as any, ...args);
      const request: Promise<unknown> = isInfiniteQueryDefinition(options)
        ? queryClient.infiniteQuery(options as any)
        : queryClient.query(options as any);
      return request as Promise<QueryDataOf<TItem>>;
    },

    /**
     * Cache'i ısıtır; hata fırlatmaz.
     */
    prefetch: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
      TItem = GetModuleItem<TModule, TKey>,
    >(
      moduleName: TModule,
      key: TKey,
      ...args: ExtractArgs<TItem>
    ): Promise<void> => {
      const options = getRegisteredModules(moduleName, key as any, ...args);
      const request: Promise<unknown> = isInfiniteQueryDefinition(options)
        ? queryClient.infiniteQuery(options as any)
        : queryClient.query(options as any);
      return request.then(noop, noop);
    },

    getData: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
      TItem = GetModuleItem<TModule, TKey>,
    >(
      moduleName: TModule,
      key: TKey,
      ...args: ExtractArgs<TItem>
    ): QueryCacheDataOf<TItem> | undefined =>
      queryClient.getQueryData(
        getQueryKey(moduleName, key as any, ...args) as QueryKey
      ),

    /** Optimistic update için tipli `setQueryData`. */
    setData: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
      TItem = GetModuleItem<TModule, TKey>,
    >(
      moduleName: TModule,
      key: TKey,
      updater: (
        previous: QueryCacheDataOf<TItem> | undefined
      ) => QueryCacheDataOf<TItem> | undefined,
      ...args: ExtractArgs<TItem>
    ) =>
      queryClient.setQueryData(
        getQueryKey(moduleName, key as any, ...args) as QueryKey,
        updater
      ),

    /** Optimistic update öncesi in-flight refetch'leri iptal eder. */
    cancel: <
      TModule extends keyof TanstackQueryCraftRegistry,
      TKey extends QueryKeysOf<TModule>,
      TItem = GetModuleItem<TModule, TKey>,
    >(
      moduleName: TModule,
      key: TKey,
      ...args: ExtractArgs<TItem>
    ) =>
      queryClient.cancelQueries({
        queryKey: getQueryKey(moduleName, key as any, ...args) as QueryKey,
      }),

    deleteAllCache: () => queryClient.clear(),

    queryClient,
  };
}

export type CraftClient = ReturnType<typeof createCraftClient>;
