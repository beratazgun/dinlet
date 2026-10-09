# Background Jobs — BullMQ Queue Standard

Asenkron / arka plan işleri **BullMQ** ile yapılır. Altyapı `src/infra/queue/`
altındadır ve **global**'dir (her modülden producer enjekte edilebilir).

> Amaç: request'i bloklayan veya güvenilir tekrar (retry) gerektiren yan etkileri
> (e-posta, webhook, görsel işleme, dışa aktarma, senkronizasyon…) request
> dışına, retry/backoff/DLQ garantili bir kuyruğa taşımak.

Bu doküman **yeni bir kuyruğun nasıl ekleneceğinin** tek kaynağıdır. Mevcut
`email` kuyruğu referans implementasyondur — yeni kuyruk eklerken onu birebir
aynala.

---

## 0. Ne zaman kuyruk, ne zaman değil

| Durum                                                                               | Kullan                                             |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| E-posta/bildirim/webhook gönderimi, dış API çağrısı, PDF/rapor üretimi, ağır işleme | **BullMQ kuyruğu** (retry + request dışı)          |
| Periyodik/zamanlanmış iş (cron): günlük rapor, cleanup, sync                        | **Job sistemi** (`src/infra/job/`) — aşağıya bak   |
| Aynı transaction içinde yapılması gereken, tutarlılık kritik iş                     | Kuyruk **değil**; servis/repository içinde senkron |

### BullMQ ↔ Job (cron) sistemi — ikisi FARKLI, tekrar DEĞİL

Bu repoda arka plan işi için **iki ayrı altyapı** vardır. Doğru olanı seç:

|              | **BullMQ** (`src/infra/queue/`)    | **Job sistemi** (`src/infra/job/` + `Job`/`JobExecution` tabloları)                       |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Amaç         | Olay-tetikli, **anlık** yan etki   | **Zamanlanmış / tekrarlayan** (cron) işler                                                |
| Tetik        | "Şimdi şunu yap" (event → enqueue) | "Her gün 03:00'te yap" (cron pattern)                                                     |
| Tanım        | Kodda (producer'dan enqueue)       | **DB'de** (`Job` tablosu) + REST CRUD (`job.controller.ts`); redeploy'suz aç/kapa/düzenle |
| Geçmiş/audit | Redis'te geçici                    | **`JobExecution` tablosunda** kalıcı (status/süre/hata/retry), Postgres'te sorgulanabilir |
| Retry        | `attempts` + backoff + DLQ (Redis) | Handler + `retry_limit` / `consecutive_failures` (DB)                                     |
| Depolama     | Redis                              | Postgres                                                                                  |

**Karar kuralı:**

- İş bir **olaya** tepkiyse ve/veya sağlam retry/DLQ istiyorsan → **BullMQ**.
- İş **takvime** bağlıysa (cron), ops'un DB/API'den yönetmesi veya kalıcı çalışma
  geçmişi (audit) gerekiyorsa → **Job sistemi** (`src/infra/job/`, yeni bir
  `AbstractJobHandler` ekleyerek).
- İkisini **birbirinin yerine koyma**: BullMQ DB-driven dinamik zamanlama +
  Postgres audit vermez; Job sistemi de anlık/olay-tetikli retry-kuyruğu değildir.
  (BullMQ'nun `repeat` özelliği cron yapabilir ama DB-yönetimi + Postgres audit'i
  getirmez — o yüzden periyodik işlerde Job sistemi tercih edilir.)

Kuyruğa iş atmak **event-driven kuralıyla** birleşir: business servis domain
event'i emit eder → `@OnEvent` handler kuyruğa job ekler → processor işi yapar.
Handler'ın içinde sağlayıcıyı (SMTP/HTTP) doğrudan çağırma; **kuyruğa al**.

```
Service ──emit──> EventEmitter2 ──@OnEvent──> Handler ──enqueue──> Queue ──> Processor
```

---

## 1. Mimari

```
src/infra/queue/
  queue.module.ts          # Global. forRootAsync (Redis + DEFAULT_JOB_OPTIONS) + tüm kuyrukları register eder.
  queue.constants.ts       # QueueName (tüm kuyruk adları) + DEFAULT_JOB_OPTIONS
  base.processor.ts        # BaseProcessor<T> — ortak log + retry/DLQ görünürlüğü
  index.ts                 # barrel
  queues/
    <name>/
      <name>.constants.ts        # <Name>JobName (job adları)
      <name>.types.ts            # <Name>JobData (job verisi tipi)
      <name>-queue.service.ts    # <Name>QueueService — PRODUCER (enqueue API)
      <name>.processor.ts        # <Name>Processor — WORKER (BaseProcessor türevi)
      index.ts                   # barrel
```

**Roller net ayrılır:**

- **Producer** (`*-queue.service.ts`, `@Injectable`): sadece `queue.add(...)`
  sarmalayan ince metodlar. Export edilir → her yerden enjekte edilir.
- **Processor** (`*.processor.ts`, `@Processor(QueueName.X)`): işi yapan worker.
  `BaseProcessor`'dan türer, sadece `logger` + `handle(job)` verir. Export edilmez.

**`BaseProcessor` neyi garanti eder** (alt sınıf tekrar yazmaz):

- Başlangıç/bitiş + süre logu.
- Hata → deneme sayısına göre `retry` (warn) / `DLQ` (error) logu, sonra hatayı
  **yeniden fırlatır** (BullMQ backoff/retry çalışsın).

> Neden `@OnWorkerEvent` değil? BullMQ explorer event handler'ları yalnızca
> **alt-sınıf prototibinden** tarar; base sınıftaki miras alınanları görmez. Bu
> yüzden ortak görünürlük `process()` içinde toplanır (miras güvenli).

---

## 2. `DEFAULT_JOB_OPTIONS` (retry / backoff / DLQ)

`queue.constants.ts` içinde, tüm kuyruklara ortak:

```ts
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3, // 3 deneme
  backoff: { type: "exponential", delay: 5_000 }, // 5s, 10s, 20s...
  removeOnComplete: { age: 3_600, count: 1_000 }, // başarılıları kısa tut
  removeOnFail: { age: 24 * 3_600 }, // başarısızları 24s tut = DLQ
};
```

- **Retry/backoff**: geçici hatalarda (SMTP timeout, 5xx) otomatik yeniden dener.
- **DLQ**: tüm denemeler tükenince job "failed" olarak 24 saat kuyrukta kalır;
  BullMQ Board / `queue.getFailed()` ile incelenebilir, `job.retry()` ile elle
  tekrar denenebilir.
- Bir kuyruk farklı davranış istiyorsa `queue.add(name, data, { ...override })`
  ya da `registerQueue({ name, defaultJobOptions })` ile üzerine yaz.

---

## 3. Yeni kuyruk ekleme reçetesi (5 adım)

Örnek: `webhook` kuyruğu (dış sisteme HTTP bildirimi göndersin).

### 1) Kuyruk adını merkeze ekle — `queue.constants.ts`

```ts
export const QueueName = {
  EMAIL: "email",
  WEBHOOK: "webhook", // ← yeni
} as const;
```

### 2) Klasörü aç: `queues/webhook/`

**`webhook.constants.ts`**

```ts
export const WebhookJobName = { DELIVER: "deliver-webhook" } as const;
export type WebhookJobName =
  (typeof WebhookJobName)[keyof typeof WebhookJobName];
```

**`webhook.types.ts`**

```ts
export interface WebhookJobData {
  url: string;
  event: string;
  payload: Record<string, unknown>;
}
```

**`webhook-queue.service.ts`** (PRODUCER)

```ts
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { QueueName } from "#/infra/queue/queue.constants.js";
import { WebhookJobName } from "#/infra/queue/queues/webhook/webhook.constants.js";
import type { WebhookJobData } from "#/infra/queue/queues/webhook/webhook.types.js";

@Injectable()
export class WebhookQueueService {
  constructor(
    @InjectQueue(QueueName.WEBHOOK)
    private readonly queue: Queue<WebhookJobData>,
  ) {}

  async enqueueWebhook(data: WebhookJobData): Promise<void> {
    await this.queue.add(WebhookJobName.DELIVER, data);
  }
}
```

**`webhook.processor.ts`** (WORKER — sadece `logger` + `handle`)

```ts
import { Processor } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { BaseProcessor } from "#/infra/queue/base.processor.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import type { WebhookJobData } from "#/infra/queue/queues/webhook/webhook.types.js";

@Processor(QueueName.WEBHOOK)
export class WebhookProcessor extends BaseProcessor<WebhookJobData> {
  protected readonly logger = new Logger(WebhookProcessor.name);

  async handle(job: Job<WebhookJobData>): Promise<void> {
    const { url, event, payload } = job.data;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, payload }),
    });
    // Hata fırlat → BaseProcessor retry/DLQ'yu yönetir.
    if (!res.ok) throw new Error(`Webhook ${res.status}: ${url}`);
  }
}
```

**`index.ts`** (barrel)

```ts
export * from "#/infra/queue/queues/webhook/webhook-queue.service.js";
export * from "#/infra/queue/queues/webhook/webhook.processor.js";
export * from "#/infra/queue/queues/webhook/webhook.constants.js";
export * from "#/infra/queue/queues/webhook/webhook.types.js";
```

### 3) Modüle kaydet — `queue.module.ts`

```ts
import {
  WebhookProcessor,
  WebhookQueueService,
} from "#/infra/queue/queues/webhook/index.js";

const QueueProducers: Provider[] = [EmailQueueService, WebhookQueueService]; // ←
const QueueProcessors: Provider[] = [EmailProcessor, WebhookProcessor]; // ←
```

> `registerQueue(...Object.values(QueueName))` sayesinde kuyruğun register'ı
> otomatik olur; sadece producer/processor dizilerine eklemen yeterli.

### 4) Üst barrel'a ekle — `src/infra/queue/index.ts`

```ts
export * from "#/infra/queue/queues/webhook/index.js";
```

### 5) Kullan — event handler'dan enqueue et

```ts
constructor(private readonly webhookQueue: WebhookQueueService) {}

@OnEvent(SOME_DOMAIN_EVENT)
async onSomething(event: SomeEvent) {
  await this.webhookQueue.enqueueWebhook({ url, event: "x", payload: {...} });
}
```

`pnpm run typecheck && pnpm run lint`.

---

## 4. Enqueue opsiyonları (ihtiyaç olursa)

`queue.add(name, data, options)` ile per-job:

- **Gecikmeli**: `{ delay: 60_000 }` — 60s sonra çalışsın.
- **Öncelik**: `{ priority: 1 }` — düşük sayı = yüksek öncelik.
- **Idempotency / dedup**: `{ jobId: "user:42:welcome" }` — aynı id tekrar
  eklenirse yeni job oluşmaz (aynı işi iki kez yapma).
- **Tekrarlayan**: `{ repeat: { pattern: "0 9 * * *" } }` — cron benzeri. (Basit
  periyodik işler için `@nestjs/schedule` hâlâ tercih edilir.)

Producer metodunu ihtiyaca göre parametrele; ham `queue.add` çağrısını
controller/servise sızdırma — her zaman producer servisinden geç.

---

## 5. Do / Don't

- ✅ Yan etkiyi **event → handler → enqueue → processor** akışıyla çöz.
- ✅ Processor'lar `BaseProcessor`'dan türer; sadece `logger` + `handle` yazar.
- ✅ Job verisi **küçük ve serileştirilebilir** olsun (id'ler geçir, koca
  nesneler değil — worker gerekeni DB'den çeksin).
- ✅ Hata durumunda `handle` **fırlatsın**; retry/DLQ'yu base yönetsin.
- ❌ Controller/servisten doğrudan `queue.add` çağırma — producer servisinden geç.
- ❌ Processor içinde HTTP response şekillendirme / `HttpSuccess` döndürme yok.
- ❌ `@OnWorkerEvent`'i base sınıfa koyma (keşfedilmez); gerekirse **alt sınıfa** koy.
- ❌ Kuyruk adını string olarak elle yazma — daima `QueueName.X`.

---

## 6. İzleme

- Başarısızlar: `queue.getFailed()` / BullMQ Board (eklenirse). 24 saat DLQ'da.
- Loglar `pino` üzerinden `x-request-id` olmadan (worker bağlamı) ama job adı +
  deneme sayısı ile gelir (`BaseProcessor`).
- Elle tekrar: `const jobs = await queue.getFailed(); await jobs[0].retry();`
