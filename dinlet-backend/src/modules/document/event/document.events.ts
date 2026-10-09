import type { DocumentStatus } from "#database/enums.js";

export const DOCUMENT_CREATED_EVENT = "document.created";
export const DOCUMENT_PROGRESS_EVENT = "document.progress";
export const DOCUMENT_READY_EVENT = "document.ready";
export const DOCUMENT_FAILED_EVENT = "document.failed";
export const SECTION_COMPLETED_EVENT = "section.completed";

/** Kullanıcı bir bölümü sonuna kadar dinledi (aralıklı tekrara girer). */
export class SectionCompletedEvent {
  constructor(
    public readonly userId: number,
    public readonly sectionId: number,
  ) {}
}

/** Belge kotadan düşülerek açıldı; metin çıkarma kuyruğa alınacak. */
export class DocumentCreatedEvent {
  constructor(public readonly documentId: number) {}
}

/** İşleme ilerledi (durum değişti veya bir bölümün sesi hazır). */
export class DocumentProgressEvent {
  constructor(
    public readonly userId: number,
    public readonly documentId: number,
    public readonly status: DocumentStatus,
    public readonly percent: number,
    public readonly readySectionIds: number[],
  ) {}
}

/** Belge dinlenmeye hazır (`READY`, ya da bazı bölümler başarısızsa `PARTIAL`). */
export class DocumentReadyEvent {
  constructor(
    public readonly userId: number,
    public readonly documentId: number,
    public readonly title: string,
    public readonly isPartial: boolean,
  ) {}
}

/** Belge işlenemedi; kota iade edildi. */
export class DocumentFailedEvent {
  constructor(
    public readonly userId: number,
    public readonly documentId: number,
    public readonly title: string,
    public readonly reason: string,
  ) {}
}
