import { BadRequestException } from "@nestjs/common";

/** Kabul edilen MIME türü → depolamada kullanılacak uzantı. */
const ALLOWED_MIME_TYPES: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
};

export const ALLOWED_UPLOAD_MIME_TYPES = Object.keys(ALLOWED_MIME_TYPES);

export interface UploadCandidate {
  mimeType: string;
  size: number;
}

/** Türü desteklenen ve boyutu `[1, maxSize]` aralığında olan dosya kabul edilir. */
export function assertUploadAllowed(
  candidate: UploadCandidate,
  maxSize: number,
): void {
  if (!(candidate.mimeType in ALLOWED_MIME_TYPES)) {
    throw new BadRequestException({
      message: "Bu dosya türü desteklenmiyor.",
      allowedMimeTypes: ALLOWED_UPLOAD_MIME_TYPES,
    });
  }
  if (candidate.size < 1 || candidate.size > maxSize) {
    throw new BadRequestException({
      message: `Dosya boyutu 1 bayt ile ${maxSize} bayt arasında olmalıdır.`,
      maxSize,
    });
  }
}

/** Kabul edilmiş bir MIME türünün dosya uzantısı. */
export function extensionFor(mimeType: string): string {
  const extension = ALLOWED_MIME_TYPES[mimeType];
  if (!extension) throw new BadRequestException("Bu dosya türü desteklenmiyor.");
  return extension;
}

const PDF_MAGIC = Buffer.from("%PDF-");

/** Dosyanın ilk baytları PDF imzası (`%PDF-`) mı? */
export function hasPdfSignature(head: Buffer): boolean {
  return head.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}
