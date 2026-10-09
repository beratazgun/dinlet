function stringEnum<const T extends readonly string[]>(values: T) {
  return Object.fromEntries(values.map((value) => [value, value])) as {
    readonly [K in T[number]]: K;
  };
}

export const AccountType = stringEnum(["LOCAL", "GOOGLE", "APPLE"] as const);
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const JobCategory = stringEnum([
  "MAINTENANCE",
  "NOTIFICATION",
  "DATA_SYNC",
  "CLEANUP",
  "OTHER",
] as const);
export type JobCategory = (typeof JobCategory)[keyof typeof JobCategory];

export const JobStatusEnum = stringEnum([
  "PENDING",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
] as const);
export type JobStatusEnum = (typeof JobStatusEnum)[keyof typeof JobStatusEnum];

export const NotificationChannelType = stringEnum([
  "EMAIL",
  "SMS",
  "PUSH",
] as const);
export type NotificationChannelType =
  (typeof NotificationChannelType)[keyof typeof NotificationChannelType];

export const NotificationEntityType = stringEnum([
  "Document",
  "StoreSubmission",
] as const);
export type NotificationEntityType =
  (typeof NotificationEntityType)[keyof typeof NotificationEntityType];

export const NotificationType = stringEnum([
  "PASSWORD_CHANGED",
  "ACCOUNT_LOCKED",
  "NEW_DEVICE_LOGIN",
  "DOCUMENT_READY",
  "DOCUMENT_FAILED",
  "STORE_SUBMISSION_APPROVED",
  "STORE_SUBMISSION_REJECTED",
] as const);
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const UserStatus = stringEnum([
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
] as const);
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const VerificationTokenType = stringEnum([
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
] as const);
export type VerificationTokenType =
  (typeof VerificationTokenType)[keyof typeof VerificationTokenType];

export const DocumentStatus = stringEnum([
  "QUEUED",
  "EXTRACTING",
  "SCRIPTING",
  "SYNTHESIZING",
  "READY",
  "PARTIAL",
  "FAILED",
] as const);
export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const SectionStatus = stringEnum([
  "PENDING",
  "SCRIPTING",
  "SCRIPTED",
  "SYNTHESIZING",
  "READY",
  "FAILED",
] as const);
export type SectionStatus = (typeof SectionStatus)[keyof typeof SectionStatus];

export const ExtractQuality = stringEnum(["OK", "LOW"] as const);
export type ExtractQuality =
  (typeof ExtractQuality)[keyof typeof ExtractQuality];

export const RewriteMode = stringEnum(["RAW", "FLUENT"] as const);
export type RewriteMode = (typeof RewriteMode)[keyof typeof RewriteMode];

export const GenerationStatus = stringEnum([
  "PENDING",
  "READY",
  "FAILED",
] as const);
export type GenerationStatus =
  (typeof GenerationStatus)[keyof typeof GenerationStatus];

export const SubscriptionPlan = stringEnum(["FREE", "PRO"] as const);
export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = stringEnum([
  "ACTIVE",
  "GRACE",
  "EXPIRED",
  "CANCELLED",
] as const);
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SubscriptionStore = stringEnum([
  "APP_STORE",
  "PLAY_STORE",
] as const);
export type SubscriptionStore =
  (typeof SubscriptionStore)[keyof typeof SubscriptionStore];

export const DevicePlatform = stringEnum(["IOS", "ANDROID"] as const);
export type DevicePlatform =
  (typeof DevicePlatform)[keyof typeof DevicePlatform];

export const ConsentType = stringEnum([
  "PRIVACY_NOTICE",
  "TERMS_OF_USE",
  "CROSS_BORDER_TRANSFER",
] as const);
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];

export const StoreSource = stringEnum([
  "ORIGINAL",
  "LEGISLATION",
  "PUBLISHER",
  "PUBLIC_DOMAIN",
  "COMMUNITY",
] as const);
export type StoreSource = (typeof StoreSource)[keyof typeof StoreSource];

export const StoreEntitlementSource = stringEnum([
  "FREE",
  "PURCHASE",
  "GRANT",
] as const);
export type StoreEntitlementSource =
  (typeof StoreEntitlementSource)[keyof typeof StoreEntitlementSource];

export const VoicePreference = stringEnum([
  "STANDARD",
  "NATURAL",
  "OWN",
] as const);
export type VoicePreference =
  (typeof VoicePreference)[keyof typeof VoicePreference];

export const RecordingStatus = stringEnum([
  "DRAFT",
  "PROCESSING",
  "READY",
  "FAILED",
] as const);
export type RecordingStatus =
  (typeof RecordingStatus)[keyof typeof RecordingStatus];

export const SubmissionStatus = stringEnum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const);
export type SubmissionStatus =
  (typeof SubmissionStatus)[keyof typeof SubmissionStatus];
