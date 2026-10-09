/** biome-ignore-all lint/suspicious/noExplicitAny: registry heterojen modül tutar */
import type { ModuleDefinition } from "./types";

/**
 * Global registry.
 *
 * React Native, Fast Refresh / HMR ve farklı runtime ortamlarında modüllerin
 * tekrar evaluate edildiğinde sıfırlanmasını engellemek için Map'i global
 * scope üzerinde tutuyoruz.
 */
const REGISTRY_KEY = "__TANSTACK_QUERY_CRAFT_REGISTRY__" as const;

type Registry = Map<string, ModuleDefinition<any, any>>;

const globalScope = globalThis as typeof globalThis & {
  [REGISTRY_KEY]?: Registry;
};

globalScope[REGISTRY_KEY] ??= new Map();

export const moduleRegistry: Registry = globalScope[REGISTRY_KEY]!;
