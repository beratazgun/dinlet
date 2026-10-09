# DTO and OpenAPI contracts

Use this reference when defining request/response DTOs, changing a transformer
output, or fixing generated API types. The contract is the JSON accepted or
returned by the endpoint, including null values and omitted fields.

## Field metadata

Each public DTO field needs Swagger metadata, supplied by `@ApiProperty`,
`@ApiPropertyOptional`, or a shared decorator that explicitly defines its
schema. `@Expose()` controls serialization; validation decorators control
accepted input. Neither replaces Swagger metadata.

For new or changed fields, specify scalar types explicitly:
`type: String`, `type: Number`, `type: Boolean`. Specify DTO classes for
objects and element types for arrays. This is especially important for unions,
generic wrappers, and transformed fields: TypeScript reflection can report
`Object` or `Function` instead of the JSON shape.

The Swagger CLI plugin can infer some metadata when the build uses it. Check
`nest-cli.json` and the actual build command. Keep explicit metadata for public
contracts; the plugin cannot infer the output of `@DateTransformer()` or other
custom transformations. An example or a TypeScript annotation alone does not
define a reliable serialized schema.

Import classes used by `@ApiProperty({ type: ... })`, `@Type(() => ...)`,
`@Serialize(...)`, or request parameter metadata as runtime values. Use
`import type` only for symbols that are used exclusively in type annotations.

## Required, optional, and nullable

Decide field presence and value nullability separately:

| JSON contract                       | TypeScript declaration   | Swagger decorator                                        |
| ----------------------------------- | ------------------------ | -------------------------------------------------------- |
| Always present, string              | `value!: string`         | `@ApiProperty({ type: String })`                         |
| Always present, string or null      | `value!: string \| null` | `@ApiProperty({ type: String, nullable: true })`         |
| May be omitted, string when present | `value?: string`         | `@ApiPropertyOptional({ type: String })`                 |
| May be omitted or null              | `value?: string \| null` | `@ApiPropertyOptional({ type: String, nullable: true })` |

Use the same distinction for numbers, booleans, arrays, and nested DTOs.
A nullable value does not automatically make its field optional. Preserve an
existing endpoint's contract when correcting metadata; inspect its serializer
before changing requiredness or null handling.

## Request DTOs

- Put body, query, and param contracts in the matching `*.body.dto.ts`,
  `*.query.dto.ts`, and `*.param.dto.ts` files; export them through DTO barrels.
- Give every accepted field validation decorators with Turkish messages, plus
  its Swagger type and relevant constraints. Swagger metadata does not make a
  field pass the global validation whitelist.
- Reuse central coercion decorators such as `@Trim()`, `@ToLowerCase()`, and
  `@ToInt()`. Document query input and defaults consistently with the actual
  transformation and validation.
- `@IsOptional()` skips validation for both `undefined` and `null`. If a field
  may be omitted but must reject null, skip only `undefined` with
  `@ValidateIf((_object, value) => value !== undefined)` and keep the field's
  validators. Match the TypeScript union and Swagger `nullable` setting.
- Use `@ValidateNested()` and `@Type(() => ChildBodyDto)` for nested objects;
  add presence/object validation as the contract requires. Nested arrays also
  use `@IsArray()` and `@ValidateNested({ each: true })`.
- Derive mapped DTOs with Swagger's `PartialType`, `PickType`, and `OmitType`.
  Check the resulting null/undefined validation behavior against the intended
  contract rather than assuming an optional TypeScript property enforces it.

## Response DTOs and nested objects

Declare each field's serialized type and use `@Expose()` for fields processed
by `@Serialize(...)`. Use the same response class in
`@Serialize(ItemResDto)` and `@ApiSuccessResponse({ model: ItemResDto })`.
Services return `HttpSuccess` subclasses; response DTOs describe their data.

For a nested response DTO, document the class and instantiate it during
serialization so its own `@Expose()` rules apply:

```ts
@ApiProperty({ type: () => ChildResDto, nullable: true })
@Expose()
@Type(() => ChildResDto)
child!: ChildResDto | null;

@ApiProperty({ type: () => [ChildResDto] })
@Expose()
@Type(() => ChildResDto)
children!: ChildResDto[];

@ApiProperty({ type: [String] })
@Expose()
tags!: string[];
```

Import `Type` and `Expose` from `class-transformer`; import `ChildResDto` as a
value from its barrel. Each child field also needs its own Swagger metadata.
Use lazy class references where needed to avoid eager circular references.

Known structures use a DTO class, not an unstructured `Object`,
`Record<string, never>`, or a duplicate frontend interface. A genuine dictionary
can use `type: "object"` with `additionalProperties` describing its values;
`additionalProperties: true` is appropriate only for intentionally open data.

## Dates: match the transformer output

`DateTransformer` defaults to `withRawAndDisplay: true`, including when
`toISO: true` is set. It produces an object with `raw` and `display`, not a
date-time string. Reuse the existing `DateTransformerValueDto` from the
decorators barrel as a runtime class:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

export class EventResDto {
  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;
}
```

The wrapper's `raw` schema is `string | null` with `format: "date-time"`;
`display` is `string | null`. Put date-time format on an actual ISO string,
not on the wrapper object or a human-readable formatted date.

By default, null input becomes `{ raw: null, display: null }`. If the endpoint
contract requires an outer null, configure `skipNullish: true`, declare
`DateTransformerValueDto<string> | null`, and add `nullable: true` to its
Swagger property. If omission is allowed as well, also use `?` and
`ApiPropertyOptional`. Preserve existing behavior when fixing only documentation.

For an endpoint whose contract intentionally returns a plain ISO string, all
three definitions must agree:

```ts
@ApiProperty({ type: String, format: "date-time" })
@Expose()
@DateTransformer({ toISO: true, withRawAndDisplay: false })
createdAt!: string;
```

Keep date conversion in the shared decorator/`DateManager`. Pass the input
shape expected by the decorator; avoid formatting a value into a display
string in the service and then parsing it again in the DTO.

## Enums: preserve the object schema

Response enum fields use `@Expose()`, `@EnumTransformer({ enumType: "..." })`,
and `EnumTransformerValueDto<DomainEnum>`. The shared transformer already
defines an object schema with `raw` and `display` and places enum values on
`raw`.

A scalar `@ApiProperty({ enum: DomainEnum })` on that same response field can
overwrite the object schema. Keep the shared transformer's schema; add only
compatible descriptive metadata when needed. Scalar enum declarations remain
appropriate for request fields that actually accept an enum string.

Verify both null handling and the generated object shape when changing enum
options. Extend the central decorator if it needs new schema behavior.

## Pagination and response envelopes

Use `Paginator` in the service and return its metadata as `meta.pagination`.
Document collection handlers with:

```ts
@Serialize(ItemResDto)
@ApiSuccessResponse({ model: ItemResDto, isArray: true, pagination: "offset" })
// keyset (paginator.applyCursor): pagination: "cursor"
```

The shared response decorator registers `PaginationMetaResDto` (offset) or
`CursorPaginationMetaResDto` (cursor: `limit`, `nextCursor`, `hasNextPage`,
`nextUrl`) and points `meta.pagination` to it. Keep its ten fields documented: `page`, `limit`,
`totalDocs`, `totalPages`, `nextPage`, `prevPage`, `hasNextPage`, `hasPrevPage`,
`nextUrl`, and `prevUrl`. Page links/numbers that can be absent use nullable
scalar schemas; the serializer derives URLs from the request.

Shared success/error envelopes, HATEOAS links, and validation error items also
need field metadata. `ApiExtraModels` registers a class but does not populate
undocumented fields. Reuse the existing shared classes and response decorators
instead of hand-building a second pagination or envelope schema.

## Verify a contract change

1. Inspect the relevant `components.schemas` and operation response in the
   generated OpenAPI document, including nested references and required fields.
   Run focused `SwaggerModule.createDocument` tests when available; keep a
   regression at that boundary for a reproduced schema bug.
2. Generate TypeScript from the development endpoint's YAML into a temporary
   directory when checking frontend type generation:

   ```bash
   schema_check_dir="$(mktemp -d)"
   npx openapi-typescript http://localhost:3000/api/v1/doc-yaml -o "$schema_check_dir/api-schema.d.ts"
   ```

3. Check that the changed component types contain the expected fields, nullable
   unions, nested `raw`/`display`, and `meta.pagination` reference. Known DTOs
   must not collapse to `Record<string, never>` or `{}`. Empty generated
   `webhooks` or `$defs` sections are unrelated and may legitimately use
   `Record<string, never>`.
4. Correct backend metadata and regenerate client types. Hand edits to generated
   declarations and casts in the frontend do not fix the contract. Run the
   applicable typecheck/lint scripts for TypeScript changes; a Markdown-only
   update needs documentation validation instead.

Ready-to-use DTO examples are in [layer-templates.md](layer-templates.md).
