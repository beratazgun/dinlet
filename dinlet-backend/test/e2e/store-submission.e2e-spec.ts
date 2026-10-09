import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseService } from "#database/database.service.js";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./support/test-app.js";

interface Submission {
  id: number;
  status: { raw: string };
  storeItemId: number | null;
  rejectionReason: string | null;
}

describe("Mağazada not paylaşımı (e2e)", () => {
  let testApp: TestApp;
  let editor: TestUser;
  let editorClient: HttpClient;
  let author: TestUser;
  let authorClient: HttpClient;
  let readerClient: HttpClient;
  let tarihId: number;

  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const db = () => testApp.app.get(DatabaseService).client;

  const login = async (user: TestUser) =>
    new HttpClient(testApp.baseUrl, { deviceId: randomUUID() }).login(
      user.email,
      user.password,
    );

  beforeAll(async () => {
    testApp = await startTestApp();
    editor = await createActiveUser(testApp.app);
    const superAdmin = await db()
      .orm.public.Role.where({ code: "SUPER_ADMIN" })
      .select("id")
      .first();
    await db()
      .orm.public.User.where({ id: editor.id })
      .updateAndCount({ roleId: superAdmin!.id });
    editorClient = await login(editor);
    author = await createActiveUser(testApp.app);
    authorClient = await login(author);
    readerClient = await login(await createActiveUser(testApp.app));

    const kpss = await db()
      .orm.public.StoreCategory.where({ slug: "kpss-tarih" })
      .select("id")
      .first();
    tarihId = kpss!.id;
  });

  afterAll(async () => {
    s3.destroy();
    await testApp?.close();
  });

  /** Hazır not: sesleri R2'de gerçekten olan iki bölüm + soru. */
  async function seedReadyDocument(userId: number, title: string) {
    const media = await db()
      .orm.public.Media.select("id")
      .create({
        storageKey: `tmp/e2e/${randomUUID()}.pdf`,
        fileName: `${title}.pdf`,
        mimeType: "application/pdf",
        size: 1_000,
        uploaderId: userId,
      });
    const prefix = randomUUID().slice(0, 16);
    const document = await db().orm.public.Document.select("id").create({
      userId,
      mediaId: media.id,
      title,
      status: "READY",
      pageCount: 8,
      sourceHash: randomUUID(),
      storagePrefix: prefix,
      rewriteMode: "FLUENT",
      totalDurationMs: 120_000,
    });
    const put = (key: string) =>
      s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: "mp3",
          ContentType: "audio/mpeg",
        }),
      );
    for (let order = 1; order <= 2; order++) {
      const audioKey = `audio/${userId}/${document.id}-${prefix}/${order}.mp3`;
      await put(audioKey);
      const section = await db()
        .orm.public.Section.select("id")
        .create({
          documentId: document.id,
          order,
          title: `Bölüm ${order}`,
          sourceText: "metin",
          charCount: 1_000,
          status: "READY",
          script: { paragraphs: [`Anlatım ${order}`], recap: null },
          audioKey,
          durationMs: 60_000,
        });
      const questionKey = `audio/${userId}/${document.id}-${prefix}/q-${section.id}.mp3`;
      const answerKey = `audio/${userId}/${document.id}-${prefix}/a-${section.id}.mp3`;
      await put(questionKey);
      await put(answerKey);
      await db().orm.public.QuizQuestion.create({
        sectionId: section.id,
        order: 1,
        question: "Soru?",
        answer: "Cevap",
        detail: "Açıklama",
        questionAudioKey: questionKey,
        questionDurationMs: 2_000,
        answerAudioKey: answerKey,
        answerDurationMs: 2_000,
      });
    }
    return document.id;
  }

  const submit = (documentId: number, confirmRights: unknown = true) =>
    authorClient.post<Submission>("/store/submissions", {
      documentId,
      title: "Osmanlı Kuruluş özetim",
      description:
        "Kuruluş dönemini sınav sorularına göre özetledim, kısa ve net.",
      categoryIds: [tarihId],
      confirmRights,
    });

  let documentId: number;
  let submissionId: number;
  let storeItemId: number;

  it("hak onayı olmadan paylaşılmaz; aynı not iki kez incelemeye girmez; geri çekilebilir", async () => {
    documentId = await seedReadyDocument(author.id, "Osmanlı Kuruluş");

    expect((await submit(documentId, false)).status).toBe(400);
    const first = await submit(documentId);
    expect(first.status).toBe(201);
    expect(first.body.data!.status.raw).toBe("PENDING");

    const again = await submit(documentId);
    expect(again.status).toBe(409);
    expect(again.body.data).toMatchObject({ code: "SUBMISSION_EXISTS" });

    const withdrawn = await authorClient.post<Submission>(
      `/store/submissions/${first.body.data!.id}/withdraw`,
    );
    expect(withdrawn.body.data!.status.raw).toBe("WITHDRAWN");

    const resubmitted = await submit(documentId);
    expect(resubmitted.status).toBe(201);
    submissionId = resubmitted.body.data!.id;
  });

  it("editör onaylayınca notun kopyası ücretsiz Öğrenci notu olarak yayına girer", async () => {
    expect((await authorClient.get("/admin/store/submissions")).status).toBe(
      403,
    );

    const queue = await editorClient.get<
      { id: number; author: { id: number }; sectionCount: number }[]
    >("/admin/store/submissions");
    expect(
      queue.body.data!.find((row) => row.id === submissionId),
    ).toMatchObject({
      author: { id: author.id },
      sectionCount: 2,
    });

    const approved = await editorClient.post<Submission>(
      `/admin/store/submissions/${submissionId}/approve`,
      {},
    );
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.data!.status.raw).toBe("APPROVED");
    storeItemId = approved.body.data!.storeItemId!;

    const item = await readerClient.get<{
      isFree: boolean;
      credit: string;
      source: { raw: string; display: string };
      sections: { audioUrl: string | null }[];
      questionCount: number;
    }>(`/store/items/${storeItemId}`);
    expect(item.body.data).toMatchObject({
      isFree: true,
      credit: "E2E K.",
      source: { raw: "COMMUNITY", display: "Öğrenci notu" },
      questionCount: 2,
    });
    // Sesler mağazanın kendi kopyasında.
    expect(item.body.data!.sections[0]!.audioUrl).toMatch(
      /\/store\/[^/]+\/\d+-1\.mp3$/,
    );

    // Kopya kimsenin kütüphanesinde görünmez.
    const library = await authorClient.get<{ id: number }[]>("/documents");
    expect(library.body.data!.map((row) => row.id)).toEqual([documentId]);
    const editorLibrary =
      await editorClient.get<{ id: number }[]>("/documents");
    expect(editorLibrary.body.data).toEqual([]);

    const notifications =
      await authorClient.get<{ type: { raw: string } }[]>("/notifications");
    expect(notifications.body.data!.map((row) => row.type.raw)).toContain(
      "STORE_SUBMISSION_APPROVED",
    );
  });

  it("yazar notunu silse de mağaza sürümü eklenip dinlenebilir", async () => {
    expect((await authorClient.delete(`/documents/${documentId}`)).status).toBe(
      204,
    );

    const added = await readerClient.post<{
      entries: { documentId: number }[];
    }>(`/store/items/${storeItemId}/library`);
    expect(added.status).toBe(201);
    const copy = await readerClient.get<{ sections: { id: number }[] }>(
      `/documents/${added.body.data!.entries[0]!.documentId}`,
    );
    const section = await readerClient.get<{
      audioUrl: string;
      questions: unknown[];
    }>(`/sections/${copy.body.data!.sections[0]!.id}`);
    expect(section.body.data!.audioUrl).toMatch(/\/store\//);
    expect(section.body.data!.questions).toHaveLength(1);
  });

  it("reddedilen paylaşım nedeniyle döner; yayındaki paylaşım kaldırılabilir", async () => {
    const other = await seedReadyDocument(author.id, "Coğrafya");
    const submitted = await submit(other);
    const rejected = await editorClient.post<Submission>(
      `/admin/store/submissions/${submitted.body.data!.id}/reject`,
      { reason: "Bir yayınevinin kitabından alınmış görünüyor." },
    );
    expect(rejected.body.data).toMatchObject({
      status: { raw: "REJECTED" },
      rejectionReason: "Bir yayınevinin kitabından alınmış görünüyor.",
    });

    const mine = await authorClient.get<Submission[]>(
      `/store/submissions?documentId=${other}`,
    );
    expect(mine.body.data!.map((row) => row.status.raw)).toEqual(["REJECTED"]);

    const removed = await authorClient.post<Submission>(
      `/store/submissions/${submissionId}/withdraw`,
    );
    expect(removed.body.data!.status.raw).toBe("WITHDRAWN");
    const stranger = await login(await createActiveUser(testApp.app));
    expect((await stranger.get(`/store/items/${storeItemId}`)).status).toBe(
      404,
    );
    // Daha önce ekleyen kütüphanesinde tutar.
    expect((await readerClient.get(`/store/items/${storeItemId}`)).status).toBe(
      200,
    );
  });
});
