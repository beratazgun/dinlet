import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DateManager } from "#/core/utils/date-manager.js";
import { DatabaseService } from "#database/database.service.js";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
} from "./support/test-app.js";

interface Folder {
  id: number;
  name: string;
  color: string;
  documentCount: number;
  finishedCount: number;
  progressPercent: number;
}

interface Collections {
  goal: {
    examName: string;
    daysLeft: number;
    documentCount: number;
    finishedCount: number;
    progressPercent: number;
    remainingListenMs: number;
    dailyMinutes: number | null;
  } | null;
  folders: Folder[];
  tags: { id: number; name: string; documentCount: number }[];
  favoritesCount: number;
  thisWeekCount: number;
  unfiledCount: number;
}

describe("Çalışma araçları: klasörler, etiketler, sınav hedefi (e2e)", () => {
  let testApp: TestApp;
  let client: HttpClient;
  let userId: number;

  beforeAll(async () => {
    testApp = await startTestApp();
  });

  beforeEach(async () => {
    const user = await createActiveUser(testApp.app);
    userId = user.id;
    client = await new HttpClient(testApp.baseUrl, {
      deviceId: randomUUID(),
    }).login(user.email, user.password);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  /**
   * İşleme hattından geçmiş gibi hazır bir not: `sections` kadar 10 dakikalık
   * bölüm; ilk `completed` tanesi dinlenip bitirilmiş.
   */
  async function seedDocument(
    title: string,
    sections: number,
    completed: number,
  ) {
    const db = testApp.app.get(DatabaseService).client;
    const media = await db.orm.public.Media.select("id").create({
      storageKey: `tmp/e2e/${randomUUID()}.pdf`,
      fileName: `${title}.pdf`,
      mimeType: "application/pdf",
      size: 1_000,
      uploaderId: userId,
    });
    const document = await db.orm.public.Document.select("id").create({
      userId,
      mediaId: media.id,
      title,
      status: "READY",
      pageCount: sections * 4,
      sourceHash: randomUUID(),
      storagePrefix: randomUUID().slice(0, 16),
      rewriteMode: "RAW",
    });
    for (let order = 1; order <= sections; order++) {
      const section = await db.orm.public.Section.select("id").create({
        documentId: document.id,
        order,
        title: `Bölüm ${order}`,
        sourceText: "metin",
        charCount: 8_000,
        status: "READY",
        durationMs: 600_000,
      });
      if (order <= completed) {
        await db.orm.public.PlaybackProgress.create({
          userId,
          sectionId: section.id,
          positionMs: 600_000,
          completed: true,
        });
      }
    }
    return document.id;
  }

  it("klasör açar, not taşır, ilerlemeyi ve filtreleri hesaplar", async () => {
    const finished = await seedDocument("Osman Bey Dönemi", 2, 2);
    const halfway = await seedDocument("Orhan Bey Dönemi", 2, 1);
    const loose = await seedDocument("İklim Tipleri", 1, 0);

    const tarih = await client.post<Folder>("/folders", { name: "Tarih" });
    expect(tarih.status).toBe(201);
    expect(tarih.body.data).toMatchObject({
      name: "Tarih",
      color: "#1928B4",
      documentCount: 0,
    });

    const duplicate = await client.post("/folders", { name: "Tarih" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.data).toMatchObject({ code: "FOLDER_NAME_TAKEN" });

    const folderId = tarih.body.data!.id;
    for (const id of [finished, halfway]) {
      expect(
        (await client.patch(`/documents/${id}`, { folderId })).status,
      ).toBe(200);
    }
    // Favori ve başlık aynı uçtan; verilmeyen alan değişmez.
    const starred = await client.patch<{
      isFavorite: boolean;
      title: string;
      folderId: number;
    }>(`/documents/${finished}`, { isFavorite: true });
    expect(starred.body.data).toMatchObject({
      isFavorite: true,
      title: "Osman Bey Dönemi",
      folderId,
    });
    expect((await client.patch(`/documents/${finished}`, {})).status).toBe(400);

    // Başkasının klasörüne taşınamaz.
    const other = await createActiveUser(testApp.app);
    const otherClient = await new HttpClient(testApp.baseUrl).login(
      other.email,
      other.password,
    );
    const foreign = await otherClient.post<Folder>("/folders", {
      name: "Benim",
    });
    expect(
      (
        await client.patch(`/documents/${loose}`, {
          folderId: foreign.body.data!.id,
        })
      ).status,
    ).toBe(404);

    const collections = await client.get<Collections>("/collections");
    expect(collections.status).toBe(200);
    expect(collections.body.data).toMatchObject({
      goal: null,
      folders: [
        {
          id: folderId,
          documentCount: 2,
          finishedCount: 1,
          progressPercent: 50,
        },
      ],
      favoritesCount: 1,
      thisWeekCount: 3,
      unfiledCount: 1,
    });

    const inFolder = await client.get<{ id: number }[]>(
      `/documents?folderId=${folderId}`,
    );
    expect(inFolder.body.data!.map((d) => d.id).sort()).toEqual(
      [finished, halfway].sort(),
    );
    const favorites = await client.get<{ id: number }[]>(
      "/documents?favorite=true",
    );
    expect(favorites.body.data!.map((d) => d.id)).toEqual([finished]);
    const recent = await client.get<{ id: number }[]>(
      "/documents?addedWithinDays=7",
    );
    expect(recent.body.data).toHaveLength(3);

    // Klasör silinince notlar kütüphanede kalır, klasörsüz olur.
    expect((await client.delete(`/folders/${folderId}`)).status).toBe(204);
    const after = await client.get<Collections>("/collections");
    expect(after.body.data).toMatchObject({ folders: [], unfiledCount: 3 });
  });

  it("etiketleri nota bağlar ve etikete göre listeler", async () => {
    const hard = await seedDocument("Anayasa: Temel Haklar", 1, 0);
    await seedDocument("Para Politikası", 1, 0);

    const tag = await client.post<{ id: number }>("/tags", {
      name: "Zor konular",
    });
    expect(tag.status).toBe(201);
    const tagId = tag.body.data!.id;

    const set = await client.put<{ id: number; name: string }[]>(
      `/documents/${hard}/tags`,
      {
        tagIds: [tagId],
      },
    );
    expect(set.status).toBe(200);
    expect(set.body.data).toEqual([{ id: tagId, name: "Zor konular" }]);

    const detail = await client.get<{ tags: { id: number }[] }>(
      `/documents/${hard}`,
    );
    expect(detail.body.data!.tags).toEqual([
      { id: tagId, name: "Zor konular" },
    ]);

    const tagged = await client.get<{ id: number }[]>(
      `/documents?tagId=${tagId}`,
    );
    expect(tagged.body.data!.map((d) => d.id)).toEqual([hard]);

    const collections = await client.get<Collections>("/collections");
    expect(collections.body.data!.tags).toEqual([
      { id: tagId, name: "Zor konular", documentCount: 1 },
    ]);

    // Başkasının etiketi kullanılamaz.
    const other = await createActiveUser(testApp.app);
    const otherClient = await new HttpClient(testApp.baseUrl).login(
      other.email,
      other.password,
    );
    const foreign = await otherClient.post<{ id: number }>("/tags", {
      name: "Yabancı",
    });
    expect(
      (
        await client.put(`/documents/${hard}/tags`, {
          tagIds: [foreign.body.data!.id],
        })
      ).status,
    ).toBe(404);

    // Silinen etiket nottan kalkar; boş etiket listesi boş sonuç verir.
    expect((await client.delete(`/tags/${tagId}`)).status).toBe(204);
    const afterDelete = await client.get<{ tags: unknown[] }>(
      `/documents/${hard}`,
    );
    expect(afterDelete.body.data!.tags).toEqual([]);
  });

  it("sınav hedefi kalan günü, ilerlemeyi ve günlük dakikayı hesaplar", async () => {
    await seedDocument("Bitti", 1, 1);
    await seedDocument("Kaldı", 3, 0); // 30 dk kaldı

    const dateManager = new DateManager();
    const examDate = dateManager.calendarDay(
      dateManager.addMilliseconds(10 * 24 * 3_600_000),
    );

    const past = await client.put("/me/study-goal", {
      examName: "KPSS",
      examDate: "2020-01-01",
    });
    expect(past.status).toBe(400);
    const invalid = await client.put("/me/study-goal", {
      examName: "KPSS",
      examDate: "2026-02-30",
    });
    expect(invalid.status).toBe(400);

    const goal = await client.put<NonNullable<Collections["goal"]>>(
      "/me/study-goal",
      {
        examName: "KPSS",
        examDate,
      },
    );
    expect(goal.status).toBe(200);
    expect(goal.body.data).toMatchObject({
      examName: "KPSS",
      daysLeft: 10,
      documentCount: 2,
      finishedCount: 1,
      progressPercent: 50,
      remainingListenMs: 30 * 60_000,
      dailyMinutes: 3,
    });

    const collections = await client.get<Collections>("/collections");
    expect(collections.body.data!.goal).toMatchObject({
      examName: "KPSS",
      daysLeft: 10,
    });

    expect((await client.delete("/me/study-goal")).status).toBe(204);
    expect(
      (await client.get<Collections>("/collections")).body.data!.goal,
    ).toBeNull();
  });

  it("bitirilen sorulu bölüm aralıklı tekrara girer; sonuçla aşama ilerler", async () => {
    const documentId = await seedDocument("Osmanlı Kuruluş Dönemi", 1, 0);
    const db = testApp.app.get(DatabaseService).client;
    const section = (await db.orm.public.Section.where({ documentId })
      .select("id")
      .first())!;
    await db.orm.public.Section.where({ id: section.id }).updateAndCount({
      recapAudioKey: "audio/e2e/recap.mp3",
      recapDurationMs: 9_000,
    });
    const questionIds: number[] = [];
    for (const order of [1, 2]) {
      const question = await db.orm.public.QuizQuestion.select("id").create({
        sectionId: section.id,
        order,
        question: `Soru ${order}?`,
        answer: `Cevap ${order}`,
        detail: "Açıklama.",
        questionAudioKey: `audio/e2e/q${order}.mp3`,
        questionDurationMs: 3_000,
        answerAudioKey: `audio/e2e/a${order}.mp3`,
        answerDurationMs: 4_000,
      });
      questionIds.push(question.id);
    }

    // Free kullanıcı: soru üretimi kilitli; listesi boş.
    const empty = await client.get<{
      lockedBy: string | null;
      dueCount: number;
    }>("/me/review");
    expect(empty.body.data).toMatchObject({ lockedBy: "PLAN", dueCount: 0 });

    // Bölümü bitirmek tekrara yarın için ekler.
    await client.put(`/sections/${section.id}/progress`, {
      positionMs: 600_000,
      completed: true,
    });
    const dateManager = new DateManager();
    const today = dateManager.calendarDay();
    const tomorrow = dateManager.calendarDay(
      dateManager.addMilliseconds(24 * 3_600_000),
    );
    let item = await db.orm.public.ReviewItem.where({
      userId,
      sectionId: section.id,
    })
      .select("stage", "dueOn")
      .first();
    expect(item).toMatchObject({ stage: 0, dueOn: tomorrow });

    // Tekrar günü gelmeden sonuç gönderilemez.
    expect(
      (
        await client.post(`/me/review/sections/${section.id}`, {
          answers: [{ questionId: questionIds[0], known: true }],
        })
      ).status,
    ).toBe(400);

    // Bir gün geçmiş gibi.
    await db.orm.public.ReviewItem.where({
      userId,
      sectionId: section.id,
    }).updateAndCount({
      dueOn: today,
    });
    const summary = await client.get<{
      dueCount: number;
      estimatedMs: number;
      items: {
        sectionId: number;
        stageLabel: string;
        isDue: boolean;
        questionCount: number;
      }[];
    }>("/me/review");
    expect(summary.body.data).toMatchObject({
      dueCount: 1,
      estimatedMs: 9_000 + 2 * (3_000 + 5_000 + 4_000),
      items: [
        {
          sectionId: section.id,
          stageLabel: "1. gün",
          isDue: true,
          questionCount: 2,
        },
      ],
    });

    const session = await client.get<{
      thinkMs: number;
      sections: {
        sectionId: number;
        recapAudioUrl: string;
        questions: { id: number; questionAudioUrl: string }[];
      }[];
    }>("/me/review/session");
    expect(session.body.data!.thinkMs).toBe(5_000);
    expect(session.body.data!.sections).toHaveLength(1);
    expect(session.body.data!.sections[0]!.recapAudioUrl).toMatch(
      /audio\/e2e\/recap\.mp3$/,
    );
    expect(session.body.data!.sections[0]!.questions.map((q) => q.id)).toEqual(
      questionIds,
    );
    expect(
      session.body.data!.sections[0]!.questions[0]!.questionAudioUrl,
    ).toMatch(/q1\.mp3$/);

    // Başka bölümün sorusu kabul edilmez.
    expect(
      (
        await client.post(`/me/review/sections/${section.id}`, {
          answers: [{ questionId: 999_999, known: true }],
        })
      ).status,
    ).toBe(400);

    const known = await client.post<{
      stage: number;
      stageLabel: string;
      dueOn: string;
    }>(`/me/review/sections/${section.id}`, {
      answers: questionIds.map((questionId) => ({ questionId, known: true })),
    });
    expect(known.status).toBe(200);
    expect(known.body.data).toMatchObject({
      stage: 1,
      stageLabel: "3. gün",
      graduated: false,
    });

    const after = await client.get<{
      streakDays: number;
      dueCount: number;
      week: { isToday: boolean; done: boolean }[];
    }>("/me/review");
    expect(after.body.data!.streakDays).toBe(1);
    expect(after.body.data!.dueCount).toBe(0);
    expect(after.body.data!.week.find((day) => day.isToday)).toMatchObject({
      done: true,
    });

    // Bilinemeyen soru: başa döner, yarın gelir.
    await db.orm.public.ReviewItem.where({
      userId,
      sectionId: section.id,
    }).updateAndCount({
      dueOn: today,
    });
    const missed = await client.post<{ stage: number; dueOn: string }>(
      `/me/review/sections/${section.id}`,
      {
        answers: [
          { questionId: questionIds[0], known: true },
          { questionId: questionIds[1], known: false },
        ],
      },
    );
    expect(missed.body.data).toMatchObject({ stage: 0, dueOn: tomorrow });
    item = await db.orm.public.ReviewItem.where({
      userId,
      sectionId: section.id,
    })
      .select("stage", "dueOn")
      .first();
    expect(item).toMatchObject({ stage: 0, dueOn: tomorrow });
  });

  it("kapsam eksik bilgiyi bulur; yeniden üretim Pro + rıza ve akıcı anlatım ister", async () => {
    const documentId = await seedDocument("Orhan Bey Dönemi", 1, 0);
    const db = testApp.app.get(DatabaseService).client;
    const section = (await db.orm.public.Section.where({ documentId })
      .select("id")
      .first())!;
    await db.orm.public.Section.where({ id: section.id }).updateAndCount({
      sourceText: "• Bursa 1326'da fethedildi.\nİlk vezir: Alaeddin Paşa",
      script: {
        paragraphs: ["Bursa bin üç yüz yirmi altıda fethedildi."],
        recap: null,
      },
    });

    const coverage = await client.get<{
      percent: number;
      total: number;
      covered: number;
      missing: { term: string; sectionId: number }[];
      canRegenerate: boolean;
    }>(`/documents/${documentId}/coverage`);
    expect(coverage.status).toBe(200);
    expect(coverage.body.data).toMatchObject({
      total: 2,
      covered: 1,
      percent: 50,
      missing: [{ term: "Alaeddin Paşa", sectionId: section.id }],
      canRegenerate: false,
    });

    // Bölüm detayı ham notu da döndürür ("Notta göster").
    const detail = await client.get<{ sourceText: string }>(
      `/sections/${section.id}`,
    );
    expect(detail.body.data!.sourceText).toContain("Alaeddin Paşa");

    // Düz okuma notu yeniden üretilmez.
    expect(
      (await client.post(`/sections/${section.id}/regenerate`)).status,
    ).toBe(422);

    // Akıcı anlatımlı not, Pro ama rızasız: 403 ve nedeni.
    await db.orm.public.Document.where({ id: documentId }).updateAndCount({
      rewriteMode: "FLUENT",
    });
    await db.orm.public.Subscription.create({
      userId,
      plan: "PRO",
      status: "ACTIVE",
      rcAppUserId: String(userId),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      lastEventAt: new Date().toISOString(),
    });
    const noConsent = await client.post(`/sections/${section.id}/regenerate`);
    expect(noConsent.status).toBe(403);
    expect(noConsent.body.data).toMatchObject({
      code: "CROSS_BORDER_CONSENT_REQUIRED",
    });

    await client.post("/users/me/consents", {
      privacyNoticeAccepted: true,
      termsAccepted: true,
      crossBorderTransferConsent: true,
    });
    expect(
      (
        await client.get<{ canRegenerate: boolean }>(
          `/documents/${documentId}/coverage`,
        )
      ).body.data!.canRegenerate,
    ).toBe(true);

    const regenerated = await client.post(`/sections/${section.id}/regenerate`);
    expect(regenerated.status).toBe(202);
    const after = await db.orm.public.Section.where({ id: section.id })
      .select("status", "script")
      .first();
    expect(after?.script).toBeNull();
    const document = await db.orm.public.Document.where({ id: documentId })
      .select("status")
      .first();
    expect(document?.status).not.toBe("READY");

    // İşlenirken ikinci istek çakışır.
    expect(
      (await client.post(`/sections/${section.id}/regenerate`)).status,
    ).toBe(409);
  });

  it("hızlı tekrar ve hafıza kancaları: kilit, istek, sakla/kaldır, bölüm detayı", async () => {
    const documentId = await seedDocument("Orhan Bey Dönemi", 1, 0);
    const db = testApp.app.get(DatabaseService).client;
    const section = (await db.orm.public.Section.where({ documentId })
      .select("id")
      .first())!;
    await db.orm.public.Section.where({ id: section.id }).updateAndCount({
      script: { paragraphs: ["Orhan Bey Bursa'yı aldı."], recap: null },
    });

    // Free: LLM'li araçlar kilitli.
    const locked = await client.post(`/documents/${documentId}/quick`);
    expect(locked.status).toBe(403);
    expect(locked.body.data).toMatchObject({ code: "PRO_REQUIRED" });
    expect(
      (await client.post(`/documents/${documentId}/mnemonics`)).status,
    ).toBe(403);

    // Pro + rıza.
    await db.orm.public.Subscription.create({
      userId,
      plan: "PRO",
      status: "ACTIVE",
      rcAppUserId: String(userId),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      lastEventAt: new Date().toISOString(),
    });
    await client.post("/users/me/consents", {
      privacyNoticeAccepted: true,
      termsAccepted: true,
      crossBorderTransferConsent: true,
    });

    const quick = await client.post<{ queuedSections: number }>(
      `/documents/${documentId}/quick`,
    );
    expect(quick.status).toBe(202);
    expect(quick.body.data!.queuedSections).toBe(1);

    // Test ortamında LLM yok: üretim başarısız olur, not ve sesi etkilenmez.
    let quickStatus: string | null = "PENDING";
    for (
      let attempt = 0;
      attempt < 50 && quickStatus === "PENDING";
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      quickStatus = (await db.orm.public.Section.where({ id: section.id })
        .select("quickStatus")
        .first())!.quickStatus;
    }
    expect(quickStatus).toBe("FAILED");
    const document = await db.orm.public.Document.where({ id: documentId })
      .select("status")
      .first();
    expect(document?.status).toBe("READY");

    // Hafıza kancası: öneri saklanınca seslendirmeye gider; kaldırılan gizlenir.
    const [kept, dismissed] = await Promise.all(
      ["Bursa → İznik → İzmit", "GeTeMOM"].map((hook, position) =>
        db.orm.public.Mnemonic.select("id").create({
          documentId,
          sectionId: section.id,
          position,
          topic: "Konu",
          hook,
          explanation: "Açıklama.",
        }),
      ),
    );
    const keep = await client.patch<{ kept: boolean }>(
      `/mnemonics/${kept!.id}`,
      { kept: true },
    );
    expect(keep.status).toBe(200);
    expect(keep.body.data!.kept).toBe(true);
    expect(
      (await client.patch(`/mnemonics/${dismissed!.id}`, { dismissed: true }))
        .status,
    ).toBe(200);

    const list = await client.get<{ items: { id: number }[] }>(
      `/documents/${documentId}/mnemonics`,
    );
    expect(list.body.data!.items.map((item) => item.id)).toEqual([kept!.id]);

    // Bölüm detayı: sesi hazır saklanan kanca ve sorular oynatıcıya gelir.
    await db.orm.public.Mnemonic.where({ id: kept!.id }).updateAndCount({
      audioKey: "audio/e2e/mnemonic.mp3",
      durationMs: 4_000,
    });
    const detail = await client.get<{
      mnemonics: { id: number; audioUrl: string }[];
      questions: unknown[];
    }>(`/sections/${section.id}`);
    expect(detail.body.data!.mnemonics.map((item) => item.id)).toEqual([
      kept!.id,
    ]);
    expect(detail.body.data!.mnemonics[0]!.audioUrl).toMatch(/mnemonic\.mp3$/);
    expect(detail.body.data!.questions).toEqual([]);

    // Başkasının kancası değiştirilemez.
    const other = await createActiveUser(testApp.app);
    const otherClient = await new HttpClient(testApp.baseUrl).login(
      other.email,
      other.password,
    );
    expect(
      (await otherClient.patch(`/mnemonics/${kept!.id}`, { kept: false }))
        .status,
    ).toBe(404);
  });
});
