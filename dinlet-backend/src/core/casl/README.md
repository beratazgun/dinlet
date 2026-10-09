# CASL Yetkilendirme Sistemi

Bu klasör, eski elle yazılmış RBAC (`PermissionsGuard` + `@RequirePermissions`)
sisteminin yerini alan [CASL](https://casl.js.org) tabanlı yetkilendirme
altyapısını içerir. `@casl/ability` + `@casl/prisma` kullanır.

## İçindekiler

- [Model: kod mu, DB mi?](#model-kod-mu-db-mi)
- [Çalışma akışı](#çalışma-akışı)
- [Temel kullanım](#temel-kullanım)
- [Yeni bir subject/modül eklemek](#yeni-bir-subjectmodül-eklemek)
- [Rol bazlı kontrol](#rol-bazlı-kontrol)
- [Conditional / ownership kontrolü](#conditional--ownership-kontrolü)
- [Servis katmanında permission kontrolü](#servis-katmanında-permission-kontrolü)
- [Cache invalidation](#cache-invalidation)
- [`@casl/prisma` neden `/runtime`'dan import ediliyor?](#casl prisma-neden-runtimedan-import-ediliyor)
- [Sınırlamalar / gelecek genişletmeler](#sınırlamalar--gelecek-genişletmeler)

## Model: kod mu, DB mi?

İki ayrı katman var, birbirinin yerini tutmaz:

| Katman  | Neyi tanımlar                                                                      | Nerede                                                         |
| ------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Kod** | Bir endpoint/servis metodunun **hangi kuralı** gerektirdiği (`action` + `subject`) | `@CheckPolicies(...)` çağrıları, controller/service içinde     |
| **DB**  | **Hangi rolde** o kuralın olduğu                                                   | `Permission` (`module`, `action`) + `RolePermission` tabloları |

`Permission.module` kolonu CASL `subject`'ine, `Permission.action` kolonu CASL
`action`'ına karşılık gelir. `module` değeri, ilgili Prisma model adıyla
**birebir (PascalCase)** eşleşmelidir (ör. `'Job'`) — bkz.
[`casl-ability.type.ts`](./casl-ability.type.ts) → `AppSubjects`.

## Çalışma akışı

```
İstek → AuthGuard (oturum cookie'sinden kullanıcıyı doğrula)
      → PoliciesGuard (@CheckPolicies metadata'sını oku)
          → CaslAbilityFactory.createForUser(user)
              → user.role.isSuper ise: can('manage', 'all')
              → değilse: Redis cache (role:permissions:{roleId})
                  → cache miss ise RolePermission → Permission DB sorgusu
                  → sonucu 24 saatliğine cache'le
              → AbilityBuilder ile Ability nesnesi kur
          → handler(ability) çalıştır (her handler AND'lenir)
      → false ise 403, true ise route handler'a devam
```

İlgili dosyalar:

- [`casl-ability.type.ts`](./casl-ability.type.ts) — `AppAbility`, `AppSubjects`, `AppRule` tipleri.
- [`casl-ability.factory.ts`](./casl-ability.factory.ts) — `CaslAbilityFactory`, DB/Redis'ten ability kurar.
- `src/core/guards/policies.guard.ts` — `PoliciesGuard`, `@CheckPolicies` metadata'sını okuyup ability'ye karşı çalıştırır.
- `src/core/decorators/check-policies.decorator.ts` — `@CheckPolicies` decorator'ı + `PolicyHandler` tipi.
- `src/infra/redis/helpers/redis-permission.helper.ts` — rol kurallarının Redis cache'i.

## Temel kullanım

Controller'da, tek bir action+subject kontrolü:

```ts
import { AppAbility } from '@/core/casl';
import { CheckPolicies } from '@/core/decorators';

@Get()
@CheckPolicies((ability: AppAbility) => ability.can('list', 'Job'))
async list() {
  return this.jobService.list();
}
```

Birden fazla handler **AND**'lenir (`every()`):

```ts
@CheckPolicies(
  (ability) => ability.can('update', 'Job'),
  (ability) => ability.can('publish', 'Job'),
)
```

**OR** gereken durumlarda ayrı bir "mod" parametresi yok — tek handler içinde
düz `||` kullanılır:

```ts
@CheckPolicies(
  (ability) => ability.can('update', 'Job') || ability.can('manage', 'all'),
)
```

## Yeni bir subject/modül eklemek

Örnek: `Media` modülüne CASL taşımak istiyorsunuz.

1. `casl-ability.type.ts` içinde `AppSubjects` union'ına ekleyin:
   ```ts
   export type AppSubjects = 'Job' | 'Media' | 'all';
   ```
   (Bu adım atlanırsa `ability.can('read', 'Media')` derleme hatası verir —
   subject isimlerinin kod/DB arasında senkron kalmasını zorlayan tek nokta budur.)
2. `prisma/seed/permissions.seed.ts`'e satır(lar) ekleyin: `{ name: 'media.read', displayName: '...', module: 'Media', action: 'read' }`.
3. İlgili role'e `RolePermission` ataması yapın (elle ya da bir seed script'iyle).
4. Controller'a `@CheckPolicies((ability: AppAbility) => ability.can('read', 'Media'))` ekleyin.
5. Var olan bir rolün izinleri değiştiyse [cache'i temizleyin](#cache-invalidation).

## Rol bazlı kontrol

CASL'ın odak noktası **permission**'dır, rol değil — ama iki farklı ihtiyaç için iki farklı yol var:

**a) Basit "bu rol / üstü" kontrolü (permission tablosuna hiç gerek yok)**

Oturum `role.code` taşıyor ama rank taşımıyor (`rank` DB'de ama oturum
verisinde yok — gerekirse `SessionUser`'a eklenebilir). En basit yol,
CASL'ı hiç devreye sokmadan doğrudan controller/service içinde kontrol etmek:

```ts
if (user.role.code !== 'admin' && !user.role.isSuper) {
  throw new ForbiddenException();
}
```

Bunu decorator'laştırmak isterseniz `@Roles('admin')` tarzı bir metadata
decorator'ı + onu okuyan bir guard yazmanız gerekir (proje bu deseni
kasıtlı olarak barındırmıyor — bkz. kaldırılan `roles.decorator.ts`, hiçbir
guard'a bağlı değildi). Permission tabanlı `@CheckPolicies` zaten rolleri
permission'lar üzerinden dolaylı temsil ettiği için genelde ayrı bir rol
guard'ına gerek kalmıyor.

**b) CASL üzerinden "role-tag" permission'ı**

Belirli bir action'ı sadece belirli rollere bağlamak istiyor ama yine de CASL
altyapısını (cache, tek kontrol noktası) kullanmak istiyorsanız, o rolü temsil
eden bir permission tanımlayıp sadece o role atayın:

```
Permission: module='AdminPanel', action='access'  → sadece 'admin' ve 'super_admin' rolüne ata
```

```ts
@CheckPolicies((ability: AppAbility) => ability.can('access', 'AdminPanel'))
```

Bu, "rol" kavramını yine permission sistemi üzerinden ifade eder — DB'den
yönetilebilir olması ve tek bir yetkilendirme mekanizması olması avantajıdır.

## Conditional / ownership kontrolü

Şu anki `Permission` tablosu sadece `{module, action}` tutar — **koşul (conditions)
saklamaz**. "Sadece kendi kaydını güncelleyebilir" gibi bir kural için iki
yaklaşım var:

**a) Servis katmanında instance-level kontrol (önerilen, çoğu durumda yeterli)**

CASL'ın kendi önerdiği pattern: guard sadece **tip seviyesinde** izni kontrol
eder ("bu kullanıcı herhangi bir Job'u update edebilir mi"), asıl **sahiplik
kontrolü servis katmanında**, ability'ye gerçek nesneyi vererek yapılır:

```ts
// job.controller.ts — sadece genel yetki kontrolü
@Patch(':code')
@CheckPolicies((ability: AppAbility) => ability.can('update', 'Job'))
async update(@Param('code') code: string, @Body() data: UpdateJobBodyDto, @CurrentUser() user: SessionUser) {
  return this.jobService.update(code, data, user);
}
```

```ts
// job.service.ts — instance-level (ownership) kontrolü
import { subject } from '@casl/ability';

async update(code: string, data: UpdateJobBodyDto, user: SessionUser) {
  const job = await this.jobRepository.findByCode(code);
  const ability = await this.caslAbilityFactory.createForUser(user);


  // `subject()` düz bir objeye CASL subject-type etiketi ekler; ability bu
  // sayede `job.ownerId` gibi alanları conditions'a karşı eşleştirebilir.
  if (ability.cannot('update', subject('Job', job))) {
    throw new ForbiddenException('Bu job üzerinde işlem yapma yetkiniz yok');
  }

  // ...update işlemi
}
```

Bunun çalışması için ability kurulurken ilgili kurala bir `conditions` objesi
verilmiş olması gerekir — bu da (b)'deki DB genişletmesiyle ya da kod içinde
elle (`can('update', 'Job', { ownerId: user.id })`) yapılabilir.

**b) DB'den koşullu kural tanımlamak**

Tam CASL gücünü (koşulun DB'den, role göre değişerek gelmesi) istiyorsanız
`Permission` şemasına bir `conditions Json?` kolonu eklemeniz gerekir. Örnek
akış:

1. Şema: `Permission.conditions Json?` (ör. `{ "ownField": "ownerId" }` gibi
   _template_ bir tanım — CASL kendi başına `${user.id}` interpolasyonu
   yapmaz, bunu `CaslAbilityFactory` içinde siz üretirsiniz).
2. `CaslAbilityFactory.getRolePermissionRules` içinde, kural `conditions`
   taşıyorsa gerçek `user.id` ile doldurup `can(action, subject, conditions)`
   şeklinde ability'ye ekleyin:
   ```ts
   const conditions = rule.ownField ? { [rule.ownField]: user.id } : undefined;
   can(rule.action, rule.subject, conditions);
   ```
3. Servis katmanında yine `subject('Job', job)` ile instance kontrolü yapın (yukarıdaki (a) adımı).

Bu proje şu an (a)'yı temel model olarak öneriyor; (b) yalnızca çok sayıda
role'e göre değişen dinamik ownership kuralı gerektiğinde eklenmeye değer —
aksi halde gereksiz karmaşıklık.

## Servis katmanında permission kontrolü

Evet, mümkün ve gerektiğinde önerilir (özellikle instance-level/ownership
kontrolü için — guard sadece tip seviyesinde kontrol yapabilir, spesifik
kayda guard aşamasında henüz erişilmez). `CaslAbilityFactory` sıradan bir
`@Injectable()` — herhangi bir Service'e inject edilebilir:

```ts
@Injectable()
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async someAction(id: number, user: SessionUser) {
    const ability = await this.caslAbilityFactory.createForUser(user);

    if (ability.cannot('someAction', 'Job')) {
      throw new ForbiddenException();
    }
    // ...
  }
}
```

`user` (`SessionUser`) servise controller'dan `@CurrentUser()` ile taşınmalı —
projede request-scope'tan kullanıcıyı örtük okuyan bir mekanizma yok
(`RequestContextService` sadece HATEOAS/URL context'i taşır, kullanıcıyı değil).

Not: `createForUser` her çağrıda Redis'e bakar (cache hit'te ~1 network
round-trip). Aynı request içinde birden fazla kontrol yapacaksanız `ability`'yi
bir kez kurup tekrar kullanın, tekrar tekrar `createForUser` çağırmayın.

## Cache invalidation

Bir rolün izinleri değiştiğinde (`RolePermission` ekleme/silme) Redis cache
otomatik güncellenmez — 24 saatlik TTL'e kadar eski kurallarla çalışmaya devam
eder. Değişiklik yapan admin akışında mutlaka çağırın:

```ts
await this.redisPermissionHelper.invalidate(roleId); // tek rol
await this.redisPermissionHelper.invalidateAll(); // tüm roller (nadiren gerekir)
```

## `@casl/prisma` neden `/runtime`'dan import ediliyor?

`@casl/prisma`'nın kök giriş noktası (`@casl/prisma`), `PrismaQuery`/`WhereInput`
tiplerini üretmek için dahili olarak `import type { Prisma } from '@prisma/client'`
yapıyor. Bu proje Prisma 7'de **custom generator output** kullanıyor
(`prisma/schema.prisma` → `output = "../generated/prisma"`), yani gerçek model tipleri `node_modules/@prisma/client`'a
**hiç yazılmıyor** — oraya sadece boş/varsayılan bir shim kalıyor. Sonuç:
kök `@casl/prisma` import'u bu projede `tsc`'yi kırıyor.

`@casl/prisma/runtime` alt-path'i ise `createPrismaAbility`, `accessibleBy`,
`createCaslExtension` gibi asıl çalışma zamanı API'lerini **`@prisma/client`
tipine hiç dokunmadan** dışa verir — bu yüzden tüm importlar buradan yapılıyor
(bkz. `casl-ability.factory.ts`). `accessibleBy()` gibi Prisma-tipli `where`
üretimi ileride gerekirse, model tipleri `@generated/prisma/client`'tan
alınarak elle bir `PrismaTypeMap` kurulması gerekir (aşağıya bakın).

## Sınırlamalar / gelecek genişletmeler

- **`accessibleBy()` henüz kullanılmıyor.** `ability`'den doğrudan Prisma
  `where` filtresi üretip (`prisma.job.findMany({ where: accessibleBy(ability).ofType('Job') })`)
  resource-scoped listeleme yapmak isterseniz, `@casl/prisma/runtime`'daki
  `accessibleBy` + `PrismaQueryFactory` kullanılabilir; ama tip güvenliği için
  `@generated/prisma/client`'tan gelen gerçek model tipleriyle elle bir
  `PrismaTypeMap` tanımlamanız gerekir (yukarıdaki `/runtime` notuna bakın).
- **Field-level kısıtlama kullanılmıyor.** CASL `can(action, subject, fields, conditions)`
  imzasıyla "şu alanları güncelleyebilir ama şu alanları göremez" gibi kurallar
  da destekler; bu proje şu an sadece action+subject (ve gerekirse conditions)
  kullanıyor.
- **`AppSubjects` elle genişletilen bir union.** Yeni modül eklendikçe
  [yukarıdaki adımları](#yeni-bir-subjectmodül-eklemek) izleyin.
