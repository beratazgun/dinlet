# Shared Utility Inventory (reuse catalog)

The DRY contract: **for each concern below there is exactly ONE implementation.
Use it. If it is insufficient, extend it in place — do not fork a local copy.**

Grep before writing: `grep -rIn "TERM" src/core/utils src/core/decorators`.

---

## Dates & time — `DateManager` + `@DateTransformer()`

`src/core/utils/date-manager.ts`, `src/core/decorators/date-transformer.decorator.ts`

`DateManager` is the ONLY place allowed to format/parse/convert dates. Locale
`tr`, timezone `Europe/Istanbul`.

Methods: `toTurkeyTime(date, format?)`, `now()`, `parseStringToDate(str, fmt)`,
`getFormattedDate(date?, type?)`, `setTimeToToday(hhmmss)`,
`isCurrentTimeBetween(start,end)`, `setDateToToday(date)`,
`formatDateForISO8601(date?)`, `getTimeBetween(start, end?, unit?, formatted?)`
("3 saat önce"), `milisecondsToTimeString(ms, formatted?)`,
`formatDistanceToNow(date)`. Auth/token expiry work also uses `utcNow()`,
`addMilliseconds(ms, date?)`, `toISOString(date?)`, `isExpired(date,
reference?)`, and `millisecondsSince(date)`.

Allowed output formats live in the `DateFormatType` union. **Need a new format?
Add it to that union.** **Need new behavior? Add a method to the class.** Do not
call `date-fns` / `new Date().toISOString()` / `format()` directly in services
or DTOs.

For response DTOs, the decorator is mandatory on every date/time field; format
via it instead of returning raw values or writing manual transform code:
`@DateTransformer({ format, toTurkeyTime, toISO, toDuration, getTimeBetween,
formatDistanceToNow, startOfDay, endOfDay, withRawAndDisplay, defaultValue,
skipNullish })`.

For the returned JSON shape, null handling, and Swagger type, follow
[DTO date contracts](dto-openapi.md#dates-match-the-transformer-output).

❌ `const d = new Date(x); return format(d, "dd.MM.yyyy")`
✅ `dateManager.getFormattedDate(x, "dd.MM.yyyy")` or `@DateTransformer({ format: "dd.MM.yyyy" })`

---

## Media / CDN URLs — `MediaUrl` + CDN decorators

`src/core/utils/media-url.ts`, `src/core/decorators/cdn-url.decorator.ts`

`MediaUrl.configure(base)` runs once at bootstrap. Then:
`MediaUrl.toUrl(storageKey)`, `MediaUrl.toUrls(items, filter)`,
`MediaUrl.toItems(items, filter)`, `classifyMedia(item)` → `image|video|other`.
Decorators for DTOs: `@CdnUrl()`, `@CdnUrlList()`, `@CdnMediaList()`.

❌ `` `${cdnBase}/${key}` `` inline anywhere.
✅ `MediaUrl.toUrl(key)`.

---

## Pagination — `Paginator`

`src/core/utils/paginator.ts`. Register it in the consuming module's providers,
inject it, and pick the mode by table growth:

- `paginator.apply({ page, limit, count: () => …, query: ({ limit, offset }) => … })`
  (offset) — bounded lists (job definitions, roles). Runs `COUNT` per request.
- `paginator.applyToArray(items, { page, limit })` — small in-memory lists
  (e.g. sessions read from Redis).
- `paginator.applyCursor({ cursor, limit, query: ({ limit, after }) => … })`
  (keyset) — ever-growing tables (audit logs, executions). No `COUNT`; the
  repository orders by `(createdAt, id)` and uses `.cursor(after ?? {})`. Rows
  must expose `createdAt` + `id`.

All return `{ pagination, docs }`. Put `pagination` on the response
`meta.pagination`. `limit` is clamped to `MAX_PAGE_LIMIT` (100). `Paginator` is
transport-agnostic: `SerializeInterceptor` derives HATEOAS links
(`nextUrl`/`prevUrl`) from the request. Request DTOs: `PageQueryDto` (offset) /
`CursorQueryDto` (keyset). This is mandatory for every endpoint that returns a
collection—do not introduce an unpaginated list endpoint. Never compute page
math by hand.

---

## Passwords — `hashPassword` / `verifyPassword`

`src/core/utils/hash.ts` (argon2id). Only these two functions may hash/verify
passwords. (Note the documented CPU-bound caveat under load.)

---

## Random / tokens — `Generator`

`src/core/utils/generator.ts`. `Generator.hashedToken(len)` (sha256 hex),
`Generator.random(len, "text"|"numeric"|"textAndNumber", prefix?, suffix?)`.
For opaque verification tokens the repos use `nanoid(n)` branded to the
contract's `Char<N>`. Use these instead of ad-hoc `Math.random`/`crypto` blocks.

---

## PII masking — `maskSensitiveData`

`src/core/utils/masking.util.ts`. Masks TR phone, email, TCKN, credit card,
IBAN in free text. Use before logging or exposing user-supplied strings.

---

## Slugs — `generateSlug`

`src/core/utils/generate-slug.ts`. `generateSlug(name)` — the only slugifier.

---

## Enum labels (Turkish) — `EnumTranslations`

`src/core/utils/enum-translations.ts`. `*Translations` maps
(`UserStatusTranslations`, `AccountTypeTranslations`, `MediaTypeTranslations`,
`JobStatusEnumTranslations`, …) + the `EnumTranslations` class, and the
`@EnumTransformer()` DTO decorator. Every enum value returned by a response DTO
must use this decorator and `EnumTransformerValueDto<T>`, yielding `{ raw,
display }`. Add new enum→label maps here; don't expose bare enum strings or
inline `switch` label tables in services.

---

## Query-param coercion decorators

`src/core/decorators/query-transform.decorator.ts`: `@ToArray`, `@ToBoolean`,
`@ToNumber`, `@ToInt`, `@Trim`, `@ToLowerCase`, `@ToUpperCase`, `@ToDate`,
`@ParseJSON`, `@SplitString(sep)`, `@Default(value)`. Use on query DTO fields
instead of hand-parsing `req.query`.

---

## Value transformers

- `@MoneyTransformer()` — `money-transformer.decorator.ts`.
- `@NormalizePhoneNumber()` — `normalize-phone-number.decorator.ts`.

---

## Request context param decorators

- `@CurrentUser()` → the JWT payload of the authenticated user.
- `@RequestMetadata()` → `RequestMetadata` (ip / user-agent / etc.).

---

## Swagger response docs

`@ApiSuccessResponse({ model?, status?, description?, isArray?, pagination?: "offset" | "cursor" })`
and `@ApiErrorResponses(...codes)` build OpenAPI from the same decorated DTO
classes used at runtime. Field definitions and checks for pagination, nested
objects, and generated API types are in [DTO and OpenAPI contracts](dto-openapi.md).

---

## HTTP responses

`#/core/http`: `OkResponse`, `CreatedResponse`, `AcceptedResponse`,
`NoContentResponse` (all extend `HttpSuccess`). Services return these; the
global interceptor renders the envelope. Every successful JSON response must
use one of these classes—never return a raw object or array. Every corresponding
controller handler must also use `@Serialize(ResponseDto)` from
`src/core/decorators/serialize.decorator.ts`; redirects/streams written directly
through `@Res()` are the only non-JSON exception. See SKILL.md §5.

---

## Event-driven side effects

Email, notification, webhook, analytics, audit delivery, and similar secondary
effects must not run directly in a controller or business service. After the
primary state change succeeds, emit a domain event with `EventEmitter2`; perform
the external delivery in an `@OnEvent(...)` handler. Keep the event token and
payload class in the feature's `event/` directory and register the handler as a
module provider.

---

## Database access

`DatabaseService` (`src/infra/database/database.service.ts`) exposes
`client` → `db` (Prisma 8 contract-first). Repos use `this.database.client`.
Scalar brands in `#database/scalars.js` (`asUuid`, …). Enums in
`#database/enums.js`. For anything Prisma-specific, invoke the `prisma-8` skill.
