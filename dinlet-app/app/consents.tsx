import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey, useCraftMutation, useCraftQuery } from "@tanstack-query-craft";
import {
  AuthButton,
  CONSENT_LABELS,
  CrossBorderConsentText,
  FormError,
  LogoMark,
  PrivacyNoticeConsentText,
  requiredConsent,
  TermsConsentText,
} from "@/components/auth";
import { useAppForm } from "@/context/form-context";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { useAuth } from "@/providers/auth-provider";

/**
 * KVKK onay adımı. Apple / Google ile açılan hesaplar kayıt formunu
 * görmediği için onaylarını burada verir; metin sürümü değişince de
 * kullanıcı buraya düşer. Zorunlu onaylar verilmeden uygulamaya geçilmez.
 */
export default function ConsentsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const me = useCraftQuery("auth", "getMe");
  const acceptConsents = useCraftMutation("users", "acceptConsents");
  const [formError, setFormError] = useState<string | null>(null);
  const current = me.data?.data?.consents;

  const form = useAppForm({
    defaultValues: {
      privacyNoticeAccepted: current?.privacyNotice ?? false,
      crossBorderTransferConsent: current?.crossBorderTransfer ?? false,
      termsAccepted: current?.termsOfUse ?? false,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const response = await acceptConsents.mutateAsync(value);
        // Onay durumu güncellenince kök layout kütüphaneye geçirir.
        queryClient.setQueryData(getQueryKey("auth", "getMe"), (previous: typeof me.data) =>
          previous?.data
            ? { ...previous, data: { ...previous.data, consents: response.data } }
            : previous
        );
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 24, 72),
          paddingBottom: Math.max(insets.bottom + 12, 36),
        }}
      >
        <View className="gap-2.5">
          <LogoMark size="md" />
          <Text
            accessibilityRole="header"
            className="mt-3.5 font-display text-[32px] leading-[35px] tracking-[-0.96px] text-brand-ink"
          >
            Son bir adım
          </Text>
          <Text className="text-base leading-[24px] text-brand-ink-soft">
            Notlarını dinlemeye başlamadan önce aşağıdaki metinleri onaylaman
            gerekiyor.
          </Text>
        </View>

        <View className="mt-7 rounded-2xl bg-brand-lavender px-3.5 py-1.5">
          <form.AppField
            name="privacyNoticeAccepted"
            validators={requiredConsent("Aydınlatma Metni'ni okuduğunu onayla.")}
          >
            {(field) => (
              <field.ConsentField accessibilityLabel={CONSENT_LABELS.privacyNotice}>
                <PrivacyNoticeConsentText />
              </field.ConsentField>
            )}
          </form.AppField>
          <View className="h-px bg-brand-line" />
          <form.AppField name="crossBorderTransferConsent">
            {(field) => (
              <field.ConsentField accessibilityLabel={CONSENT_LABELS.crossBorderTransfer}>
                <CrossBorderConsentText />
              </field.ConsentField>
            )}
          </form.AppField>
          <View className="h-px bg-brand-line" />
          <form.AppField
            name="termsAccepted"
            validators={requiredConsent("Kullanım Koşulları'nı kabul et.")}
          >
            {(field) => (
              <field.ConsentField accessibilityLabel={CONSENT_LABELS.terms}>
                <TermsConsentText />
              </field.ConsentField>
            )}
          </form.AppField>
        </View>

        <Text className="mt-3 px-1 text-[13px] leading-[19px] text-brand-muted">
          Yurt dışına aktarım rızası isteğe bağlıdır. Vermezsen notların yapay
          zekâ ile düzenlenmeden, olduğu gibi seslendirilir.
        </Text>

        <form.Subscribe
          selector={(state) =>
            [
              state.fieldMeta.privacyNoticeAccepted?.errors?.[0],
              state.fieldMeta.termsAccepted?.errors?.[0],
            ] as const
          }
        >
          {([privacyError, termsError]) =>
            privacyError || termsError ? (
              <Text className="mt-2 px-1 text-sm text-brand-danger">
                {privacyError && termsError
                  ? "Devam etmek için Aydınlatma Metni'ni ve Kullanım Koşulları'nı onayla."
                  : String(privacyError ?? termsError)}
              </Text>
            ) : null
          }
        </form.Subscribe>

        {formError ? (
          <View className="mt-4">
            <FormError>{formError}</FormError>
          </View>
        ) : null}

        <View className="min-h-6 flex-1" />

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <AuthButton loading={isSubmitting} onPress={() => void form.handleSubmit()}>
              Onayla ve devam et
            </AuthButton>
          )}
        </form.Subscribe>

        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void signOut()}
          className="mt-[18px] items-center"
        >
          <Text className="text-[15px] font-semibold text-brand-ink-soft">Çıkış yap</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
