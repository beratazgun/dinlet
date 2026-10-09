import { Alert } from "react-native";

export type PurchaseResult = "purchased" | "cancelled" | "unavailable";

/**
 * App Store / Google Play'den tek seferlik ürün satın alma. RevenueCat SDK
 * (`react-native-purchases`) henüz uygulamada yok; eklenince yalnızca bu
 * fonksiyon `Purchases.purchaseStoreProduct` ile doldurulur. Satın alma
 * sonrası sahiplik sunucuya webhook'la gelir; ekran ayrıca
 * `POST /store/purchases/sync` ile doğrular.
 */
export async function purchaseProduct(_productId: string): Promise<PurchaseResult> {
  return "unavailable";
}

/** Satın alma henüz açık değilken gösterilen bilgi (Pro ekranıyla aynı dil). */
export function showPurchaseUnavailable(): void {
  Alert.alert(
    "Satın alma",
    "Ödeme App Store ve Google Play üzerinden yapılır. Çok yakında mağaza ödemesiyle aktif!",
    [{ text: "Tamam" }]
  );
}
