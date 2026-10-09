/**
 * Prisma Schema'daki Enum'ların Türkçe Karşılıkları
 * Proje genelinde enum değerlerinin Türkçe çevirilerini sağlar.
 *
 * Yeni enum eklerken:
 *   1) Import'a ekle
 *   2) <EnumAdı>Translations sabitini tanımla
 *   3) EnumTranslations.translations getter'ına entry ekle
 */

import {
  AccountType,
  ConsentType,
  DevicePlatform,
  DocumentStatus,
  ExtractQuality,
  JobCategory,
  JobStatusEnum,
  NotificationType,
  GenerationStatus,
  RewriteMode,
  SectionStatus,
  StoreEntitlementSource,
  StoreSource,
  SubmissionStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionStore,
  UserStatus,
  RecordingStatus,
  VerificationTokenType,
  VoicePreference,
} from "#database/enums.js";

// ============================================
// AUTH / USER
// ============================================

export const UserStatusTranslations = {
  [UserStatus.PENDING]: "Beklemede",
  [UserStatus.ACTIVE]: "Aktif",
  [UserStatus.SUSPENDED]: "Askıya Alındı",
} as const;

export const VerificationTokenTypeTranslations = {
  [VerificationTokenType.EMAIL_VERIFICATION]: "E-posta Doğrulama",
  [VerificationTokenType.PASSWORD_RESET]: "Şifre Sıfırlama",
} as const;

export const AccountTypeTranslations = {
  [AccountType.LOCAL]: "Yerel",
  [AccountType.GOOGLE]: "Google",
  [AccountType.APPLE]: "Apple",
} as const;

export const ConsentTypeTranslations = {
  [ConsentType.PRIVACY_NOTICE]: "Aydınlatma Metni",
  [ConsentType.TERMS_OF_USE]: "Kullanım Koşulları",
  [ConsentType.CROSS_BORDER_TRANSFER]: "Yurt Dışına Aktarım Rızası",
} as const;

// ============================================
// DOCUMENT
// ============================================

export const DocumentStatusTranslations = {
  [DocumentStatus.QUEUED]: "Sırada",
  [DocumentStatus.EXTRACTING]: "Metin Çıkarılıyor",
  [DocumentStatus.SCRIPTING]: "Metin Hazırlanıyor",
  [DocumentStatus.SYNTHESIZING]: "Seslendiriliyor",
  [DocumentStatus.READY]: "Hazır",
  [DocumentStatus.PARTIAL]: "Kısmen Hazır",
  [DocumentStatus.FAILED]: "Başarısız",
} as const;

export const SectionStatusTranslations = {
  [SectionStatus.PENDING]: "Beklemede",
  [SectionStatus.SCRIPTING]: "Metin Hazırlanıyor",
  [SectionStatus.SCRIPTED]: "Metin Hazır",
  [SectionStatus.SYNTHESIZING]: "Seslendiriliyor",
  [SectionStatus.READY]: "Hazır",
  [SectionStatus.FAILED]: "Başarısız",
} as const;

export const ExtractQualityTranslations = {
  [ExtractQuality.OK]: "İyi",
  [ExtractQuality.LOW]: "Düşük",
} as const;

export const GenerationStatusTranslations = {
  [GenerationStatus.PENDING]: "Hazırlanıyor",
  [GenerationStatus.READY]: "Hazır",
  [GenerationStatus.FAILED]: "Hazırlanamadı",
} as const;

export const RewriteModeTranslations = {
  [RewriteMode.RAW]: "Standart Okuma",
  [RewriteMode.FLUENT]: "Akıcı Anlatım",
} as const;

// ============================================
// SUBSCRIPTION
// ============================================

export const SubscriptionPlanTranslations = {
  [SubscriptionPlan.FREE]: "Ücretsiz",
  [SubscriptionPlan.PRO]: "Pro",
} as const;

export const SubscriptionStatusTranslations = {
  [SubscriptionStatus.ACTIVE]: "Aktif",
  [SubscriptionStatus.GRACE]: "Ödeme Bekleniyor",
  [SubscriptionStatus.EXPIRED]: "Süresi Doldu",
  [SubscriptionStatus.CANCELLED]: "İptal Edildi",
} as const;

export const SubscriptionStoreTranslations = {
  [SubscriptionStore.APP_STORE]: "App Store",
  [SubscriptionStore.PLAY_STORE]: "Google Play",
} as const;

// ============================================
// STORE
// ============================================

export const StoreSourceTranslations = {
  [StoreSource.ORIGINAL]: "Dinlet özgün",
  [StoreSource.LEGISLATION]: "Mevzuat",
  [StoreSource.PUBLISHER]: "Ortak yayınevi",
  [StoreSource.PUBLIC_DOMAIN]: "Kamu malı metin",
  [StoreSource.COMMUNITY]: "Öğrenci notu",
} as const;

export const SubmissionStatusTranslations = {
  [SubmissionStatus.PENDING]: "İncelemede",
  [SubmissionStatus.APPROVED]: "Yayında",
  [SubmissionStatus.REJECTED]: "Onaylanmadı",
  [SubmissionStatus.WITHDRAWN]: "Kaldırıldı",
} as const;

export const StoreEntitlementSourceTranslations = {
  [StoreEntitlementSource.FREE]: "Ücretsiz",
  [StoreEntitlementSource.PURCHASE]: "Satın alındı",
  [StoreEntitlementSource.GRANT]: "Hediye",
} as const;

// ============================================
// VOICE
// ============================================

export const VoicePreferenceTranslations = {
  [VoicePreference.STANDARD]: "Dinlet Standart",
  [VoicePreference.NATURAL]: "Doğal ses",
  [VoicePreference.OWN]: "Benim sesim",
} as const;

export const RecordingStatusTranslations = {
  [RecordingStatus.DRAFT]: "Yarım",
  [RecordingStatus.PROCESSING]: "Hazırlanıyor",
  [RecordingStatus.READY]: "Hazır",
  [RecordingStatus.FAILED]: "Hazırlanamadı",
} as const;

export const DevicePlatformTranslations = {
  [DevicePlatform.IOS]: "iOS",
  [DevicePlatform.ANDROID]: "Android",
} as const;

// ============================================
// JOB
// ============================================

export const JobCategoryTranslations = {
  [JobCategory.MAINTENANCE]: "Bakım",
  [JobCategory.NOTIFICATION]: "Bildirim",
  [JobCategory.DATA_SYNC]: "Veri Senkronizasyonu",
  [JobCategory.CLEANUP]: "Temizlik",
  [JobCategory.OTHER]: "Diğer",
} as const;

export const JobStatusEnumTranslations = {
  [JobStatusEnum.PENDING]: "Beklemede",
  [JobStatusEnum.RUNNING]: "Çalışıyor",
  [JobStatusEnum.SUCCESS]: "Başarılı",
  [JobStatusEnum.FAILED]: "Başarısız",
  [JobStatusEnum.TIMEOUT]: "Zaman Aşımı",
  [JobStatusEnum.CANCELLED]: "İptal Edildi",
} as const;

// ============================================
// NOTIFICATION
// ============================================

export const NotificationTypeTranslations = {
  [NotificationType.PASSWORD_CHANGED]: "Şifre Değişikliği",
  [NotificationType.ACCOUNT_LOCKED]: "Hesap Kilitlendi",
  [NotificationType.NEW_DEVICE_LOGIN]: "Yeni Cihazdan Giriş",
  [NotificationType.DOCUMENT_READY]: "Not Hazır",
  [NotificationType.DOCUMENT_FAILED]: "Not İşlenemedi",
  [NotificationType.STORE_SUBMISSION_APPROVED]: "Paylaşım Yayında",
  [NotificationType.STORE_SUBMISSION_REJECTED]: "Paylaşım Onaylanmadı",
} as const;

// ============================================
// REGISTRY
// ============================================

/**
 * Enum çevirilerini tek bir class üzerinden erişilebilir hale getiren utility class.
 */
export class EnumTranslations {
  static get translations(): Record<string, Record<string, string>> {
    return {
      AccountType: AccountTypeTranslations,
      ConsentType: ConsentTypeTranslations,
      DevicePlatform: DevicePlatformTranslations,
      DocumentStatus: DocumentStatusTranslations,
      ExtractQuality: ExtractQualityTranslations,
      JobCategory: JobCategoryTranslations,
      JobStatusEnum: JobStatusEnumTranslations,
      NotificationType: NotificationTypeTranslations,
      GenerationStatus: GenerationStatusTranslations,
      RewriteMode: RewriteModeTranslations,
      SectionStatus: SectionStatusTranslations,
      StoreEntitlementSource: StoreEntitlementSourceTranslations,
      StoreSource: StoreSourceTranslations,
      SubmissionStatus: SubmissionStatusTranslations,
      SubscriptionPlan: SubscriptionPlanTranslations,
      SubscriptionStatus: SubscriptionStatusTranslations,
      SubscriptionStore: SubscriptionStoreTranslations,
      RecordingStatus: RecordingStatusTranslations,
      UserStatus: UserStatusTranslations,
      VerificationTokenType: VerificationTokenTypeTranslations,
      VoicePreference: VoicePreferenceTranslations,
    };
  }

  static getEnumValues(enumType: string): string[] {
    const translation = this.translations[enumType];
    return translation ? Object.keys(translation) : [];
  }

  static translate(enumType: string, value: string): string {
    return this.translations[enumType]?.[value] || value;
  }
}
