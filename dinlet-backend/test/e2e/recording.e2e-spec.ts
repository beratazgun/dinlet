import { randomUUID } from "node:crypto";

import { Worker } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseService } from "#database/database.service.js";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./support/test-app.js";

interface Recording {
  status: { raw: string } | null;
  useOwnVoice: boolean;
  recordedCount: number;
  totalCount: number;
  durationMs: number | null;
  audioUrl: string | null;
  parts: {
    position: number;
    kind: string;
    text: string;
    clip: { audioUrl: string; durationMs: number } | null;
  }[];
}

/** Python worker'ın `mix` işi yerine: klipleri sırayla 1'er saniye sayar. */
function startFakeMixWorker() {
  return new Worker(
    "tts",
    async (job) => {
      const data = job.data as {
        audioKey: string;
        clips?: { position: number }[];
      };
      if (job.name !== "mix") {
        return {
          audioKey: data.audioKey,
          durationMs: 60_000,
          sizeBytes: 480_000,
        };
      }
      const clips = data.clips!.map((clip, index) => ({
        position: clip.position,
        startMs: index * 1_000,
        durationMs: 1_000,
      }));
      return {
        audioKey: data.audioKey,
        durationMs: clips.length * 1_000,
        sizeBytes: 1_234,
        clips,
      };
    },
    {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    },
  );
}

describe("Kendi sesinle kayıt (e2e)", () => {
  let testApp: TestApp;
  let user: TestUser;
  let client: HttpClient;
  let worker: Worker;
  let sectionId: number;

  const db = () => testApp.app.get(DatabaseService).client;

  beforeAll(async () => {
    testApp = await startTestApp();
    worker = startFakeMixWorker();
    user = await createActiveUser(testApp.app);
    client = await new HttpClient(testApp.baseUrl, {
      deviceId: randomUUID(),
    }).login(user.email, user.password);

    const media = await db()
      .orm.public.Media.select("id")
      .create({
        storageKey: `tmp/e2e/${randomUUID()}.pdf`,
        fileName: "orhan.pdf",
        mimeType: "application/pdf",
        size: 1_000,
        uploaderId: user.id,
      });
    const document = await db()
      .orm.public.Document.select("id")
      .create({
        userId: user.id,
        mediaId: media.id,
        title: "Osmanlı Kuruluş",
        status: "READY",
        pageCount: 4,
        sourceHash: randomUUID(),
        storagePrefix: randomUUID().slice(0, 16),
        rewriteMode: "FLUENT",
      });
    const section = await db()
      .orm.public.Section.select("id")
      .create({
        documentId: document.id,
        order: 3,
        title: "Orhan Bey Dönemi",
        sourceText: "metin",
        charCount: 100,
        status: "READY",
        script: {
          paragraphs: ["Maltepe Savaşı yapıldı.", "İznik alındı."],
          recap: "Bu bölümde Orhan Bey dönemini gördük.",
        },
        scriptHash: "abc123",
        audioKey: "audio/ai.mp3",
        durationMs: 60_000,
        recapDurationMs: 5_000,
      });
    sectionId = section.id;
  });

  afterAll(async () => {
    await worker?.close();
    await testApp?.close();
  });

  const upload = (position: number, durationMs = 1_000, type = "audio/mp4") => {
    const form = new FormData();
    form.append(
      "audio",
      new Blob([Buffer.from("fake-aac")], { type }),
      "clip.m4a",
    );
    return client.form<Recording>(
      "PUT",
      `/sections/${sectionId}/recording/clips/${position}?durationMs=${durationMs}`,
      form,
    );
  };

  async function waitForStatus(status: string): Promise<Recording> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const response = await client.get<Recording>(
        `/sections/${sectionId}/recording`,
      );
      if (response.body.data!.status?.raw === status)
        return response.body.data!;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Kayıt ${status} olmadı`);
  }

  it("paragrafları ve sondaki özeti kaydedilecek parçalar olarak verir", async () => {
    const response = await client.get<Recording>(
      `/sections/${sectionId}/recording`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: null,
      recordedCount: 0,
      totalCount: 3,
    });
    expect(response.body.data!.parts.map((part) => part.kind)).toEqual([
      "PARAGRAPH",
      "PARAGRAPH",
      "RECAP",
    ]);
  });

  it("eksik kayıtla kaydetmez; ses olmayan dosyayı reddeder", async () => {
    expect((await upload(0)).status).toBe(200);
    expect((await upload(1, 1_000, "application/pdf")).status).toBe(422);
    expect((await upload(9)).status).toBe(422);

    const finalize = await client.patch(`/sections/${sectionId}/recording`, {
      finalize: true,
    });
    expect(finalize.status).toBe(422);
    expect(finalize.body.data).toMatchObject({ code: "RECORDING_INCOMPLETE" });
  });

  it("hepsi kaydedilince birleştirir; oynatıcı kendi sesini çalar", async () => {
    await upload(1, 2_000);
    const last = await upload(2, 3_000);
    expect(last.body.data).toMatchObject({
      recordedCount: 3,
      status: { raw: "DRAFT" },
    });

    // Ses tercihi "Benim sesim" değilken kayıt oynatıcıya gelmez.
    const before = await client.get<{ ownVoice: unknown }>(
      `/sections/${sectionId}`,
    );
    expect(before.body.data!.ownVoice).toBeNull();

    const saved = await client.patch<Recording>(
      `/sections/${sectionId}/recording`,
      {
        finalize: true,
        useOwnVoice: true,
      },
    );
    expect(saved.status).toBe(200);
    expect(saved.body.data!.status?.raw).toBe("PROCESSING");

    const ready = await waitForStatus("READY");
    expect(ready.durationMs).toBe(3_000);
    expect(ready.audioUrl).toMatch(/mix-1-.+\.mp3$/);

    const voice = await client.get<{
      voice: { raw: string };
      recordingCount: number;
    }>("/me/voice");
    expect(voice.body.data).toMatchObject({
      voice: { raw: "OWN" },
      recordingCount: 1,
    });

    const section = await client.get<{
      ownVoice: {
        audioUrl: string;
        durationMs: number;
        recapDurationMs: number;
      };
    }>(`/sections/${sectionId}`);
    expect(section.body.data!.ownVoice).toMatchObject({
      durationMs: 3_000,
      recapDurationMs: 1_000,
    });

    // "Dinlet sesi" seçilince bölüm yeniden yapay zekâ sesiyle çalar.
    await client.patch(`/sections/${sectionId}/recording`, {
      useOwnVoice: false,
    });
    const ai = await client.get<{ ownVoice: unknown }>(
      `/sections/${sectionId}`,
    );
    expect(ai.body.data!.ownVoice).toBeNull();
  });

  it("Kayıtlarım listesi ve özeti; tek paragraf yeniden kaydı taslağa döndürür", async () => {
    const list =
      await client.get<
        {
          sectionTitle: string;
          status: { raw: string };
          recordedCount: number;
          totalCount: number;
        }[]
      >("/me/recordings");
    expect(list.body.data).toEqual([
      expect.objectContaining({
        sectionTitle: "Orhan Bey Dönemi",
        status: expect.objectContaining({ raw: "READY" }),
        recordedCount: 3,
        totalCount: 3,
      }),
    ]);
    const summary = await client.get("/me/recordings/summary");
    expect(summary.body.data).toEqual({
      readyCount: 1,
      draftCount: 0,
      totalDurationMs: 3_000,
    });

    const redo = await upload(1, 1_500);
    expect(redo.body.data!.status?.raw).toBe("DRAFT");
    const after = await client.get("/me/recordings/summary");
    expect(after.body.data).toMatchObject({ readyCount: 0, draftCount: 1 });
  });

  it("Doğal ses henüz seçilemez; kayıt silinir", async () => {
    const natural = await client.put("/me/voice", { voice: "NATURAL" });
    expect(natural.status).toBe(422);
    expect(natural.body.data).toMatchObject({ code: "VOICE_UNAVAILABLE" });
    expect((await client.put("/me/voice", { voice: "STANDARD" })).status).toBe(
      200,
    );

    expect(
      (await client.delete(`/sections/${sectionId}/recording`)).status,
    ).toBe(204);
    const gone = await client.get<Recording>(
      `/sections/${sectionId}/recording`,
    );
    expect(gone.body.data).toMatchObject({ status: null, recordedCount: 0 });
  });
});
