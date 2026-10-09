# Geliştirici notları

Backend'in günlük geliştirme notları: oturum modeli, altyapı bileşenleri,
testler ve Prisma 8 (contract-first) iş akışı. Proje özeti için
[README](../README.md).

## Local'de çalıştırma

```bash
pnpm run dev
```

Uygulamayı başlatmadan önce `config/.env` içinde `DATABASE_URL` değerini ayarla.

## Kimlik doğrulama — `@fastify/session`

Kimlik, JWT ile değil **sunucu tarafı oturumla** taşınır. Akış:

1. `POST /api/v1/auth/login` başarılı olursa oturum id'si `regenerate()` ile
   yenilenir (session fixation koruması), kullanıcı oturuma yazılır ve imzalı,
   `httpOnly` bir cookie döner (`SESSION_COOKIE_NAME`, varsayılan `sid`).
2. Oturum verisi Redis'te durur: `src/infra/session/redis-session.store.ts`.
   Plugin'in varsayılan in-memory store'u bellek sızdırdığı için kullanılmaz.
3. `rolling: true` olduğu için oturum her yanıtta kendini tazeler — **ayrı bir
   token yenileme ucu yoktur.**
4. `AuthGuard` her istekte oturumda kullanıcı olup olmadığına ve isteğin oturumun
   açıldığı cihazdan gelip gelmediğine bakar; uyuşmazlıkta oturumu düşürüp
   cookie'yi temizler.

İlgili env değişkenleri: `SESSION_SECRET` (en az 32 karakter),
`SESSION_COOKIE_NAME`, `SESSION_MAX_AGE` (saniye).

### Mobil oturum (Bearer)

Mobil uygulama aynı Redis oturumunu cookie yerine `Authorization` başlığıyla
taşır. Oturum modeli, listeleme ve sonlandırma iki yolda da aynıdır.

1. `POST /api/v1/auth/login` (veya `/auth/google/mobile`, `/auth/apple/mobile`)
   `X-Client: mobile` ve `X-Device-Id: <kurulumda üretilen UUID>` başlıklarıyla
   çağrılır; yanıtta `data.accessToken` döner (imzalı oturum kimliği, JWT değil).
2. Sonraki isteklerde `Authorization: Bearer <accessToken>` ve `X-Device-Id`
   gönderilir. Token başka bir cihaz kimliğiyle kullanılırsa oturum düşürülür.
3. Socket.IO bağlantısında `auth: { token, deviceId }` verilir.

Mobil oturum ömrü `SESSION_MAX_AGE_MOBILE` (varsayılan 30 gün).

CSRF koruması yoktur: istemci yalnızca mobil uygulamadır ve oturumu taşıyan
`Authorization` başlığını tarayıcılar kendiliğinden göndermez. Cookie modu
geliştirme/Swagger içindir (`SameSite=Lax`). Tarayıcıdan cookie ile çalışan
bir istemci eklenirse CSRF koruması geri getirilmelidir.

### Giriş güvenliği

- **Hız sınırı (IP):** `short` (dk'da 100) ve `medium` (5 dk'da 500) global
  pencereler; auth uçları bunları daraltır (ör. login: dk'da 5).
- **Hesap kilitleme:** aynı e-posta için 15 dk içinde 5 başarısız deneme →
  15 dk kilit (**429** + `Retry-After`). Kullanıcıya e-posta + uygulama içi
  bildirim gider; şifre sıfırlama kilidi hemen kaldırır.
- **Yeni cihaz uyarısı:** daha önce görülmemiş bir cihazdan (tarayıcı/OS;
  sürüm güncellemeleri sayılmaz) girişte e-posta + uygulama içi bildirim.

### Oturum uçları

| Uç                      | Ne yapar                                            |
| ----------------------- | --------------------------------------------------- |
| `POST /auth/login`      | Oturum açar, cookie döner                           |
| `POST /auth/logout`     | Oturumu store'dan siler, cookie'yi temizler         |
| `GET /auth/sessions`    | Kullanıcının açık oturumlarını sayfalı listeler     |
| `DELETE /auth/sessions` | Seçili oturumları sonlandırır (kendi oturumu dahil) |

Bir kullanıcının açık oturumları `user:sessions:<userId>` Redis set'inde
indekslenir; TTL ile düşen kayıtlar listeleme sırasında otomatik temizlenir
(`src/infra/redis/helpers/redis-session.helper.ts`).

## Altyapı

- **Asenkron kuyruk (BullMQ):** `src/infra/queue/` — ölçeklenebilir yapı:
  merkezi `QueueName` + `DEFAULT_JOB_OPTIONS`, ortak `BaseProcessor` (log +
  retry/DLQ), ve `queues/<name>/` altında producer/processor ayrımı. E-posta
  request dışında, retry (3 deneme) + üstel backoff ile gönderilir; başarısızlar
  24 saat DLQ'da kalır. Kuyruğa almak: `EmailQueueService.enqueueEmail(...)`.
  **Yeni kuyruk ekleme reçetesi:** `project-standards` skill →
  `references/bullmq-queues.md`.
- **Denetim kaydı (audit):** `src/infra/audit/` — her HTTP isteği (endpoint,
  kullanıcı, IP, istek başlık/query/params/gövde, yanıt gövdesi, durum, süre)
  redakte edilip BullMQ üzerinden `audit_logs` tablosuna toplu yazılır; istek DB'yi
  beklemez. Her yanıtta `x-request-id` döner. Okuma: `GET /audit-logs`,
  `GET /audit-logs/:id` (CASL `AuditLog`). Saklama: `AUDIT_LOG_CLEANUP` job'ı
  (varsayılan 90 gün). Uç bazında ayar: `@AuditOptions(...)`; alan bazlı
  eski/yeni değer farkı: `@TrackChanges({ model })` veya `AuditContextService`.
- **Medya yükleme:** `src/modules/media/` — dosya API'den geçmez:
  `POST /media/uploads` imzalı `PUT` URL'i verir, istemci dosyayı doğrudan
  R2/S3'e yükler, `POST /media/uploads/:uploadId/complete` boyut/tipi doğrulayıp
  kaydı açar. Profil görseli: `PUT|DELETE /media/profile/{avatar|cover}`.
  Production bucket'ında `tmp/` önekine 1 günlük lifecycle (silme) kuralı tanımlayın;
  tamamlanmayan yüklemeleri o temizler.
- **Uygulama içi bildirim:** `src/modules/notification/` — `GET /notifications`
  (imleçli), `GET /notifications/unread-count`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all`. Yeni bildirimler Socket.IO
  `/notifications` namespace'inden anlık gelir (`withCredentials: true`; aynı
  oturum cookie'si). Redis adapter'ı sayesinde çok-instance'ta çalışır.
- **Observability (NestJS Observe):** `OBSERVE_APP_KEY` + `OBSERVE_APP_SECRET`
  verilince request/job/cron/WebSocket/DB trace'leri, hata gruplama ve runtime
  metrikleri https://observe.nestjs.com paneline gider; verilmezse tamamen
  kapalıdır. Trace id, `x-request-id` ve audit kaydıyla aynıdır.
- **E-posta şablonları:** `pnpm db:seed` `notification_templates`'i doldurur.
  `EMAIL_DELIVERY=log` ile e-postalar gönderilmez, loglanır.
- **Dağıtık rate-limit:** `ThrottlerModule` sayaçları Redis'te tutar
  (`@nest-lab/throttler-storage-redis`) → çok-instance'ta tutarlı.
- **Git hooks:** `husky` + `lint-staged` (commit'te `oxlint --fix`) +
  `commitlint` (Conventional Commits). `pnpm install` sonrası otomatik kurulur.

## Testler

```bash
pnpm test        # unit testler (test/*.spec.ts)

docker compose up -d dinlet-postgres dinlet-redis dinlet-localstack
pnpm test:e2e    # e2e (test/e2e/*.e2e-spec.ts) — `dinlet-test` DB'sini kullanır
```

E2E ilk çalıştırmada test veritabanının şemasını kurar ve seed'i çalıştırır.
Veritabanı yoksa bir kez oluşturun:
`docker exec dinlet-postgres createdb -U dinlet-user dinlet-test`.
Hata ayıklarken `E2E_LOG=1 pnpm test:e2e` request loglarını açar. CI ikisini de çalıştırır.

## Prisma 8 — önce mantığı anla ("contract-first")

Eski Prisma'da `schema.prisma`'yı düzenler, `db push` derdin. Prisma 8'de akış şu:

1. **Contract'ı düzenlersin** — `src/infra/database/contract.ts` + `src/infra/database/models/*.ts`
2. **Contract'ı "emit" edersin** → makine tarafından okunan `contract.json` / `contract.d.ts` üretilir
3. **DB'ye uygularsın** → iki yol var: hızlı yol (`db update`) veya resmi yol (`migration plan` + `db migrate`)

Yani eskiden tek komuttu (`db push`); şimdi **önce emit, sonra uygula** diye iki adım var.

İlgili dosyalar:

- Contract kaynağı: `src/infra/database/contract.ts` (+ `models/*.ts`)
- Runtime client: `src/infra/database/db.ts`
- Prisma config: `prisma.config.ts`
- Üretilen artefaktlar: `src/infra/database/generated/{contract.json,contract.d.ts}`

## Local'de hızlı güncelleme (eski `db push`)

```bash
pnpm run contract:emit   # 1. contract.json/d.ts'yi tazele
pnpm run db:update       # 2. DB'yi contract'a göre güncelle
```

Bu ikisi eski `npx prisma db push`'un tam karşılığıdır. `db:update` contract ile canlı
DB arasındaki farkı hesaplar ve **doğrudan** uygular — migration dosyası yazmaz.
**Sadece kendi local dev DB'nde kullan** (paylaşılan/production DB'de asla).

> **İpucu:** Ne yapacağını önce görmek için `prisma db update --dry-run` çalıştır.
> Veri kaybettirecek (destructive) bir işlem varsa `-y` ile onaylaman gerekir.

## Komutların tamamı

| Komut                    | Ne yapar                                                                             | Ne zaman                                                       |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `contract:emit`          | Contract kaynağından `contract.json` + `contract.d.ts` üretir. DB'ye dokunmaz.       | Contract'ı her düzenledikten **sonra**, DB komutundan **önce** |
| `db:init`                | Boş bir DB'yi ilk kez kurar: tabloları oluşturur + marker satırını yazar.            | Sıfırdan yeni bir DB'de **ilk kurulum**                        |
| `db:update`              | Contract ↔ canlı DB farkını **doğrudan** uygular (migration dosyası yazmaz).         | Local dev'de hızlı güncelleme (eski `db push`)                 |
| `db:verify`              | DB gerçekten contract ile uyuşuyor mu diye kontrol eder (teşhis).                    | Drift şüphesi, manuel SQL sonrası, backup restore sonrası      |
| `db:seed`                | `src/infra/database/seed/main.ts`'i çalıştırır, örnek veriyi basar.                  | Tablolar hazır olduktan sonra                                  |
| `db:reset`               | Şemaları siler, `db update` + `db:seed` ile sıfırdan kurar (production'da çalışmaz). | Local DB'yi tamamen sıfırlamak                                 |
| `migration:plan`         | Contract farkından `migrations/app/<tarih>_<isim>/` altına migration paketi yazar.   | Paylaşılan branch / production'a çıkacak değişiklik            |
| `migration:show`         | Tek bir migration paketinin içeriğini gösterir.                                      | `migrate`'ten önce inceleme                                    |
| `migrate` (`db migrate`) | Bekleyen migration'ları sırayla, transaction içinde DB'ye uygular.                   | Resmi yolda uygulama adımı                                     |
| `migration:status`       | Marker nerede, DB güncel mi / geride mi gösterir.                                    | CI'da, deploy öncesi kontrol                                   |

## İki senaryo, iki sıralama

**A) Local'de hızlı iterasyon** (eski `db push` alışkanlığı):

```bash
# contract.ts'i düzenle, sonra:
pnpm run contract:emit
pnpm run db:update
pnpm run db:seed          # gerekiyorsa
```

**B) Paylaşılan branch / production'a çıkacak değişiklik** (kayıtlı, geri oynatılabilir):

```bash
# contract.ts'i düzenle, sonra:
pnpm run contract:emit
pnpm run migration:plan --name add_user_phone   # migration paketi yazar
pnpm run migration:show                          # incele
pnpm run migrate                                 # DB'ye uygula
pnpm run migration:status                        # doğrula
```

## Özet

- **Eski `db push` = `contract:emit` + `db:update`** → sadece local dev.
- Değişiklik başka geliştiricilere/prod'a gidecekse **`migration:plan` + `migrate`** kullan.
- Bir şeyler ters gittiğinde teşhis için **`db:verify`** / **`migration:status`**.

## İlk kurulum (boş DB)

Sıfırdan bir DB'yi ayağa kaldırmak için iki yol var:

```bash
# Hızlı yol (local dev):
pnpm run contract:emit
pnpm run db:init          # boş DB'yi baseline'lar: tabloları kurar + marker yazar
pnpm run db:seed          # gerekiyorsa

# ya da commit'li migration ile (paylaşılan/prod):
pnpm run contract:emit
pnpm run migration:plan --name init
pnpm run migrate
```

## Uyarılar / notlar

- **`::type` cast'li SQL default'ları normalize biçimde yaz.** Postgres `gen_random_uuid()::text`
  gibi bir default'u `(gen_random_uuid())::text` olarak saklar; contract'ta ilk biçimi yazarsan
  `db verify` / `migrate` "schema does not satisfy contract" verir. `defaultSql`'e dıştan parantezli
  (normalize) biçimi yaz.
- **PostgreSQL identifier sınırı 63 karakter.** Çok kolonlu unique/index isimleri bu sınırı
  aşarsa doğrulama başarısız olur; ilgili `constraints.unique/index` çağrısına kısa bir
  `{ name: "..." }` ver.
- `migrations/` altındaki `migration.ts` dosyaları framework tarafından üretilir ve doğrudan
  `node` ile çalıştırılır; app typecheck'inden `tsconfig.json` `exclude` ile hariç tutulur.
