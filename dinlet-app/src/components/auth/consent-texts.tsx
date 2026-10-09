import { Text } from "react-native";
import { router } from "expo-router";

/**
 * KVKK onay satırlarının metinleri; kayıt ekranında ve Apple / Google ile
 * açılan hesapların onay adımında aynıdır. Metin adları uygulama içindeki
 * metin ekranını (`/legal/[document]`) açar.
 */

export type LegalDocument = "privacy-notice" | "terms-of-use" | "cross-border-transfer";

export const CONSENT_LABELS = {
  privacyNotice: "Aydınlatma Metni'ni okudum.",
  crossBorderTransfer:
    "Notlarımın anlatıma çevrilmek için yurt dışındaki yapay zekâ servisine aktarılmasına açık rıza veriyorum.",
  terms:
    "Yüklediğim içeriklere hakkım olduğunu beyan eder, Kullanım Koşulları'nı kabul ederim.",
} as const;

/** Zorunlu onay kutusunun TanStack Form doğrulayıcısı. */
export const requiredConsent = (message: string) => ({
  onChange: ({ value }: { value: boolean }) => (value ? undefined : message),
});

function DocumentLink({
  document,
  children,
  className = "font-bold text-brand-indigo",
}: {
  document: LegalDocument;
  children: string;
  className?: string;
}) {
  return (
    <Text
      accessibilityRole="link"
      onPress={() => router.push({ pathname: "/legal/[document]", params: { document } })}
      className={className}
    >
      {children}
    </Text>
  );
}

export function PrivacyNoticeConsentText() {
  return (
    <>
      <DocumentLink document="privacy-notice">Aydınlatma Metni</DocumentLink>
      'ni okudum.
    </>
  );
}

export function CrossBorderConsentText() {
  return (
    <>
      Notlarımın anlatıma çevrilmek için{" "}
      <DocumentLink document="cross-border-transfer" className="font-bold text-brand-body">
        yurt dışındaki yapay zekâ servisine aktarılmasına
      </DocumentLink>{" "}
      açık rıza veriyorum.
    </>
  );
}

export function TermsConsentText() {
  return (
    <>
      Yüklediğim içeriklere hakkım olduğunu beyan eder,{" "}
      <DocumentLink document="terms-of-use">Kullanım Koşulları</DocumentLink>'nı kabul
      ederim.
    </>
  );
}
