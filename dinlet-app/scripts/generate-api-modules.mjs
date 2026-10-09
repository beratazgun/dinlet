#!/usr/bin/env node
/**
 * OpenAPI şemasından domain bazlı network modüllerini ve
 * `src/networks/index.ts` registry barrel'ını üretir.
 *
 * Her domain kendi klasörünü alır:
 *
 *   src/networks/api/<domain>/
 *     ├── <domain>.gen.ts  — ApiEndpoint tipleri, networkManager fonksiyonları,
 *     │                      defineQuery/defineMutation tanımları. ELLE DÜZENLENMEZ.
 *     └── <domain>.ts      — yoksa bir kez iskeletlenir; override'lar burada
 *                            yaşar ve `defineModule` buradan çağrılır.
 *
 * Ayrıca `src/networks/index.ts` üretilir: barrel export + registry
 * declaration merging.
 *
 * Kullanım:
 *   node scripts/generate-api-modules.mjs [--input <url|dosya>] [--dry-run] [--force-scaffold]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_CONFIG = {
  /** OpenAPI dokümanı: URL veya yerel dosya. JSON tercih edilir. */
  input: "http://localhost:3000/api/v1/doc-json",
  outDir: "src/networks/api",
  indexFile: "src/networks/index.ts",
  /** networkManager.baseURL zaten bu prefix'i içerdiği için path'ten düşülür. */
  pathPrefix: "/api/v1",
  /** GET endpoint'leri için varsayılan tanım türü: "query" | "suspenseQuery". */
  defaultQueryKind: "query",
  /** OpenAPI tag'i -> modül adı. Boş bırakılırsa tag slug'lanır. */
  moduleAliases: {},
  /** operationId -> "query" | "suspenseQuery" | "infiniteQuery". */
  queryKinds: {},
  /** Atlanacak operationId'ler veya "METHOD /path" ifadeleri. */
  exclude: [],
};

const CONFIG_FILE = "src/networks/api-modules.config.json";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

const HEADER = `/**
 * BU DOSYA OTOMATİK ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN.
 *
 * Kaynak : OpenAPI şeması
 * Üretici: scripts/generate-api-modules.mjs (pnpm api:modules)
 *
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) için
 * bu dosyanın yanındaki elle yazılan modül dosyasını kullanın.
 */`;

/* ────────────────────────────── yardımcılar ────────────────────────────── */

function parseArgs(argv) {
  const args = { dryRun: false, forceScaffold: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force-scaffold") args.forceScaffold = true;
    else if (arg === "--input") args.input = argv[++i];
    else if (arg.startsWith("--input="))
      args.input = arg.slice("--input=".length);
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  return args;
}

function loadConfig() {
  const path = join(ROOT, CONFIG_FILE);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return { ...DEFAULT_CONFIG, ...parsed };
}

async function loadDocument(input) {
  const raw = /^https?:\/\//.test(input)
    ? await fetch(input).then((res) => {
        if (!res.ok) {
          throw new Error(
            `OpenAPI dokümanı alınamadı: ${input} -> ${res.status}`,
          );
        }
        return res.text();
      })
    : readFileSync(resolve(ROOT, input), "utf8");

  try {
    return JSON.parse(raw);
  } catch {
    // YAML fallback: opsiyonel `yaml` paketi kuruluysa kullanılır.
    try {
      const { parse } = await import("yaml");
      return parse(raw);
    } catch {
      throw new Error(
        `"${input}" JSON olarak ayrıştırılamadı. JSON döndüren bir endpoint ` +
          `(ör. .../doc-json) verin ya da \`pnpm add -D yaml\` ile YAML desteğini kurun.`,
      );
    }
  }
}

const RESERVED = new Set([
  "delete",
  "new",
  "class",
  "function",
  "default",
  "import",
]);

function words(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

function camel(value) {
  const parts = words(value);
  if (parts.length === 0) return "unnamed";
  const head = parts[0].toLowerCase();
  const tail = parts
    .slice(1)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase());
  const result = [head, ...tail].join("");
  return RESERVED.has(result) ? `${result}Item` : result;
}

function pascal(value) {
  const result = camel(value);
  return result[0].toUpperCase() + result.slice(1);
}

function kebab(value) {
  return words(value)
    .map((part) => part.toLowerCase())
    .join("-");
}

/** Bir operasyonun 2xx JSON yanıtı var mı? */
function hasSuccessResponse(operation) {
  return Object.keys(operation.responses ?? {}).some((status) =>
    /^2\d\d$/.test(status),
  );
}

function isPublic(operation) {
  const security = operation.security;
  return security === undefined ? false : security.length === 0;
}

function collectParameters(pathItem, operation) {
  const all = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  return {
    path: all.filter((param) => param.in === "path"),
    query: all.filter((param) => param.in === "query"),
  };
}

/**
 * Tek başına anlamsız kalan CRUD fiilleri. Bunlar controller adıyla
 * nitelenir: `JobController_get` -> `getJob`.
 */
const GENERIC_ACTIONS = new Set([
  "get",
  "list",
  "create",
  "update",
  "delete",
  "remove",
  "find",
  "index",
  "show",
  "store",
  "destroy",
]);

/** `AuthController_getMe` -> `getMe`, `JobController_get` -> `getJob` */
function operationKey(operationId, method, runtimePath) {
  if (operationId) {
    const parts = operationId.split(/[._]/);
    const action = parts.pop();
    const owner = parts.pop();
    if (action) {
      const key = camel(action);
      if (GENERIC_ACTIONS.has(key) && owner) {
        const noun = pascal(owner.replace(/controllers?$/i, ""));
        if (noun && noun !== "Unnamed") return camel(`${key} ${noun}`);
      }
      return key;
    }
  }
  const segments = runtimePath
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.startsWith("{") ? `by ${segment.slice(1, -1)}` : segment,
    );
  return camel([method, ...segments].join(" "));
}

/* ────────────────────────────── model ────────────────────────────── */

function buildOperations(doc, config) {
  const exclude = new Set(config.exclude);
  const modules = new Map();
  const skipped = [];

  for (const [apiPath, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const signature = `${method.toUpperCase()} ${apiPath}`;
      if (exclude.has(operation.operationId) || exclude.has(signature)) {
        skipped.push(`${signature} (exclude listesinde)`);
        continue;
      }
      if (!hasSuccessResponse(operation)) {
        // 2xx'i olmayan endpoint'ler (redirect akışları) query/mutation'a dönüşmez.
        skipped.push(`${signature} (2xx yanıtı yok)`);
        continue;
      }

      const tag =
        operation.tags?.[0] ??
        apiPath.replace(config.pathPrefix, "").split("/").filter(Boolean)[0] ??
        "default";
      const moduleName = config.moduleAliases[tag] ?? kebab(tag);

      const runtimePath = apiPath.startsWith(config.pathPrefix)
        ? apiPath.slice(config.pathPrefix.length) || "/"
        : apiPath;

      const params = collectParameters(pathItem, operation);
      const isQuery = method === "get";

      const key = operationKey(operation.operationId, method, runtimePath);

      const entry = {
        apiPath,
        runtimePath,
        method,
        key,
        operationId: operation.operationId,
        summary: operation.summary ?? operation.description ?? "",
        pathParams: params.path,
        queryParams: params.query,
        hasBody: Boolean(operation.requestBody),
        isPublic: isPublic(operation),
        kind: isQuery
          ? (config.queryKinds[operation.operationId] ??
            config.defaultQueryKind)
          : "mutation",
      };

      if (!modules.has(moduleName)) modules.set(moduleName, []);
      modules.get(moduleName).push(entry);
    }
  }

  // Modül içi key çakışmalarını method son eki ile ayrıştır.
  for (const operations of modules.values()) {
    const seen = new Map();
    for (const operation of operations) {
      const count = seen.get(operation.key) ?? 0;
      seen.set(operation.key, count + 1);
      if (count > 0)
        operation.key = camel(`${operation.key} ${operation.method}`);
    }
    operations.sort((a, b) => a.key.localeCompare(b.key));
  }

  return { modules, skipped };
}

/* ────────────────────────────── kod üretimi ────────────────────────────── */

function typeName(operation) {
  return `${pascal(operation.key)}ApiResponse`;
}

function variablesTypeName(operation) {
  return `${pascal(operation.key)}Variables`;
}

/** API fonksiyonunun parametre listesi (signal hariç). */
function inputs(operation) {
  const type = typeName(operation);
  const list = [];
  if (operation.pathParams.length > 0) {
    list.push({
      name: "params",
      type: `${type}["PathParams"]`,
      optional: false,
    });
  }
  if (operation.hasBody) {
    list.push({ name: "body", type: `${type}["Body"]`, optional: false });
  }
  if (operation.queryParams.length > 0) {
    // Zorunlu bir query parametresi varsa argüman da zorunlu olmalı; aksi hâlde
    // çağrı derlenir ama istek eksik parametreyle gider.
    const required = operation.queryParams.some((param) => param.required);
    list.push({ name: "query", type: `${type}["Query"]`, optional: !required });
  }
  return list;
}

function urlExpression(operation) {
  if (operation.pathParams.length === 0)
    return JSON.stringify(operation.runtimePath);
  const interpolated = operation.runtimePath.replace(
    /\{([^}]+)\}/g,
    (_, name) => "${encodeURIComponent(String(params." + camel(name) + "))}",
  );
  return `\`${interpolated}\``;
}

function requestConfig(operation) {
  const parts = [];
  if (operation.queryParams.length > 0) parts.push("params: query");
  if (operation.method === "delete" && operation.hasBody)
    parts.push("data: body");
  // Public endpoint'lerde 401 sonrası refresh denemek anlamsız; şema
  // `security: []` diyorsa refresh akışı atlanır.
  if (operation.isPublic) parts.push("skipAuthRefresh: true");
  parts.push("signal");
  return `{ ${parts.join(", ")} }`;
}

function apiFunction(operation) {
  const type = typeName(operation);
  const signature = [
    ...inputs(operation).map(
      (input) => `${input.name}${input.optional ? "?" : ""}: ${input.type}`,
    ),
    "signal?: AbortSignal",
  ].join(", ");

  const url = urlExpression(operation);
  const config = requestConfig(operation);

  let call;
  if (operation.method === "get" || operation.method === "delete") {
    call = `networkManager.${operation.method}(${url}, ${config})`;
  } else {
    call = `networkManager.${operation.method}(${url}, ${operation.hasBody ? "body" : "{}"}, ${config})`;
  }

  const doc = operation.summary ? `/** ${operation.summary} */\n` : "";

  return `${doc}export async function ${operation.key}Api(${signature}): Promise<${type}["SuccessResponse"]> {
  return ${call}
}`;
}

function queryKeyExpression(operation) {
  const segments = operation.runtimePath
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.startsWith("{")
        ? `params.${camel(segment.slice(1, -1))}`
        : JSON.stringify(segment),
    );
  if (operation.queryParams.length > 0) segments.push("query");
  return `[${segments.join(", ")}]`;
}

/**
 * queryKey'in ilk dinamik segmentten önceki statik kısmı. Argümansız
 * invalidate factory'yi çağırmadan bu öneki kullanır.
 */
function baseKeyExpression(operation) {
  const segments = [];
  for (const segment of operation.runtimePath.split("/").filter(Boolean)) {
    if (segment.startsWith("{")) break;
    segments.push(JSON.stringify(segment));
  }
  return `[${segments.join(", ")}]`;
}

function mutationKeyExpression(operation) {
  const segments = operation.runtimePath
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      JSON.stringify(
        segment.startsWith("{") ? `:${camel(segment.slice(1, -1))}` : segment,
      ),
    );
  segments.push(JSON.stringify(operation.method));
  return `[${segments.join(", ")}]`;
}

const DEFINE_BY_KIND = {
  query: "defineQuery",
  suspenseQuery: "defineSuspenseQuery",
  infiniteQuery: "defineInfiniteQuery",
  mutation: "defineMutation",
};

function queryDefinition(operation) {
  const args = inputs(operation);
  const callArgs = [...args.map((input) => input.name), "signal"].join(", ");
  const define = DEFINE_BY_KIND[operation.kind] ?? "defineQuery";

  const body = `${define}({
    queryKey: ${queryKeyExpression(operation)},
    queryFn: async ({ signal }) => ${operation.key}Api(${callArgs}),
  })`;

  if (args.length === 0) return `  ${operation.key}: ${body},`;

  const signature = args
    .map((input) => `${input.name}${input.optional ? "?" : ""}: ${input.type}`)
    .join(", ");
  return `  ${operation.key}: defineQueryFactory(${baseKeyExpression(operation)}, (${signature}) => ${body}),`;
}

/** Mutation'ın tek `variables` parametresi: 0 girdi -> void, 1 girdi -> doğrudan tip. */
function mutationVariables(operation) {
  const args = inputs(operation);
  if (args.length === 0) return { type: "void", destructure: null };
  if (args.length === 1)
    return { type: args[0].type, destructure: [args[0].name] };
  return {
    type: variablesTypeName(operation),
    destructure: args.map((input) => input.name),
    declaration: `export type ${variablesTypeName(operation)} = {
  ${args.map((input) => `${input.name}${input.optional ? "?" : ""}: ${input.type}`).join("\n  ")}
}`,
  };
}

function mutationDefinition(operation) {
  const args = inputs(operation);
  const variables = mutationVariables(operation);

  let call;
  if (args.length === 0) {
    call = `async () => ${operation.key}Api()`;
  } else if (args.length === 1) {
    call = `async (variables: ${variables.type}) => ${operation.key}Api(variables)`;
  } else {
    const callArgs = args.map((input) => `variables.${input.name}`).join(", ");
    call = `async (variables: ${variables.type}) => ${operation.key}Api(${callArgs})`;
  }

  return `  ${operation.key}: defineMutation({
    mutationKey: ${mutationKeyExpression(operation)},
    mutationFn: ${call},
  }),`;
}

function renderModuleFile(moduleName, operations) {
  const queries = operations.filter(
    (operation) => operation.kind !== "mutation",
  );
  const mutations = operations.filter(
    (operation) => operation.kind === "mutation",
  );

  const imports = new Set();
  for (const operation of queries) {
    imports.add(DEFINE_BY_KIND[operation.kind] ?? "defineQuery");
    if (inputs(operation).length > 0) imports.add("defineQueryFactory");
  }
  if (mutations.length > 0) imports.add("defineMutation");

  const variableDeclarations = mutations
    .map((operation) => mutationVariables(operation).declaration)
    .filter(Boolean);

  const identifier = camel(moduleName);

  return `${HEADER}

import { networkManager } from "@/lib/network-manager"
import type { ApiEndpoint } from "@/types/api/api.types"
import { ${[...imports].sort().join(", ")} } from "@tanstack-query-craft"

// ===============================
// 1. MODELS
// ===============================
${operations
  .map(
    (operation) =>
      `export type ${typeName(operation)} = ApiEndpoint<${JSON.stringify(operation.apiPath)}, "${operation.method}">`,
  )
  .join("\n")}
${variableDeclarations.length > 0 ? `\n${variableDeclarations.join("\n\n")}\n` : ""}
// ===============================
// 2. API METHODS
// ===============================
${operations.map(apiFunction).join("\n\n")}

// ===============================
// 3. QUERY / MUTATION DEFINITIONS
// ===============================
export const ${identifier}GenQueries = {
${queries.map(queryDefinition).join("\n")}
}

export const ${identifier}GenMutations = {
${mutations.map(mutationDefinition).join("\n")}
}
`;
}

function renderScaffold(moduleName) {
  const identifier = camel(moduleName);
  return `/**
 * ${moduleName} modülü.
 *
 * \`${moduleName}.gen.ts\` OpenAPI şemasından üretilir ve elle düzenlenmez.
 * Endpoint'e özel ayarlar (staleTime, select, retry, optimistic update) burada
 * override edilir; registry kaydı da bu dosyadan yapılır.
 */
import {
  ${identifier}GenMutations,
  ${identifier}GenQueries,
} from "@/networks/api/${moduleName}/${moduleName}.gen"
import { defineModule } from "@tanstack-query-craft"

export * from "@/networks/api/${moduleName}/${moduleName}.gen"

const queries = {
  ...${identifier}GenQueries,
}

const mutations = {
  ...${identifier}GenMutations,
}

export const ${identifier}Module = defineModule("${moduleName}", {
  queries,
  mutations,
})
`;
}

const INDEX_HEADER = `/**
 * BU DOSYA OTOMATİK ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN.
 *
 * Üretici: scripts/generate-api-modules.mjs (pnpm api:modules)
 *
 * Modülleri registry'ye kaydeder ve TanstackQueryCraftRegistry tipini
 * genişletir. \`src/routes/__root.tsx\` içindeki \`import "@/networks"\`
 * satırı bu dosyanın uygulama başında evaluate edilmesini sağlar.
 */`;

function renderIndexFile(moduleNames) {
  const entries = moduleNames.map((moduleName) => ({
    moduleName,
    identifier: `${camel(moduleName)}Module`,
  }));

  return `${INDEX_HEADER}

${entries
  .map(
    (entry) =>
      `import { ${entry.identifier} } from "@/networks/api/${entry.moduleName}/${entry.moduleName}"`,
  )
  .join("\n")}

export { ${entries.map((entry) => entry.identifier).join(", ")} }

declare module "@tanstack-query-craft" {
  interface TanstackQueryCraftRegistry {
${entries.map((entry) => `    "${entry.moduleName}": typeof ${entry.identifier}`).join("\n")}
  }
}
`;
}

/* ────────────────────────────── çalıştırma ────────────────────────────── */

let prettierModule;

/**
 * Prettier'ı bellekte uygular.
 *
 * Yazdıktan sonra `prettier --write` çalıştırmak yerine biçimlendirmeyi
 * karşılaştırmadan önce yapıyoruz; aksi hâlde ham çıktı her zaman diskteki
 * biçimlendirilmiş dosyadan farklı görünür ve script hiçbir zaman "değişiklik
 * yok" diyemez. Bu da `--dry-run`ı ve CI'daki "üretim güncel mi" kontrolünü
 * kullanışsız kılar.
 */
async function formatSource(source, path) {
  if (prettierModule === undefined) {
    try {
      prettierModule = await import("prettier");
    } catch {
      prettierModule = null;
    }
  }

  if (!prettierModule) return source;

  const config = await prettierModule.resolveConfig(path);
  return prettierModule.format(source, { ...config, filepath: path });
}

async function writeFile(path, contents, { dryRun }) {
  const label = relative(ROOT, path);
  const formatted = await formatSource(contents, path);
  const exists = existsSync(path);

  if (exists && readFileSync(path, "utf8") === formatted) {
    return `= ${label} (değişiklik yok)`;
  }

  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, formatted, "utf8");
  }

  return `${exists ? "~" : "+"} ${label}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  if (args.input) config.input = args.input;

  console.log(`OpenAPI kaynağı: ${config.input}`);
  const doc = await loadDocument(config.input);
  const { modules, skipped } = buildOperations(doc, config);

  if (modules.size === 0) {
    throw new Error("Şemada üretilecek operasyon bulunamadı.");
  }

  const written = [];

  for (const [moduleName, operations] of [...modules].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const moduleDir = join(ROOT, config.outDir, moduleName);
    const generatedPath = join(moduleDir, `${moduleName}.gen.ts`);
    written.push(
      await writeFile(
        generatedPath,
        renderModuleFile(moduleName, operations),
        args,
      ),
    );

    const scaffoldPath = join(moduleDir, `${moduleName}.ts`);
    if (args.forceScaffold || !existsSync(scaffoldPath)) {
      written.push(
        await writeFile(scaffoldPath, renderScaffold(moduleName), args),
      );
    } else {
      written.push(`. ${relative(ROOT, scaffoldPath)} (korundu)`);
    }
  }

  // Düz (klasörsüz) eski düzenden kalan dosyaları bildir; elle yazılan modül
  // dosyası kaybolmasın diye silme işlemini kullanıcıya bırakıyoruz.
  const legacy = [];
  for (const moduleName of modules.keys()) {
    for (const suffix of [".gen.ts", ".ts"]) {
      const legacyPath = join(ROOT, config.outDir, `${moduleName}${suffix}`);
      if (existsSync(legacyPath)) legacy.push(relative(ROOT, legacyPath));
    }
  }

  const indexPath = join(ROOT, config.indexFile);
  written.push(
    await writeFile(
      indexPath,
      renderIndexFile([...modules.keys()].sort()),
      args,
    ),
  );

  console.log(
    `\n${modules.size} modül, ${[...modules.values()].reduce((total, ops) => total + ops.length, 0)} operasyon\n`,
  );
  for (const line of written) console.log(`  ${line}`);
  if (skipped.length > 0) {
    console.log("\nAtlananlar:");
    for (const line of skipped) console.log(`  - ${line}`);
  }
  if (legacy.length > 0) {
    console.log(
      "\nEski düz düzenden kalan dosyalar bulundu; içerikleri klasörlü sürüme " +
        "taşındıktan sonra silinmeli:",
    );
    for (const line of legacy) console.log(`  ! ${line}`);
  }
  if (args.dryRun) console.log("\n(--dry-run: hiçbir dosya yazılmadı)");
}

main().catch((error) => {
  console.error(`\n[api:modules] ${error.message}`);
  process.exit(1);
});
