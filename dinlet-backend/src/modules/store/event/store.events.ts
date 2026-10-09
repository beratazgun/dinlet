export const STORE_SUBMISSION_REVIEWED_EVENT = "store.submission.reviewed";

/** Editör paylaşım başvurusunu onayladı veya reddetti. */
export class StoreSubmissionReviewedEvent {
  constructor(
    public readonly userId: number,
    public readonly submissionId: number,
    public readonly title: string,
    public readonly approved: boolean,
    /** Onaylandıysa mağazadaki içerik. */
    public readonly storeItemId: number | null,
    /** Reddedildiyse editörün notu. */
    public readonly reason: string | null,
  ) {}
}
