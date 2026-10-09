# Layer Templates (copy-paste skeletons)

Minimal, convention-correct starting points. Mirror `src/modules/auth/**` for
anything richer. Every import ends in `.js`; use path aliases.

---

## Request DTO — `dtos/request/<name>.body.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { ToLowerCase, Trim } from "#/core/decorators/index.js";

export class CreateThingBodyDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 50, example: "Örnek" })
  @Trim()
  @IsString({ message: "İsim metin olmalıdır" })
  @MinLength(2, { message: "İsim en az 2 karakter olmalıdır" })
  @MaxLength(50, { message: "İsim en fazla 50 karakter olmalıdır" })
  name!: string;

  @ApiProperty({ type: String, format: "email", example: "ornek@example.com" })
  @Trim()
  @ToLowerCase()
  @IsEmail({}, { message: "Geçerli bir email adresi giriniz" })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @IsOptional()
  @Trim()
  @IsString({ message: "Açıklama metin olmalıdır" })
  @MaxLength(200, { message: "Açıklama en fazla 200 karakter olmalıdır" })
  description?: string | null;
}
```

Add to `dtos/request/index.ts` and `dtos/index.ts`. This example intentionally
accepts an omitted or null description; use the
[nullable/optional rules](dto-openapi.md#required-optional-and-nullable) when the
contract differs.

---

## Response DTO — `dtos/response/<name>.res.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import type { UserStatus } from "#database/enums.js";

export class ThingResDto {
  @ApiProperty({ type: String })
  @Expose()
  id!: string;

  @ApiProperty({ type: String })
  @Expose()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  description!: string | null;

  @Expose()
  @EnumTransformer({ enumType: "UserStatus" })
  status!: EnumTransformerValueDto<UserStatus>;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;

  @ApiPropertyOptional({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({
    format: "dd MMMM yyyy HH:mm",
    withRawAndDisplay: true,
    skipNullish: true,
  })
  lastSeenAt?: DateTransformerValueDto<string> | null;
}
```

Add to `dtos/response/index.ts` and `dtos/index.ts`. The date DTO is a runtime
import because Swagger references it; the enum transformer supplies its own
object schema. See [DTO and OpenAPI contracts](dto-openapi.md) for nested DTOs,
arrays, plain ISO date contracts, and generated-type verification.

---

## Repository — `repository/<name>.repository.ts`

```ts
import { Injectable } from "@nestjs/common";

import { DatabaseService } from "#database/database.service.js";
import { asUuid } from "#database/scalars.js";

@Injectable()
export class ThingRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client;
  }

  // ID ile aktif kaydı getirir
  async findById(id: string) {
    return this.db.orm.public.Thing.where({ id: asUuid(id) })
      .where((t) => t.deletedAt.isNull())
      .select("id", "name", "status", "createdAt")
      .first();
  }

  // Yeni kayıt oluşturur
  async create(input: { name: string }) {
    return this.db.orm.public.Thing.select("id").create({ name: input.name });
  }
}
```

Add to `repository/index.ts` (both the array and named export).

---

## Service — `services/<name>.service.ts`

```ts
import { Injectable, NotFoundException } from "@nestjs/common";

import { OkResponse } from "#/core/http/index.js";
import { ThingRepository } from "#/modules/thing/repository/index.js";
import type { CreateThingBodyDto } from "#/modules/thing/dtos/index.js";

// Thing iş kuralları
@Injectable()
export class ThingService {
  constructor(private readonly thingRepository: ThingRepository) {}

  async getById(id: string): Promise<OkResponse> {
    const thing = await this.thingRepository.findById(id);
    if (!thing) {
      throw new NotFoundException("Kayıt bulunamadı");
    }
    return new OkResponse("Kayıt getirildi", thing);
  }

  async create(body: CreateThingBodyDto): Promise<OkResponse> {
    const created = await this.thingRepository.create({ name: body.name });
    return new OkResponse("Kayıt oluşturuldu", created);
  }
}
```

Add to `services/index.ts` (array + named export).

---

## Controller — `controllers/<name>.controller.ts`

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  Serialize,
} from "#/core/decorators/index.js";
import { CreateThingBodyDto, ThingResDto } from "#/modules/thing/dtos/index.js";
import { ThingService } from "#/modules/thing/services/index.js";

@ApiTags("Thing")
@Controller("things")
export class ThingController {
  constructor(private readonly thingService: ThingService) {}

  @Get(":id")
  @Serialize(ThingResDto)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kaydı getir" })
  @ApiSuccessResponse({ model: ThingResDto, status: 200, description: "Kayıt" })
  @ApiErrorResponses(401, 404, 500)
  async getById(@Param("id") id: string) {
    return this.thingService.getById(id);
  }

  @Post()
  @Serialize(ThingResDto)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kayıt oluştur" })
  @ApiSuccessResponse({
    model: ThingResDto,
    status: 201,
    description: "Oluşturuldu",
  })
  @ApiErrorResponses(400, 401, 500)
  async create(@Body() body: CreateThingBodyDto) {
    return this.thingService.create(body);
  }
}
```

Add to `controllers/index.ts` (array + named export).

---

## Listing flow — `Paginator` is mandatory

Every collection endpoint follows this service shape. Import `Paginator`
directly from `#/core/utils/paginator.js`, register it in the feature module's
providers, and add `@Serialize(ItemResDto)` to the controller handler.

```ts
async list(page: number, limit: number): Promise<OkResponse> {
  const { docs, pagination } = await this.paginator.apply({
    page,
    limit,
    count: () => this.thingRepository.count(),
    query: ({ limit, offset }) =>
      this.thingRepository.findPage({ limit, offset }),
  });

  return new OkResponse("Kayıtlar listelendi", docs, {
    meta: { pagination },
  });
}
```

The repository owns `count()` and `findPage({ limit, offset })`; the controller
must document the response with `@ApiSuccessResponse({ model: ItemResDto,
isArray: true, pagination: "offset" })`. Ever-growing tables use
`paginator.applyCursor` + `CursorQueryDto` and `pagination: "cursor"` instead
(see `shared-utilities.md`). Do not return an unpaginated array.

---

## Barrel — `<layer>/index.ts`

```ts
import { ThingService } from "#/modules/thing/services/thing.service.js";

export const ThingServices = [ThingService];

export { ThingService };
```

---

## Module — `<feature>.module.ts`

```ts
import { Module } from "@nestjs/common";

import { ThingControllers } from "#/modules/thing/controllers/index.js";
import { ThingRepositories } from "#/modules/thing/repository/index.js";
import { ThingServices } from "#/modules/thing/services/index.js";

@Module({
  controllers: [...ThingControllers],
  providers: [...ThingRepositories, ...ThingServices],
  exports: [...ThingRepositories, ...ThingServices],
})
export class ThingModule {}
```

Register `ThingModule` in `src/app.module.ts`.
