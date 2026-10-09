/** biome-ignore-all lint/suspicious/noExplicitAny: registry generic'leri için any zorunlu */
import type { ApiSchema } from "@/types/api/api.types";
import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryOptions,
  UseSuspenseInfiniteQueryOptions,
  UseSuspenseQueryOptions,
} from "@tanstack/react-query";
import type { AxiosError } from "axios";

/**
 * Modüller `src/networks/index.ts` içinde declaration merging ile buraya
 * eklenir. Dosya codegen tarafından üretilir.
 */
export interface TanstackQueryCraftRegistry {}

/**
 * Backend'in RFC 7807 tabanlı hata gövdesi.
 *
 * AxiosError'ın generic parametresi *response body* tipidir; buraya status kodu
 * yazmak `error.response.data.message` erişimini imkânsız kılar.
 */
export type AppErrorBody = ApiSchema<"ErrorResDto">;

export type AppError = AxiosError<AppErrorBody>;

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Kind brand'i
 * ─────────────────────────────────────────────────────────────────────────
 * Tanımlara runtime'da var olmayan, opsiyonel bir phantom alan ekliyoruz.
 * Böylece `useCraftQuery`/`useCraftSuspenseQuery` gibi hook'lar bir key'in
 * hangi tür tanım olduğunu tip düzeyinde ayırt edebiliyor.
 *
 * Alan opsiyonel ve yalnızca tip düzeyinde var olduğu için `useQuery({ ...def })`
 * gibi spread kullanımları etkilenmez.
 */
export type CraftKind =
  | "query"
  | "suspenseQuery"
  | "infiniteQuery"
  | "suspenseInfiniteQuery"
  | "mutation";

export type KindBrand<TKind extends CraftKind> = {
  readonly "~craftKind"?: TKind;
};

export type Branded<T, TKind extends CraftKind> = T & KindBrand<TKind>;

export type QueryDefinition<
  TQueryFnData = unknown,
  TData = TQueryFnData,
> = Branded<UseQueryOptions<TQueryFnData, AppError, TData>, "query">;

export type SuspenseQueryDefinition<
  TQueryFnData = unknown,
  TData = TQueryFnData,
> = Branded<
  UseSuspenseQueryOptions<TQueryFnData, AppError, TData>,
  "suspenseQuery"
>;

export type InfiniteQueryDefinition<
  TQueryFnData = unknown,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = Branded<
  UseInfiniteQueryOptions<TQueryFnData, AppError, TData, TQueryKey, TPageParam>,
  "infiniteQuery"
>;

export type SuspenseInfiniteQueryDefinition<
  TQueryFnData = unknown,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = Branded<
  UseSuspenseInfiniteQueryOptions<
    TQueryFnData,
    AppError,
    TData,
    TQueryKey,
    TPageParam
  >,
  "suspenseInfiniteQuery"
>;

export type MutationDefinition<TData = unknown, TVariables = void> = Branded<
  UseMutationOptions<TData, AppError, TVariables>,
  "mutation"
>;

export type AnyQueryDefinition =
  | QueryDefinition<any, any>
  | SuspenseQueryDefinition<any, any>
  | InfiniteQueryDefinition<any, any, any, any>
  | SuspenseInfiniteQueryDefinition<any, any, any, any>;

/** Factory pattern desteği: tanım doğrudan obje ya da argüman alan fonksiyon olabilir. */
export type FactoryOrValue<T, TArgs extends any[] = any[]> =
  T | ((...args: TArgs) => T);

/**
 * `defineQueryFactory` ile üretilen factory. `baseKey`, factory'nin ürettiği
 * tüm queryKey'lerin ortak statik önekidir; argümansız invalidate factory'yi
 * çağırmadan bu öneki kullanır.
 */
export type QueryFactory<
  TArgs extends any[],
  TDefinition extends AnyQueryDefinition,
> = ((...args: TArgs) => TDefinition) & { readonly baseKey: QueryKey };

export type QueriesMap = Record<string, FactoryOrValue<AnyQueryDefinition>>;

export type MutationsMap = Record<
  string,
  FactoryOrValue<MutationDefinition<any, any>>
>;

export interface ModuleDefinition<
  TQueries extends QueriesMap = QueriesMap,
  TMutations extends MutationsMap = MutationsMap,
> {
  queries?: TQueries;
  mutations?: TMutations;
}

// Opsiyonel (?) `queries`/`mutations` alanlarını NonNullable yaparak
// "Object type required" hatasını çözüyoruz.
export type SafeQueries<TModule extends keyof TanstackQueryCraftRegistry> =
  NonNullable<TanstackQueryCraftRegistry[TModule]["queries"]>;

export type SafeMutations<TModule extends keyof TanstackQueryCraftRegistry> =
  NonNullable<TanstackQueryCraftRegistry[TModule]["mutations"]>;

/** Modülün query + mutation key'lerinin birleşimi. */
export type ModuleKeys<TModule extends keyof TanstackQueryCraftRegistry> =
  keyof SafeQueries<TModule> | keyof SafeMutations<TModule>;

export type GetModuleItem<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKey,
> = TKey extends keyof SafeQueries<TModule>
  ? SafeQueries<TModule>[TKey]
  : TKey extends keyof SafeMutations<TModule>
    ? SafeMutations<TModule>[TKey]
    : never;

export type ExtractArgs<T> = T extends (...args: infer A) => any ? A : [];

export type ExtractResult<T> = T extends (...args: any) => infer R ? R : T;

/** Bir tanımın (veya factory'sinin) brand'ini çıkarır. */
export type CraftKindOf<T> =
  ExtractResult<T> extends { readonly "~craftKind"?: infer TKind }
    ? TKind extends CraftKind
      ? TKind
      : never
    : never;

/** Modülün, verilen brand'lere sahip key'leri. */
export type CraftKeysOfKind<
  TModule extends keyof TanstackQueryCraftRegistry,
  TKinds extends CraftKind,
> = {
  [TProp in ModuleKeys<TModule>]: CraftKindOf<
    GetModuleItem<TModule, TProp>
  > extends TKinds
    ? TProp
    : never;
}[ModuleKeys<TModule>];

/** Sadece query (suspense/infinite dahil) key'leri. Invalidate için kullanılır. */
export type QueryKeysOf<TModule extends keyof TanstackQueryCraftRegistry> =
  CraftKeysOfKind<
    TModule,
    "query" | "suspenseQuery" | "infiniteQuery" | "suspenseInfiniteQuery"
  >;

export type MutationKeysOf<TModule extends keyof TanstackQueryCraftRegistry> =
  CraftKeysOfKind<TModule, "mutation">;

/** Bir query tanımının queryFn'inden dönen ham veri tipi. */
export type QueryFnDataOf<T> =
  ExtractResult<T> extends { queryFn?: (...args: any) => infer R }
    ? Awaited<R>
    : unknown;

type IsInfiniteDefinition<T> = [CraftKindOf<T>] extends [never]
  ? false
  : [CraftKindOf<T>] extends ["infiniteQuery" | "suspenseInfiniteQuery"]
    ? true
    : false;

/**
 * Bir query tanımının cache'te tuttuğu veri tipi.
 *
 * Cache her zaman queryFn'in ham çıktısını tutar; `select` yalnız observer
 * düzeyinde uygulanır. `getData`/`setData`/`ensure` bu tipi kullanır.
 * Infinite query'lerde cache'teki tip sayfaların kendisi değil `InfiniteData`
 * sarmalayıcısıdır.
 */
export type QueryCacheDataOf<T> =
  IsInfiniteDefinition<T> extends true
    ? InfiniteData<QueryFnDataOf<T>>
    : QueryFnDataOf<T>;

/**
 * Bir query'nin tüketiciye (hook, `fetch`) ulaşan veri tipi.
 *
 * `select` varsa dönüştürülmüş tip, yoksa cache tipi. `define*` yardımcıları
 * options objesinin literal tipini koruduğu için `select` burada zorunlu alan
 * olarak görünür.
 */
export type QueryDataOf<T> =
  ExtractResult<T> extends { select: (...args: any) => infer TSelected }
    ? TSelected
    : QueryCacheDataOf<T>;
