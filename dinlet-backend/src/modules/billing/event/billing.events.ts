import type { SubscriptionStore } from "#database/enums.js";

export const REVENUECAT_PRODUCT_EVENT = "revenuecat.product";

/**
 * Bir ürüne ait RevenueCat olayı (abonelik dışı ürünler için). Dinleyici
 * ürünü tanıyıp işlediyse `true` döner; webhook o zaman aboneliğe dokunmaz.
 */
export class RevenueCatProductEvent {
  constructor(
    public readonly userId: number,
    /** `NON_RENEWING_PURCHASE`, `CANCELLATION` … */
    public readonly type: string,
    public readonly productId: string,
    public readonly transactionId: string | null,
    public readonly store: SubscriptionStore | null,
  ) {}
}
