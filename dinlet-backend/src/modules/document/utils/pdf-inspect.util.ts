import { createHash } from "node:crypto";

import { UnprocessableEntityException } from "@nestjs/common";
import { EncryptedPDFError, PDFDocument } from "pdf-lib";

import { hasPdfSignature } from "#/modules/media/utils/index.js";

export interface PdfInfo {
  pageCount: number;
  /** İçeriğin SHA-256 özeti (hex); aynı PDF'in tekrar yüklenmesini yakalar. */
  sha256: string;
}

/**
 * PDF'i doğrular ve sayfa sayısını okur. Şifreli veya bozuk PDF **422**
 * fırlatır (kota düşülmeden önce çağrılır).
 */
export async function inspectPdf(buffer: Buffer): Promise<PdfInfo> {
  if (!hasPdfSignature(buffer)) {
    throw new UnprocessableEntityException("Dosya geçerli bir PDF değil.");
  }

  let pageCount: number;
  try {
    const document = await PDFDocument.load(buffer, { updateMetadata: false });
    // Bozuk dosya yüklenebilir ama sayfa ağacı okunurken patlar.
    pageCount = document.getPageCount();
  } catch (error) {
    throw new UnprocessableEntityException(
      error instanceof EncryptedPDFError
        ? "Şifreli PDF'ler işlenemiyor. Lütfen şifresiz bir kopya yükleyin."
        : "PDF okunamadı; dosya bozuk olabilir.",
    );
  }

  if (pageCount < 1) {
    throw new UnprocessableEntityException("PDF'te sayfa bulunamadı.");
  }

  return {
    pageCount,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}
