import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation } from "@tanstack-query-craft";
import {
  AuthButton,
  BackButton,
  CONSENT_LABELS,
  CrossBorderConsentText,
  FormError,
  PrivacyNoticeConsentText,
  requiredConsent,
  TermsConsentText,
} from "@/components/auth";
import { useAppForm } from "@/context/form-context";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Adın en az 2 harf olmalı.")
  .max(50, "Adın en fazla 50 harf olabilir.");

const surnameSchema = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) {
      ctx.addIssue({ code: "custom", message: "Soyadın en az 2 harf olmalı." });
      return;
    }
    if (trimmed.length > 50) {
      ctx.addIssue({ code: "custom", message: "Soyadın en fazla 50 harf olabilir." });
    }
  });

const emailSchema = z
  .string()
  .trim()
  .min(1, "E-posta adresini yaz.")
  .email("Geçerli bir e-posta adresi yaz.");

const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(64, "Şifre en fazla 64 karakter olabilir.");

export const registerSchema = z.object({
  name: nameSchema,
  surname: surnameSchema,
  email: emailSchema,
  password: passwordSchema,
  privacyNoticeAccepted: z.boolean(),
  termsAccepted: z.boolean(),
  crossBorderTransferConsent: z.boolean().optional(),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

function validateName(value: string) {
  const result = nameSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

function validateSurname(value?: string) {
  const result = surnameSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

function validateEmail(value: string) {
  const result = emailSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

function validateNewPassword(value: string) {
  const result = passwordSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [formError, setFormError] = useState<string | null>(null);
  const register = useCraftMutation("auth", "register");

  const form = useAppForm({
    defaultValues: {
      name: "",
      surname: "",
      email: "",
      password: "",
      privacyNoticeAccepted: false,
      crossBorderTransferConsent: false,
      termsAccepted: false,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const email = value.email.trim();
      const surname = value.surname.trim();
      try {
        await register.mutateAsync({
          name: value.name.trim(),
          surname: surname || undefined,
          email,
          password: value.password,
          privacyNoticeAccepted: value.privacyNoticeAccepted,
          termsAccepted: value.termsAccepted,
          crossBorderTransferConsent: value.crossBorderTransferConsent,
        });
        router.push({ pathname: "/check-email", params: { email } });
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  return (
    <View className="flex-1 bg-brand-offwhite">
      <StatusBar style="dark" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 12, 60),
          paddingBottom: Math.max(insets.bottom + 12, 36),
        }}
      >
        <BackButton
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/welcome")
          }
        />

        <Text
          accessibilityRole="header"
          className="mb-1.5 mt-3 font-display text-[32px] leading-[35px] tracking-[-0.96px] text-brand-ink"
        >
          Hesap oluştur
        </Text>
        <Text className="text-base text-brand-ink-soft">
          Her ay 30 sayfa ücretsiz dinle.
        </Text>

        <View className="mt-[26px] gap-3.5">
          <form.AppField
            name="name"
            validators={{ onChange: ({ value }) => validateName(value) }}
          >
            {(field) => (
              <field.AuthTextField
                label="Ad"
                placeholder="Adın"
                compact
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
              />
            )}
          </form.AppField>
          <form.AppField
            name="surname"
            validators={{ onChange: ({ value }) => validateSurname(value) }}
          >
            {(field) => (
              <field.AuthTextField
                label="Soyad"
                placeholder="Soyadın"
                compact
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
                returnKeyType="next"
              />
            )}
          </form.AppField>
          <form.AppField
            name="email"
            validators={{ onChange: ({ value }) => validateEmail(value) }}
          >
            {(field) => (
              <field.AuthTextField
                label="E-posta"
                placeholder="ornek@eposta.com"
                compact
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            )}
          </form.AppField>
          <form.AppField
            name="password"
            validators={{ onChange: ({ value }) => validateNewPassword(value) }}
          >
            {(field) => (
              <field.AuthTextField
                label="Şifre"
                placeholder="En az 8 karakter"
                compact
                password
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
            )}
          </form.AppField>
        </View>

        <View className="mt-[22px] rounded-2xl bg-brand-lavender px-3.5 py-1.5">
          <form.AppField
            name="privacyNoticeAccepted"
            validators={requiredConsent(
              "Aydınlatma Metni'ni okuduğunu onayla.",
            )}
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
            <AuthButton
              loading={isSubmitting}
              onPress={() => void form.handleSubmit()}
            >
              Hesap oluştur
            </AuthButton>
          )}
        </form.Subscribe>

        <View className="mt-[18px] flex-row justify-center">
          <Text className="text-[15px] text-brand-ink-soft">
            Hesabın var mı?{" "}
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.replace("/login")}
          >
            <Text className="text-[15px] font-bold text-brand-indigo">
              Giriş yap
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
