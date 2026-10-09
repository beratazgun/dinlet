import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseService } from "#database/database.service.js";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./support/test-app.js";

interface StoreItem {
  id: number;
  title: string;
  isFree: boolean;
  isOwned: boolean;
  libraryDocumentId: number | null;
  sectionCount: number;
  questionCount: number;
  categories: { slug: string }[];
  price: { raw: string; display: string } | null;
  source: { raw: string; display: string };
}

interface StoreItemDetail extends StoreItem {
  sections: { order: number; isSample: boolean; audioUrl: string | null }[];
  bundles: { id: number; isOwned: boolean }[];
}

interface LibraryResult {
  entries: { storeItemId: number; documentId: number; isNew: boolean }[];
}

interface Category {
  id: number;
  slug: string;
  children: { id: number; slug: string }[];
}

describe("Not mağazası (e2e)", () => {
  let testApp: TestApp;
  let editor: TestUser;
  let editorClient: HttpClient;
  let student: TestUser;
  let studentClient: HttpClient;
  let kpssId: number;
  let tarihId: number;
  const suffix = randomUUID().slice(0, 8);

  const db = () => testApp.app.get(DatabaseService).client;

  beforeAll(async () => {
    testApp = await startTestApp();

    // Editör: kendi notunu mağazaya koyan süper yönetici.
    editor = await createActiveUser(testApp.app);
    const superAdmin = await db()
      .orm.public.Role.where({ code: "SUPER_ADMIN" })
      .select("id")
      .first();
    await db()
      .orm.public.User.where({ id: editor.id })
      .updateAndCount({ roleId: superAdmin!.id });
    editorClient = await new HttpClient(testApp.baseUrl, {
      deviceId: randomUUID(),
    }).login(editor.email, editor.password);

    student = await createActiveUser(testApp.app);
    studentClient = await new HttpClient(testApp.baseUrl, {
      deviceId: randomUUID(),
    }).login(student.email, student.password);

    const categories = await editorClient.get<Category[]>(
      "/admin/store/categories",
    );
    const kpss = categories.body.data!.find(
      (category) => category.slug === "kpss",
    )!;
    kpssId = kpss.id;
    tarihId = kpss.children.find((child) => child.slug === "kpss-tarih")!.id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  /** İşleme hattından geçmiş gibi hazır not: sesli bölümler + soru. */
  async function seedReadyDocument(
    userId: number,
    title: string,
    sections = 3,
  ) {
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
    const document = await db()
      .orm.public.Document.select("id")
      .create({
        userId,
        mediaId: media.id,
        title,
        status: "READY",
        pageCount: sections * 4,
        sourceHash: randomUUID(),
        storagePrefix: prefix,
        rewriteMode: "FLUENT",
        totalDurationMs: sections * 600_000,
      });
    for (let order = 1; order <= sections; order++) {
      const section = await db()
        .orm.public.Section.select("id")
        .create({
          documentId: document.id,
          order,
          title: `Bölüm ${order}`,
          sourceText: "metin",
          charCount: 8_000,
          status: "READY",
          script: { paragraphs: [`Anlatım ${order}`], recap: null },
          audioKey: `audio/${userId}/${document.id}-${prefix}/${order}.mp3`,
          durationMs: 600_000,
        });
      await db().orm.public.QuizQuestion.create({
        sectionId: section.id,
        order: 1,
        question: "Soru?",
        answer: "Cevap",
        detail: "Açıklama",
        questionAudioKey: `audio/q-${section.id}.mp3`,
        questionDurationMs: 3_000,
        answerAudioKey: `audio/a-${section.id}.mp3`,
        answerDurationMs: 3_000,
      });
    }
    return document.id;
  }

  const webhook = (
    type: string,
    productId: string,
    transactionId = randomUUID(),
  ) =>
    fetch(`${testApp.baseUrl}/api/v1/webhooks/revenuecat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: process.env.REVENUECAT_WEBHOOK_AUTH!,
      },
      body: JSON.stringify({
        api_version: "1.0",
        event: {
          id: randomUUID(),
          type,
          app_user_id: String(student.id),
          product_id: productId,
          transaction_id: transactionId,
          entitlement_ids: null,
          event_timestamp_ms: Date.now(),
          store: "APP_STORE",
        },
      }),
    });

  async function createItem(body: Record<string, unknown>) {
    const response = await editorClient.post<StoreItem>("/admin/store/items", {
      description: "Sınavda en çok sorulan konulara göre bölümlenmiş anlatım.",
      source: "ORIGINAL",
      credit: "Dinlet editörleri",
      categoryIds: [tarihId],
      isPublished: true,
      ...body,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body.data!;
  }

  let freeItemId: number;
  let freeSourceId: number;
  let paidItemId: number;
  let paidProduct: string;

  it("yönetim uçları öğrenciye kapalı; editör yalnızca kendi hazır notunu koyar", async () => {
    expect((await studentClient.get("/admin/store/items")).status).toBe(403);

    const studentDocument = await seedReadyDocument(
      student.id,
      "Öğrencinin notu",
    );
    const foreign = await editorClient.post("/admin/store/items", {
      documentId: studentDocument,
      title: "Başkasının notu",
      description: "Bu not editöre ait değil, yayınlanamaz.",
      source: "ORIGINAL",
    });
    expect(foreign.status).toBe(404);

    freeSourceId = await seedReadyDocument(editor.id, "Anayasa");
    const item = await createItem({
      documentId: freeSourceId,
      title: `T.C. Anayasası ${suffix}`,
      source: "LEGISLATION",
      categoryIds: [kpssId, tarihId],
      isFeatured: true,
      sampleSections: 1,
    });
    freeItemId = item.id;
    expect(item).toMatchObject({
      isFree: true,
      sectionCount: 3,
      questionCount: 3,
      source: { raw: "LEGISLATION", display: "Mevzuat" },
    });

    const again = await editorClient.post("/admin/store/items", {
      documentId: freeSourceId,
      title: "Tekrar",
      description: "Aynı not ikinci kez mağazaya konamaz.",
      source: "ORIGINAL",
    });
    expect(again.status).toBe(409);
    expect(again.body.data).toMatchObject({ code: "STORE_DOCUMENT_TAKEN" });

    // Mağazadaki içeriğin kaynak notu silinemez.
    const remove = await editorClient.delete(`/documents/${freeSourceId}`);
    expect(remove.status).toBe(409);
    expect(remove.body.data).toMatchObject({ code: "STORE_SOURCE_DOCUMENT" });
  });

  it("mağazada listeler; detayda yalnızca örnek bölümün sesi açık", async () => {
    const home = await studentClient.get<{
      categories: Category[];
      featured: StoreItem[];
    }>("/store");
    expect(home.status).toBe(200);
    expect(
      home.body.data!.categories.map((category) => category.slug),
    ).toContain("kpss");
    expect(home.body.data!.featured.map((item) => item.id)).toContain(
      freeItemId,
    );

    // Sınav seçilince alt dersin içerikleri de gelir.
    const byExam = await studentClient.get<StoreItem[]>(
      `/store/items?categoryId=${kpssId}&q=${encodeURIComponent(suffix)}`,
    );
    expect(byExam.body.data!.map((item) => item.id)).toEqual([freeItemId]);
    expect(byExam.body.meta).toMatchObject({ pagination: { totalDocs: 1 } });

    const detail = await studentClient.get<StoreItemDetail>(
      `/store/items/${freeItemId}`,
    );
    expect(detail.status).toBe(200);
    expect(
      detail.body.data!.sections.map((section) => section.isSample),
    ).toEqual([true, false, false]);
    expect(detail.body.data!.sections[0]!.audioUrl).toMatch(/1\.mp3$/);
    expect(detail.body.data!.sections[1]!.audioUrl).toBeNull();
  });

  it("ücretsiz içeriği kütüphaneye kopyalar; kota düşmez, tekrar eklemek aynı notu döner", async () => {
    const added = await studentClient.post<LibraryResult>(
      `/store/items/${freeItemId}/library`,
    );
    expect(added.status).toBe(201);
    const { documentId, isNew } = added.body.data!.entries[0]!;
    expect(isNew).toBe(true);

    const again = await studentClient.post<LibraryResult>(
      `/store/items/${freeItemId}/library`,
    );
    expect(again.status).toBe(200);
    expect(again.body.data!.entries[0]!.documentId).toBe(documentId);

    const document = await studentClient.get<{
      storeItemId: number;
      status: { raw: string };
      sections: { id: number; audioUrl: string | null }[];
    }>(`/documents/${documentId}`);
    expect(document.status).toBe(200);
    expect(document.body.data).toMatchObject({
      storeItemId: freeItemId,
      status: { raw: "READY" },
    });
    expect(document.body.data!.sections).toHaveLength(3);
    // Ses kaynak notun dosyasıdır; sorular da kopyalanır.
    const section = await studentClient.get<{
      audioUrl: string;
      questions: unknown[];
    }>(`/sections/${document.body.data!.sections[0]!.id}`);
    expect(section.body.data!.audioUrl).toMatch(/1\.mp3$/);
    expect(section.body.data!.questions).toHaveLength(1);

    const subscription = await studentClient.get<{
      usage: { remainingPages: number };
    }>("/me/subscription");
    expect(subscription.body.data!.usage.remainingPages).toBe(30);

    const owned = await studentClient.get<StoreItem[]>(
      "/store/items?owned=true",
    );
    expect(
      owned.body.data!.find((item) => item.id === freeItemId),
    ).toMatchObject({
      isOwned: true,
      libraryDocumentId: documentId,
    });

    // Kopya kullanıcının notudur: silinebilir, sonra yeniden eklenebilir.
    expect(
      (await studentClient.delete(`/documents/${documentId}`)).status,
    ).toBe(204);
    const readded = await studentClient.post<LibraryResult>(
      `/store/items/${freeItemId}/library`,
    );
    expect(readded.status).toBe(201);
    expect(readded.body.data!.entries[0]!.documentId).not.toBe(documentId);
  });

  it("ücretli içerik satın alınmadan eklenmez; webhook sahipliği verir, Pro yapmaz", async () => {
    paidProduct = `dinlet_store_e2e_${suffix}`;
    const item = await createItem({
      documentId: await seedReadyDocument(editor.id, "İslamiyet Öncesi"),
      title: `İslamiyet Öncesi Türk Tarihi ${suffix}`,
      productId: paidProduct,
      priceTry: 79.99,
    });
    paidItemId = item.id;
    expect(item.price).toMatchObject({ raw: "79.99" });

    const blocked = await studentClient.post(
      `/store/items/${paidItemId}/library`,
    );
    expect(blocked.status).toBe(402);
    expect(blocked.body.data).toMatchObject({ code: "PURCHASE_REQUIRED" });

    expect((await webhook("NON_RENEWING_PURCHASE", paidProduct)).status).toBe(
      200,
    );
    const subscription = await studentClient.get<{ plan: { raw: string } }>(
      "/me/subscription",
    );
    expect(subscription.body.data!.plan.raw).toBe("FREE");

    const added = await studentClient.post<LibraryResult>(
      `/store/items/${paidItemId}/library`,
    );
    expect(added.status).toBe(201);
  });

  it("paket satın alması paketteki içeriklerin hepsini açar", async () => {
    const second = await createItem({
      documentId: await seedReadyDocument(editor.id, "Osmanlı", 2),
      title: `Osmanlı Kuruluş ${suffix}`,
      productId: `dinlet_store_e2e_osmanli_${suffix}`,
    });
    const third = await createItem({
      documentId: await seedReadyDocument(editor.id, "Çağdaş", 2),
      title: `Çağdaş Türk Tarihi ${suffix}`,
      productId: `dinlet_store_e2e_cagdas_${suffix}`,
    });
    const bundleProduct = `dinlet_store_e2e_bundle_${suffix}`;
    const bundle = await editorClient.post<{
      id: number;
      itemCount: number;
      sectionCount: number;
    }>("/admin/store/bundles", {
      title: `KPSS Tarih, tamamı ${suffix}`,
      description: "Tek tek almaktan uygun.",
      categoryId: tarihId,
      productId: bundleProduct,
      priceTry: 199.99,
      itemIds: [second.id, third.id],
      isPublished: true,
    });
    expect(bundle.status, JSON.stringify(bundle.body)).toBe(201);
    expect(bundle.body.data).toMatchObject({ itemCount: 2, sectionCount: 4 });
    const bundleId = bundle.body.data!.id;

    expect(
      (await studentClient.post(`/store/bundles/${bundleId}/library`)).status,
    ).toBe(402);
    await webhook("NON_RENEWING_PURCHASE", bundleProduct);

    const added = await studentClient.post<LibraryResult>(
      `/store/bundles/${bundleId}/library`,
    );
    expect(added.status).toBe(201);
    expect(
      added.body.data!.entries.map((entry) => entry.storeItemId).sort(),
    ).toEqual([second.id, third.id].sort());

    const listed = await studentClient.get<{ id: number; isOwned: boolean }[]>(
      `/store/bundles?categoryId=${kpssId}`,
    );
    expect(listed.body.data!.find((row) => row.id === bundleId)).toMatchObject({
      isOwned: true,
    });
  });

  it("iade sahipliği ve kütüphanedeki kopyayı kaldırır, aboneliğe dokunmaz", async () => {
    const before = await studentClient.get<StoreItemDetail>(
      `/store/items/${paidItemId}`,
    );
    const documentId = before.body.data!.libraryDocumentId!;
    expect(documentId).toBeTruthy();

    expect((await webhook("CANCELLATION", paidProduct)).status).toBe(200);

    expect((await studentClient.get(`/documents/${documentId}`)).status).toBe(
      404,
    );
    const after = await studentClient.get<StoreItemDetail>(
      `/store/items/${paidItemId}`,
    );
    expect(after.body.data).toMatchObject({
      isOwned: false,
      libraryDocumentId: null,
    });
    const subscription = await studentClient.get<{
      plan: { raw: string };
      status: { raw: string | null };
    }>("/me/subscription");
    expect(subscription.body.data).toMatchObject({
      plan: { raw: "FREE" },
      status: { raw: null },
    });
  });

  it("yayından kalkan içerik mağazada görünmez, sahibine görünür", async () => {
    const patched = await editorClient.patch<{ isPublished: boolean }>(
      `/admin/store/items/${freeItemId}`,
      { isPublished: false },
    );
    expect(patched.status).toBe(200);
    expect(patched.body.data!.isPublished).toBe(false);

    const listed = await studentClient.get<StoreItem[]>(
      `/store/items?q=${encodeURIComponent(`Anayasası ${suffix}`)}`,
    );
    expect(listed.body.data).toEqual([]);
    expect((await studentClient.get(`/store/items/${freeItemId}`)).status).toBe(
      200,
    );

    const stranger = await createActiveUser(testApp.app);
    const strangerClient = await new HttpClient(testApp.baseUrl, {
      deviceId: randomUUID(),
    }).login(stranger.email, stranger.password);
    expect(
      (await strangerClient.get(`/store/items/${freeItemId}`)).status,
    ).toBe(404);
    expect(
      (await strangerClient.post(`/store/items/${freeItemId}/library`)).status,
    ).toBe(404);
  });
});
