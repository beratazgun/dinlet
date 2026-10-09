import type { AccountType } from "#database/enums.js";

/** Sosyal giriş sağlayıcıları (mobil yerel SDK'lar). */
export type SocialProvider = Extract<AccountType, "GOOGLE" | "APPLE">;

/**
 * Sağlayıcının imzalı kimlik token'ından doğrulanarak çıkarılan profil.
 * Hesap eşleştirme yalnızca `isEmailVerified` doğruysa e-postayla yapılır.
 */
export interface SocialProfile {
  provider: SocialProvider;
  /** Sağlayıcıdaki değişmez kullanıcı kimliği (`sub`). */
  providerAccountId: string;
  /** Apple e-postayı yalnızca ilk girişte verir; sonrakilerde `null`. */
  email: string | null;
  isEmailVerified: boolean;
  name: string | null;
  surname: string | null;
}
