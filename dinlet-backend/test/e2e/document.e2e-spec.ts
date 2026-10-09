import { randomUUID } from "node:crypto";

import { HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import { PDFDocument } from "pdf-lib";
import { io } from "socket.io-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DataPurgeHandler } from "#/infra/job/handlers/data-purge.handler.js";
import { DatabaseService } from "#database/database.service.js";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
} from "./support/test-app.js";

interface UploadTicket {
  uploadId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

interface EnumValue {
  raw: string;
}

interface DocumentItem {
  id: number;
  title: string;
  status: EnumValue;
  pageCount: number;
  rewriteMode: EnumValue;
}

interface DocumentDetail extends DocumentItem {
  progress: { percent: number; readySectionIds: number[] };
  sections: {
    id: number;
    order: number;
    title: string;
    status: EnumValue;
    audioUrl: string | null;
  }[];
}

/** Okunabilir metin üreten sayfa: Python worker'ın Docling çıktısını taklit eder. */
const MARKDOWN = [
  "# Kuruluş Dönemi",
  "• Kuruluş: 1299\n• Kurucu: Osman Bey",
  "Osmanlı Devleti Söğüt ve Domaniç çevresinde kuruldu. ".repeat(12),
  "## Yükselme Dönemi",
  "| Padişah | Yıl |\n|---|---|\n| Fatih | 1453 |",
  "İstanbul'un fethiyle devlet imparatorluğa dönüştü. ".repeat(12),
].join("\n\n");

async function buildPdf(pages: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200]);
  // Her PDF farklı içerik özeti alsın (aynı PDF tekrarı ayrıca test ediliyor).
  pdf.setTitle(randomUUID());
  return Buffer.from(await pdf.save());
}

/**
 * Python worker'ın (`dinlet-worker`) yerine geçen sahte worker'lar: kuyruk
 * sözleşmesine uyar (Markdown'ı R2'ye yazar, ses sonucu döner).
 */
/** Sahte worker bu sayfa sayısındaki PDF'lerden metin çıkaramaz. */
const UNREADABLE_PAGE_COUNT = 3;

function startFakeWorkers(s3: S3Client) {
  const connection = {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  };
  const extract = new Worker(
    "extract",
    async (job) => {
      const { extractedKey, pageCount } = job.data as {
        extractedKey: string;
        pageCount: number;
      };
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: extractedKey,
          Body: MARKDOWN,
          ContentType: "text/markdown",
        }),
      );
      const chars = pageCount === UNREADABLE_PAGE_COUNT ? 5 : MARKDOWN.length;
      return { extractedKey, chars, ocrPages: 0 };
    },
    { connection },
  );
  const tts = new Worker(
    "tts",
    async (job) => ({
      audioKey: (job.data as { audioKey: string }).audioKey,
      durationMs: 60_000,
      sizeBytes: 480_000,
    }),
    { connection },
  );
  return [extract, tts];
}

describe("Documents (e2e)", () => {
  let testApp: TestApp;
  let client: HttpClient;
  let workers: Worker[];

  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    workers = startFakeWorkers(s3);
  });

  // Her senaryo kendi kullanıcısı ve IP'siyle: kota ve yükleme hız sınırı
  // (dakikada 5) senaryolar arasında paylaşılmasın.
  beforeEach(async () => {
    const user = await createActiveUser(testApp.app);
    client = await new HttpClient(testApp.baseUrl, {
      deviceId: randomUUID(),
    }).login(user.email, user.password);
  });

  afterAll(async () => {
    await Promise.all(workers?.map((worker) => worker.close()) ?? []);
    await testApp?.close();
  });

  async function uploadPdf(body: Buffer): Promise<number> {
    const ticket = await client.post<UploadTicket>("/media/uploads", {
      fileName: "osmanli-kurulus.pdf",
      mimeType: "application/pdf",
      size: body.length,
    });
    expect(ticket.status).toBe(201);
    const put = await fetch(ticket.body.data!.uploadUrl, {
      method: "PUT",
      headers: ticket.body.data!.headers,
      body: new Uint8Array(body),
    });
    expect(put.status).toBe(200);
    const completed = await client.post<{ id: number }>(
      `/media/uploads/${ticket.body.data!.uploadId}/complete`,
    );
    expect(completed.status).toBe(201);
    return completed.body.data!.id;
  }

  async function waitForStatus(id: number, statuses: string[]) {
    let detail: DocumentDetail | undefined;
    await expect
      .poll(
        async () => {
          detail = (await client.get<DocumentDetail>(`/documents/${id}`)).body
            .data;
          return detail?.status.raw;
        },
        { timeout: 20_000, interval: 250 },
      )
      .toSatisfy((status: string) => statuses.includes(status));
    return detail!;
  }

  it("PDF'i işler: kuyruk → bölümler → ses → READY", async () => {
    const mediaId = await uploadPdf(await buildPdf(2));

    const created = await client.post<DocumentItem>("/documents", { mediaId });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      title: "osmanli-kurulus",
      pageCount: 2,
      status: { raw: "QUEUED" },
      rewriteMode: { raw: "RAW" },
    });
    const id = created.body.data!.id;

    // Aynı PDF tekrar gönderilirse yeni işleme yapılmaz.
    const again = await client.post<DocumentItem>("/documents", { mediaId });
    expect(again.status).toBe(200);
    expect(again.body.data!.id).toBe(id);

    const detail = await waitForStatus(id, ["READY"]);
    expect(detail.progress.percent).toBe(100);
    expect(detail.sections.map((s) => s.title)).toEqual([
      "Kuruluş Dönemi",
      "Yükselme Dönemi",
    ]);
    for (const section of detail.sections) {
      expect(section.status.raw).toBe("READY");
      expect(section.audioUrl).toMatch(
        new RegExp(`/audio/\\d+/${id}-[\\w-]{16}/${section.id}-[0-9a-f]{16}\\.mp3$`),
      );
    }

    // Free yolu: kural tabanlı metin, tekrar özeti yok.
    const section = await client.get<{ paragraphs: string[]; recap: unknown }>(
      `/sections/${detail.sections[0]!.id}`,
    );
    expect(section.status).toBe(200);
    expect(section.body.data!.paragraphs[0]).toBe(
      "Kuruluş: 1299. Kurucu: Osman Bey.",
    );
    expect(section.body.data!.recap).toBeNull();

    const list = await client.get<DocumentItem[]>("/documents?status=READY");
    expect(list.body.data!.map((d) => d.id)).toContain(id);

    // Kütüphane satırı: ilerleme ve bölüm sayıları; "Hazır" sekmesi.
    const library = await client.get<
      (DocumentItem & {
        progressPercent: number;
        sections: { total: number; ready: number; failed: number };
      })[]
    >("/documents?group=ready");
    const row = library.body.data!.find((d) => d.id === id)!;
    expect(row.progressPercent).toBe(100);
    expect(row.sections).toEqual({
      total: detail.sections.length,
      ready: detail.sections.length,
      failed: 0,
    });
    const processing = await client.get<DocumentItem[]>("/documents?group=processing");
    expect(processing.body.data!.map((d) => d.id)).not.toContain(id);
    expect((await client.get("/documents?group=bilinmeyen")).status).toBe(400);
  });

  it("ilerlemeyi socket ile yayınlar, hazır olunca bildirim üretir", async () => {
    const register = await client.post("/me/push-tokens", {
      token: "ExponentPushToken[e2e-device-token]",
      platform: "ios",
    });
    expect(register.status).toBe(200);

    const socket = io(`${testApp.baseUrl}/notifications`, {
      transports: ["websocket"],
      reconnection: false,
      auth: { token: client.accessToken, deviceId: client.deviceId },
    });
    const events: { name: string; payload: { documentId: number; percent?: number } }[] =
      [];
    socket.onAny((name, payload) => events.push({ name, payload }));
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    try {
      const mediaId = await uploadPdf(await buildPdf(1));
      const id = (await client.post<DocumentItem>("/documents", { mediaId })).body
        .data!.id;
      await waitForStatus(id, ["READY"]);

      await expect
        .poll(() => events.some((e) => e.name === "document:ready"))
        .toBe(true);
      const progress = events.filter(
        (e) => e.name === "document:progress" && e.payload.documentId === id,
      );
      expect(progress.length).toBeGreaterThan(0);
      expect(progress.at(-1)!.payload.percent).toBe(100);

      const notifications = await client.get<
        { type: { raw: string }; entityId: number }[]
      >("/notifications");
      expect(notifications.body.data).toContainEqual(
        expect.objectContaining({ type: expect.objectContaining({ raw: "DOCUMENT_READY" }), entityId: id }),
      );
    } finally {
      socket.disconnect();
    }

    const removed = await client.delete(
      `/me/push-tokens/${encodeURIComponent("ExponentPushToken[e2e-device-token]")}`,
    );
    expect(removed.status).toBe(204);
  });

  it("dinleme konumunu kaydeder ve devam listesinde gösterir", async () => {
    const mediaId = await uploadPdf(await buildPdf(1));
    const id = (await client.post<DocumentItem>("/documents", { mediaId })).body
      .data!.id;
    const detail = await waitForStatus(id, ["READY"]);
    const [first, second] = detail.sections;

    const saved = await client.put<{ positionMs: number }>(
      `/sections/${first!.id}/progress`,
      // Süre 60 sn: daha ileri bir konum süreye kırpılır.
      { positionMs: 90_000, completed: false },
    );
    expect(saved.status).toBe(200);
    expect(saved.body.data!.positionMs).toBe(60_000);

    await client.put(`/sections/${second!.id}/progress`, {
      positionMs: 12_000,
      completed: false,
    });
    const section = await client.get<{ playback: { positionMs: number } }>(
      `/sections/${second!.id}`,
    );
    expect(section.body.data!.playback.positionMs).toBe(12_000);

    const list = await client.get<{ sectionId: number; documentTitle: string; sectionCount: number }[]>(
      "/me/continue",
    );
    expect(list.body.data!.map((item) => item.sectionId)).toEqual([
      second!.id,
      first!.id,
    ]);
    expect(list.body.data![0]!.sectionCount).toBe(detail.sections.length);

    // Tamamlanan bölüm listeden çıkar; silinen notun bölümleri de.
    await client.put(`/sections/${second!.id}/progress`, {
      positionMs: 60_000,
      completed: true,
    });
    await client.delete(`/documents/${id}`);
    expect((await client.get<unknown[]>("/me/continue")).body.data).toEqual([]);
  });

  it("başkasının notunu ve bölümünü göstermez", async () => {
    const mediaId = await uploadPdf(await buildPdf(1));
    const created = await client.post<DocumentItem>("/documents", { mediaId });
    const detail = await waitForStatus(created.body.data!.id, ["READY"]);

    const other = await createActiveUser(testApp.app);
    const otherClient = await new HttpClient(testApp.baseUrl).login(
      other.email,
      other.password,
    );
    expect((await otherClient.get(`/documents/${detail.id}`)).status).toBe(404);
    expect(
      (await otherClient.get(`/sections/${detail.sections[0]!.id}`)).status,
    ).toBe(404);
  });

  it("okunamayan PDF'i FAILED yapar ve kotayı iade eder", async () => {
    const mediaId = await uploadPdf(await buildPdf(UNREADABLE_PAGE_COUNT));
    const created = await client.post<DocumentItem>("/documents", { mediaId });
    expect(created.status).toBe(201);

    const detail = await waitForStatus(created.body.data!.id, ["FAILED"]);
    expect((detail as unknown as { failureReason: string }).failureReason).toMatch(
      /PDF okunamadı/,
    );

    // İade edildiyse 30 sayfalık Free kotanın tamamı hâlâ kullanılabilir.
    const full = await uploadPdf(await buildPdf(30));
    expect((await client.post("/documents", { mediaId: full })).status).toBe(201);
  });

  it("aylık kotayı aşan yüklemeyi 402 ile reddeder", async () => {
    const mediaId = await uploadPdf(await buildPdf(31));
    const response = await client.post("/documents", { mediaId });
    expect(response.status).toBe(402);
  });

  it("ön kontrol sayfa sayısını, kotaya etkisini ve okuma biçimini bildirir", async () => {
    const mediaId = await uploadPdf(await buildPdf(12));
    type Preflight = {
      pageCount: number;
      suggestedTitle: string;
      plan: { raw: string };
      quota: { remainingPages: number; enough: boolean; resetsAt: { raw: string } };
      proMonthlyPages: number;
      fluent: { available: boolean; blockedBy: string | null };
      existingDocumentId: number | null;
    };
    const preflight = await client.post<Preflight>("/documents/preflight", { mediaId });
    expect(preflight.status).toBe(200);
    expect(preflight.body.data).toMatchObject({
      pageCount: 12,
      suggestedTitle: "osmanli-kurulus",
      plan: { raw: "FREE" },
      quota: { remainingPages: 30, enough: true },
      proMonthlyPages: 500,
      // Free planda akıcı anlatım yok.
      fluent: { available: false, blockedBy: "PLAN" },
      existingDocumentId: null,
    });
    expect(new Date(preflight.body.data!.quota.resetsAt.raw).getTime()).toBeGreaterThan(Date.now());

    // Ön kontrol kota düşmez.
    const again = await client.post<Preflight>("/documents/preflight", { mediaId });
    expect(again.body.data!.quota.remainingPages).toBe(30);

    // Free kullanıcı akıcı anlatımı açıkça isterse 403 ve nedeni.
    const fluent = await client.post("/documents", { mediaId, rewriteMode: "FLUENT" });
    expect(fluent.status).toBe(403);
    expect(fluent.body.data).toMatchObject({ code: "PRO_REQUIRED" });

    const created = await client.post<DocumentItem & { rewriteMode: { raw: string } }>(
      "/documents",
      { mediaId, rewriteMode: "RAW", title: "Osmanlı Kuruluş Dönemi" },
    );
    expect(created.status).toBe(201);
    expect(created.body.data!.rewriteMode.raw).toBe("RAW");

    // Aynı PDF tekrar seçilirse mevcut not bildirilir; kota yine yeterli sayılır.
    const duplicate = await client.post<Preflight>("/documents/preflight", { mediaId });
    expect(duplicate.body.data).toMatchObject({
      existingDocumentId: created.body.data!.id,
      quota: { remainingPages: 18, enough: true },
    });

    // Kalan haktan büyük PDF: yetmediği önceden söylenir.
    const big = await uploadPdf(await buildPdf(20));
    const tooBig = await client.post<Preflight>("/documents/preflight", { mediaId: big });
    expect(tooBig.body.data).toMatchObject({ pageCount: 20, quota: { enough: false } });
  });

  it("şifreli/bozuk PDF'i 422 ile reddeder", async () => {
    const broken = Buffer.from("%PDF-1.4\nbu bir pdf degil");
    const mediaId = await uploadPdf(broken);
    expect((await client.post("/documents", { mediaId })).status).toBe(422);
  });

  it("başlığı değiştirir ve notu siler", async () => {
    const mediaId = await uploadPdf(await buildPdf(1));
    const id = (await client.post<DocumentItem>("/documents", { mediaId })).body
      .data!.id;

    const renamed = await client.patch<DocumentItem>(`/documents/${id}`, {
      title: "Yeni Başlık",
    });
    expect(renamed.body.data!.title).toBe("Yeni Başlık");

    expect((await client.delete(`/documents/${id}`)).status).toBe(204);
    expect((await client.get(`/documents/${id}`)).status).toBe(404);
  });

  it("hesap silinince oturum kapanır, temizlik işi dosyaları ve kaydı kalıcı siler", async () => {
    const mediaId = await uploadPdf(await buildPdf(1));
    const id = (await client.post<DocumentItem>("/documents", { mediaId })).body
      .data!.id;
    await waitForStatus(id, ["READY"]);
    const me = (await client.get<{ id: number }>("/auth/me")).body.data!;
    const db = testApp.app.get(DatabaseService).client;
    const media = (await db.orm.public.Media.where({ id: mediaId })
      .select("storageKey")
      .first())!;

    expect((await client.delete("/users/me")).status).toBe(204);
    expect((await client.get("/documents")).status).toBe(401);

    // Not, olay handler'ıyla soft delete edilir.
    await expect
      .poll(async () =>
        (await db.orm.public.Document.where({ id }).select("deletedAt").first())
          ?.deletedAt,
      )
      .not.toBeNull();

    const result = await testApp.app.get(DataPurgeHandler).execute({ graceDays: 0 });
    // Önceki senaryoların silinmiş notları da aynı çalışmada temizlenir.
    expect(result.metadata!.documents).toBeGreaterThanOrEqual(1);
    expect(result.metadata!.users).toBeGreaterThanOrEqual(1);

    expect(await db.orm.public.Document.where({ id }).select("id").first()).toBeNull();
    expect(await db.orm.public.User.where({ id: me.id }).select("id").first()).toBeNull();
    const audio = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: `audio/${me.id}/${id}-`,
      }),
    );
    expect(audio.KeyCount ?? 0).toBe(0);
    await expect(
      s3.send(
        new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: media.storageKey,
        }),
      ),
    ).rejects.toThrow();
  });
});
