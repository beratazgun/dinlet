---
name: project-standards
description: >-
  Coding standards for this NestJS 12 + Prisma 8 dinlet: naming, layering,
  class-validator/class-transformer DTOs, Swagger/OpenAPI contracts, HTTP
  envelopes, module wiring, and shared-utility reuse. Apply before writing or
  refactoring TypeScript under src/, or when defining/reviewing DTOs,
  serializers, pagination, or generated API types. Reuse central utilities
  such as DateManager and Paginator; extend them when needed.
  Also covers BullMQ queues, producer/processor roles, and retry/backoff/DLQ
  conventions when adding or changing background jobs.
---

# Project Standards — NestJS 12 + Prisma 8 Dinlet

This is the authoritative style guide for this repository. Every change to
`src/**` must follow it. The two non-negotiable goals:

1. **Consistency** — naming, layering, and response shape are identical across
   every module. New code must be indistinguishable from existing code.
2. **Zero duplication (DRY)** — shared behavior lives in exactly one place.
   Before writing any helper, check the reuse inventory. If a central utility
   exists, use it; if it is insufficient, **extend the central utility** — never
   fork a new local copy.

When in doubt, open a sibling file in `src/modules/auth/**` and mirror it — that
module is the reference implementation.

---

## 0. Golden reuse rule (read first)

> **Never re-implement something a central utility already does. Extend the
> central utility instead.**

The canonical example: **all** date parsing / formatting / timezone / "X ago" /
duration work goes through `DateManager` (`src/core/utils/date-manager.ts`) and
the `@DateTransformer()` decorator. You may **not** write `new Date(...)`
formatting logic, a `dayjs`/`moment` helper, or an inline `toISOString()` +
`format()` block in a service or DTO. If `DateManager` lacks a format or method
you need, add the format to `DateFormatType` or add a method to the class.

This same rule applies to every entry in the **Shared Utility Inventory**
(`references/shared-utilities.md`). Read that file before adding any helper.

Before writing a helper, grep first:

```bash
# does a util already exist?
grep -rIn "TERM" src/core/utils src/core/decorators
```

---

## 1. File naming

All files are **kebab-case** and carry a **role suffix** so the layer is
obvious from the filename alone. ESM: every relative/alias import ends in `.js`.

| Layer / role        | Suffix                             | Example                              |
| ------------------- | ---------------------------------- | ------------------------------------ |
| Module              | `.module.ts`                       | `auth.module.ts`                     |
| Controller          | `.controller.ts`                   | `auth.controller.ts`                 |
| Service             | `.service.ts`                      | `auth-password.service.ts`           |
| Repository          | `.repository.ts`                   | `auth-user.repository.ts`            |
| Request DTO (body)  | `.body.dto.ts`                     | `register.body.dto.ts`               |
| Request DTO (param) | `.param.dto.ts`                    | `account-id.param.dto.ts`            |
| Request DTO (query) | `.query.dto.ts`                    | `get-enum-options.query.dto.ts`      |
| Response DTO        | `.res.dto.ts`                      | `get-me.res.dto.ts`                  |
| Decorator           | `.decorator.ts`                    | `serialize.decorator.ts`             |
| Guard               | `.guard.ts`                        | `auth.guard.ts`                      |
| Interceptor         | `.interceptor.ts`                  | `serialize.interceptor.ts`           |
| Exception filter    | `.filter.ts`                       | `http-exception.filter.ts`           |
| Strategy            | `.strategy.ts`                     | `jwt.strategy.ts`                    |
| Event / handler     | `.events.ts` / `.event-handler.ts` | `auth.events.ts`                     |
| Prisma model        | `.model.ts`                        | `auth.model.ts`                      |
| Seed                | `.seed.ts`                         | `users.seed.ts`                      |
| Pure util           | `.util.ts` or plain kebab noun     | `masking.util.ts`, `date-manager.ts` |

**Directory layout inside a feature module** (mirror `src/modules/auth/`):

```
modules/<feature>/
  <feature>.module.ts
  controllers/        index.ts (barrel + array)  *.controller.ts
  services/           index.ts (barrel + array)  *.service.ts
  repository/         index.ts (barrel + array)  *.repository.ts
  dtos/               index.ts
    request/          index.ts  *.body.dto.ts | *.param.dto.ts | *.query.dto.ts
    response/         index.ts  *.res.dto.ts
  event/  guards/  strategies/  utils/   (as needed)
```

Cross-cutting code lives in `src/core/**` (decorators, guards, interceptors,
http, dtos, utils, exception-filters) and infra in `src/infra/**` (database,
redis, s3, job, notifications, health).

---

## 2. Symbol naming

- **Classes**: PascalCase, suffix = role → `AuthService`, `AuthUserRepository`,
  `SerializeInterceptor`, `AuthController`.
- **DTO classes**: PascalCase describing shape + `Dto` suffix →
  `RegisterBodyDto`, `GetMeResDto`, `AccountIdParamDto`. Request and response
  contracts are decorated classes, never schema/type pairs.
- **Events**: constant token `UPPER_SNAKE_EVENT` + payload class `XxxEvent`
  (e.g. `USER_REGISTERED_EVENT`, `UserRegisteredEvent`).
- **Enums / enum values**: come from `#database/enums.js` — never redeclare.
- Functions/vars: camelCase. Booleans read as predicates (`isEmailVerified`,
  `hasNextPage`).
- Comments and user-facing messages are **Turkish**; code identifiers English.

---

## 3. Imports & path aliases

Use the configured subpath aliases — never deep relative `../../..` chains.
Every import path ends in `.js` (ESM + `type: module`).

| Alias         | Resolves to            |
| ------------- | ---------------------- |
| `#/*`         | `src/*`                |
| `#config/*`   | `config/*`             |
| `#database/*` | `src/infra/database/*` |
| `#root/*`     | repo root              |

- Use `import type { … }` for type-only imports (see `auth.service.ts`).
- Import shared symbols from the folder **barrel** (`#/core/decorators/index.js`,
  `#/core/http/index.js`, `#/modules/auth/dtos/index.js`), not individual files,
  when a barrel exists.

---

## 4. Layer responsibilities

Strict one-way flow: **Controller → Service → Repository → DatabaseService**.
Never skip or reverse (a controller must not touch the DB; a repository must
not build HTTP responses).

### Controller — thin edge

- Only: route/verb decorators, auth decorators, validation wiring, delegate.
- Validate input at the boundary with the global `ValidationPipe` and a DTO
  class: `@Body() body: RegisterBodyDto` (same for `@Param()` and `@Query()`).
- Serialize output with `@Serialize(SomeResDto)` (see §6).
- Always document Swagger: `@ApiTags`, `@ApiOperation`, `@ApiSuccessResponse`,
  `@ApiErrorResponses(...)`, `@ApiBearerAuth()` on protected routes.
- Set `@HttpCode(HttpStatus.X)` explicitly. `@Public()` opts a route out of the
  global auth guard. Rate-limit with `@Throttle({ short, medium })`.
- No business logic, no data access, no manual response-envelope building.
- Every JSON endpoint uses `@Serialize(ResponseDto)`. Do not omit it from
  create/update/delete, message-only, or list endpoints. A transport-native
  redirect/stream handled directly through `@Res()` is not a JSON response and
  is the only exception.

### Service — business logic, returns an `HttpSuccess`

- `@Injectable()`, dependencies injected via constructor `private readonly`.
- Contains all rules, orchestration, and cross-repository coordination.
- Throws Nest `*Exception` for error cases (Turkish message).
- **Returns an `HttpSuccess` subclass** (`OkResponse`/`CreatedResponse`/…), never
  a raw object and never a manually-shaped envelope. See §5.
- Emits domain events via `EventEmitter2` (`this.eventEmitter.emit(TOKEN, new
Event(...))`) rather than calling side-effect services inline.
- Email, notification, webhook, analytics, audit delivery, and similar
  secondary side effects run in an event handler. Controllers and business
  services emit the domain event only; they do not call the delivery provider.

### Repository — data access only

- `@Injectable()`, inject `DatabaseService`; expose `private get db() { return
this.database.client; }`.
- Query through the Prisma 8 ORM builder:
  `this.db.orm.public.User.where(...).select(...).include(...).first()/.all()`.
- Brand scalars at the boundary: `asUuid(id)`, custom `Char<N>` brands.
- Soft-delete-aware: filter `.where((u) => u.deletedAt.isNull())`.
- Normalize emails to lowercase before querying/writing.
- Multi-write operations use `this.db.transaction(async (tx) => { … })`.
- Returns plain data/entities — no HTTP concerns. (Prisma details:
  invoke the `prisma-8` skill.)

### Non-negotiable endpoint invariants

- **Every listing endpoint uses `Paginator`**, even when the current dataset is
  small. The repository exposes count/query callbacks, the service calls
  `paginator.apply(...)`, and pagination is returned as `meta.pagination`.
  Never return an unpaginated collection or hand-calculate limit/offset/meta.
- **Every date/time field exposed by a response DTO uses
  `@DateTransformer(...)`** from
  `src/core/decorators/date-transformer.decorator.ts`. Do not return a raw date
  or format it with an inline `@Transform`.
- **Every enum field exposed by a response DTO uses `@EnumTransformer(...)`**
  from `src/core/decorators/enum-transformer.decorator.ts`. Return the standard
  `{ raw, display }` representation; do not expose a bare enum string.
- **Every successful JSON response is an `HttpSuccess` subclass from
  `src/core/http` and every JSON controller handler has `@Serialize(...)`.**
  Raw objects, arrays, and manually-built envelopes are forbidden.
- **Side effects such as email delivery are event-driven.** Emit through
  `EventEmitter2` after the primary state change succeeds; perform delivery in
  an `@OnEvent(...)` handler.

---

## 5. HTTP response envelope

Every successful service result is one of the classes from `#/core/http`:
`OkResponse` (200), `CreatedResponse` (201), `AcceptedResponse` (202),
`NoContentResponse` (204). The global `ResponseInterceptor` unwraps them into
the RFC/JSON:API-style envelope (`success`, `status`, `message`, `timestamp`,
`path`, `data`, `meta`, `_links`). **Do not build that envelope by hand.**

```ts
// message only
return new OkResponse("Kayıt başarılı!");
// message + data
return new OkResponse("Kullanıcı bilgileri", result);
// cookies / meta / links via options
return new OkResponse(data, { meta: {...}, links: {...}, cookies: [...] });
```

Pagination goes through the `Paginator` service (§7); put its result on
`meta.pagination` and the serializer/interceptor derive `nextUrl`/`prevUrl`.

---

## 6. DTO & serializer conventions (class-first)

Before adding or changing a request, response, or nested DTO, transformer output,
or Swagger response definition, read
[DTO and OpenAPI contracts](references/dto-openapi.md). Use the corrected
[DTO templates](references/layer-templates.md) when scaffolding.

- **One contract**: the TypeScript field, validation/serialization behavior, and
  OpenAPI schema describe the same JSON shape. Import classes used in runtime
  decorators as values; reserve `import type` for type-only usage.
- **Request**: one exported DTO class per file in `dtos/request/`, with the
  body/query/param suffix. Apply `class-validator` rules with Turkish messages
  to accepted fields and reuse central coercion decorators. Use the class with
  `@Body()`, `@Query()`, or `@Param()`; derive mapped variants with Swagger's
  `PartialType`, `PickType`, or `OmitType`.
- **Response**: use `*.res.dto.ts`, expose serialized fields with `@Expose()`,
  and use the same class in `@Serialize(...)` and `@ApiSuccessResponse`.
  Define nested objects as DTO classes and use `@Type(() => ChildDto)` for
  their serialization.
- **Swagger**: give public fields explicit scalar, DTO, or array types through
  `@ApiProperty` / `@ApiPropertyOptional`, or a shared decorator that defines
  the schema. Distinguish optional fields from nullable values. These rules
  also apply to shared pagination, success/error envelopes, and nested models.
- **Transformers**: response dates use `@DateTransformer`; its default object
  output uses `DateTransformerValueDto` as the Swagger type. Response enums
  use `@EnumTransformer` and `EnumTransformerValueDto<T>`; preserve the
  transformer's object schema. Match field types to the transformed output.
- **Reuse and verification**: keep presentation transforms in the shared
  utilities/decorators and pagination in `Paginator`. Verify changed schemas
  and generated client types using the reference's completion checks.

---

## 7. Shared utilities — reuse, don't reinvent

Full signatures and "use this instead of…" guidance are in
**`references/shared-utilities.md`**. Summary of what already exists — reach for
these before writing anything new:

- **Dates/time** → `DateManager` + `@DateTransformer()`
  (`src/core/utils/date-manager.ts`). All timezone/format/"X önce"/duration.
- **Media / CDN URLs** → `MediaUrl` class + `@CdnUrl()/@CdnUrlList()/@CdnMediaList()`
  (`src/core/utils/media-url.ts`). Never concat storage keys into URLs inline.
- **Pagination** → `Paginator` service (`src/core/utils/paginator.ts`).
- **Password hashing** → `hashPassword` / `verifyPassword` (`hash.ts`, argon2).
- **Random / token generation** → `Generator` (`generator.ts`).
- **PII masking** → `maskSensitiveData` (`masking.util.ts`).
- **Slugs** → `generateSlug` (`generate-slug.ts`).
- **Enum labels (TR)** → `EnumTranslations` + `*Translations` maps +
  `@EnumTransformer()` (`enum-translations.ts`, `enum-transformer.decorator.ts`).
- **Query-param coercion** → `@ToArray/@ToBoolean/@ToNumber/@ToInt/@Trim/…`
  (`query-transform.decorator.ts`).
- **Money** → `@MoneyTransformer()`. **Phone** → `@NormalizePhoneNumber()`.
- **Current user / request metadata** → `@CurrentUser()`, `@RequestMetadata()`.
- **Swagger docs** → `@ApiSuccessResponse`, `@ApiErrorResponses`.

If one of these is missing a capability you need: **extend it** (add a method,
option, format, or translation map) and keep the single source of truth. Then
export it through the existing barrel.

---

## 8. Module wiring & barrels

Every `controllers/`, `services/`, `repository/` folder has an `index.ts` that
(a) re-exports each class **and** (b) exports a named array for DI registration:

```ts
export const AuthServices = [AuthService, AuthPasswordService /* … */];
export { AuthService, AuthPasswordService /* … */ };
```

The module spreads those arrays:

```ts
@Module({
  controllers: [...AuthControllers],
  providers: [...AuthRepositories, ...AuthServices, ...AuthProviders],
  exports: [...AuthRepositories, ...AuthServices],
})
export class AuthModule {}
```

Adding a class = create the file, add it to the folder barrel array, done — the
module picks it up automatically. Folder `index.ts` barrels use `.js` paths.

---

## 9. Checklists

**New endpoint on an existing module**

1. Request DTO class in `dtos/request/<name>.body.dto.ts`, add to
   `request/index.ts` and `dtos/index.ts`.
2. Response DTO class in `dtos/response/` if it returns data; add to barrels.
3. Service method → business logic, returns an `HttpSuccess` subclass, reuses
   shared utils for any date/media/enum/pagination work.
4. Repository method(s) for data access (soft-delete filter, `asUuid`, tx).
5. Controller method: verb + `@HttpCode` + auth/`@Public` + `@Throttle` +
   `@Body/@Param/@Query()` + `@Serialize` + full Swagger decorators;
   delegates to the service.
6. `npm run typecheck` and `npm run lint`.

**Mandatory response/side-effect audit**

- Controller JSON handler has `@Serialize(ResponseDto)`.
- Service returns `OkResponse` / `CreatedResponse` / `AcceptedResponse` /
  `NoContentResponse`; no raw success value escapes.
- A collection goes through `Paginator` and returns `meta.pagination`.
- Every response date field has `@DateTransformer(...)`.
- Every response enum field has `@EnumTransformer(...)`.
- Email/notification/webhook-like work is triggered by `EventEmitter2` and
  executed by an `@OnEvent(...)` handler.

**New feature module**

- Scaffold the directory layout in §1, create the four barrels, register the
  module in `src/app.module.ts`. Mirror `modules/auth` exactly.

**Before adding any helper/util**

- Grep `src/core/utils` + `src/core/decorators`. If it exists, use it. If it is
  close but insufficient, extend it. Only create a new util for a genuinely new
  concern, placed in `src/core/utils` (or the feature's `utils/`) with the right
  suffix and barreled.

---

## 10. Background jobs (BullMQ)

Asenkron / güvenilir-retry gereken yan etkiler (e-posta, webhook, dış API,
rapor üretimi, ağır işleme) **BullMQ kuyruklarıyla** yapılır. Altyapı
`src/infra/queue/` altında ve **global**'dir; `email` kuyruğu referans
implementasyondur.

> **BullMQ ≠ Job (cron) sistemi.** Bu repoda iki ayrı arka-plan altyapısı var:
> **BullMQ** (`src/infra/queue/`) olay-tetikli/anlık işler için; **Job sistemi**
> (`src/infra/job/` + `Job`/`JobExecution` tabloları) DB-driven, zamanlanmış
> (cron) işler + kalıcı Postgres audit için. Biri diğerinin yerine geçmez —
> takvime bağlı, ops'un yönettiği periyodik işler Job sistemine, olaya tepki
> veren retry'lı işler BullMQ'ya gider. Ayrıntı: `references/bullmq-queues.md` §0.

- **Akış**: business servis domain event emit eder → `@OnEvent` handler kuyruğa
  **enqueue** eder → processor işi request dışında yapar. Handler içinde
  sağlayıcıyı doğrudan çağırma (bu §4'teki event-driven kuralının uzantısıdır).
- **Roller**: producer (`*-queue.service.ts`, `@Injectable`, export edilir,
  sadece `queue.add` sarmalar) ↔ processor (`*.processor.ts`,
  `@Processor(QueueName.X)`, `BaseProcessor`'dan türer, sadece `logger` +
  `handle(job)` yazar). Retry/backoff/DLQ görünürlüğü `BaseProcessor`'da.
- **Sabitler**: kuyruk adları daima `QueueName.X` (elle string yok); ortak
  davranış `DEFAULT_JOB_OPTIONS`'ta.

**Yeni kuyruk eklemeden önce `references/bullmq-queues.md`'yi oku** — mimari,
5 adımlık ekleme reçetesi, enqueue opsiyonları (delay/priority/idempotent
`jobId`) ve do/don't listesi oradadır.

---

## 11. Verify

After changes: `npm run typecheck` (`tsc --noEmit`) and `npm run lint`
(`oxlint --fix`). Match the surrounding file's comment density and Turkish
phrasing. See `references/shared-utilities.md` for the full reuse catalog,
`references/layer-templates.md` for copy-paste skeletons, and
`references/bullmq-queues.md` for the background-job / queue standard.
