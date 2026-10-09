import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

interface MediaItem {
  id: number;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/** Tek sayfalık, en küçük geçerli PDF. */
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF",
);

async function putToStorage(ticket: UploadTicket, body: Buffer): Promise<number> {
  const response = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.headers,
    body: new Uint8Array(body),
  });
  return response.status;
}

describe("Media (e2e)", () => {
  let testApp: TestApp;
  let client: HttpClient;

  beforeAll(async () => {
    testApp = await startTestApp();
    const user = await createActiveUser(testApp.app);
    client = await new HttpClient(testApp.baseUrl).login(user.email, user.password);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  async function uploadPdf(fileName = "note.pdf"): Promise<MediaItem> {
    const ticket = await client.post<UploadTicket>("/media/uploads", {
      fileName,
      mimeType: "application/pdf",
      size: PDF.length,
    });
    expect(ticket.status).toBe(201);
    expect(ticket.body.data!.headers).toMatchObject({ "Content-Type": "application/pdf" });

    expect(await putToStorage(ticket.body.data!, PDF)).toBe(200);

    const completed = await client.post<MediaItem>(
      `/media/uploads/${ticket.body.data!.uploadId}/complete`,
    );
    expect(completed.status).toBe(201);
    return completed.body.data!;
  }

  it("imzalı URL ile yükler, kaydı tamamlar ve listeler", async () => {
    const media = await uploadPdf();

    expect(media).toMatchObject({
      fileName: "note.pdf",
      mimeType: "application/pdf",
      size: PDF.length,
    });
    expect(media.url).toMatch(/\/media\/\d+\/\d{4}-\d{2}\/[a-z0-9]{24}\.pdf$/);

    // Kalıcı nesne CDN URL'inden erişilebilir.
    expect((await fetch(media.url)).status).toBe(200);

    const list = await client.get<MediaItem[]>("/media");
    expect(list.status).toBe(200);
    expect(list.body.data!.map((item) => item.id)).toContain(media.id);
  });

  it("dosya yüklenmeden tamamlamayı 422 ile reddeder, sonra yeniden denenebilir", async () => {
    const ticket = await client.post<UploadTicket>("/media/uploads", {
      fileName: "late.pdf",
      mimeType: "application/pdf",
      size: PDF.length,
    });

    const early = await client.post(`/media/uploads/${ticket.body.data!.uploadId}/complete`);
    expect(early.status).toBe(422);

    await putToStorage(ticket.body.data!, PDF);
    const retry = await client.post(`/media/uploads/${ticket.body.data!.uploadId}/complete`);
    expect(retry.status).toBe(201);
  });

  it("aynı yüklemeyi ikinci kez tamamlamaz", async () => {
    const ticket = await client.post<UploadTicket>("/media/uploads", {
      fileName: "once.pdf",
      mimeType: "application/pdf",
      size: PDF.length,
    });
    await putToStorage(ticket.body.data!, PDF);
    const path = `/media/uploads/${ticket.body.data!.uploadId}/complete`;

    expect((await client.post(path)).status).toBe(201);
    expect((await client.post(path)).status).toBe(404);
  });

  it("desteklenmeyen türü ve limit üstü boyutu reddeder", async () => {
    const badType = await client.post("/media/uploads", {
      fileName: "script.sh",
      mimeType: "application/x-sh",
      size: 10,
    });
    expect(badType.status).toBe(400);

    const tooLarge = await client.post("/media/uploads", {
      fileName: "huge.pdf",
      mimeType: "application/pdf",
      size: 50 * 1024 * 1024,
    });
    expect(tooLarge.status).toBe(400);
  });

  it("başka kullanıcının medyasına erişemez", async () => {
    const media = await uploadPdf("private.pdf");
    const other = await createActiveUser(testApp.app);
    const otherClient = await new HttpClient(testApp.baseUrl).login(other.email, other.password);

    expect((await otherClient.get(`/media/${media.id}`)).status).toBe(404);
    expect((await otherClient.delete(`/media/${media.id}`)).status).toBe(404);
  });
});
