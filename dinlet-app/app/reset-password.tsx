import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CircleCheck } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation } from "@tanstack-query-craft";
import { AuthButton, BackButton, FormError, LogoMark } from "@/components/auth";
import { useAppForm } from "@/context/form-context";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { useAuth } from "@/providers/auth-provider";
import { z } from "zod";

const newPasswordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(64, "Şifre en fazla 64 karakter olabilir.");

const passwordConfirmationSchema = (targetPassword: string) =>
  z
    .string()
    .min(1, "Şifreni tekrar yaz.")
    .refine((val) => val === targetPassword, {
      message: "Şifreler eşleşmiyor.",
    });

export const resetPasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Şifreni tekrar yaz."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function validateNewPassword(value: string) {
  const result = newPasswordSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

function validatePasswordConfirmation(value: string, password: string) {
  const result = passwordConfirmationSchema(password).safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Şifre sıfırlama e-postasındaki bağlantı (`dinletapp://reset-password?token=…`)
 * buraya açılır. Yeni şifre kayıttaki kuralla aynıdır (8–64 karakter).
 * Sıfırlama oturum açmaz; kullanıcı yeni şifresiyle giriş yapar.
 */
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { status } = useAuth();
  const [formError, setFormError] = useState<string | null>(
    token ? null : "Sıfırlama bağlantısı eksik. E-postadaki bağlantıya yeniden dokun."
  );
  const [done, setDone] = useState(false);
  const resetPassword = useCraftMutation("auth", "resetPassword");

  const form = useAppForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      if (!token) return;
      setFormError(null);
      try {
        await resetPassword.mutateAsync({ token, ...value });
        setDone(true);
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  function leave() {
    if (status === "signedIn") router.replace("/");
    else router.replace("/login");
  }

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
        <BackButton onPress={leave} />

        {done ? (
          <>
            <View className="flex-1 items-center justify-center gap-3.5">
              <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-brand-lavender">
                <CircleCheck size={32} color="#1928B4" />
              </View>
              <Text
                accessibilityRole="header"
                className="text-center font-display text-[28px] leading-[31px] tracking-[-0.84px] text-brand-ink"
              >
                Şifren güncellendi
              </Text>
              <Text className="max-w-[320px] text-center text-[15px] leading-[23px] text-brand-ink-soft">
                Güvenliğin için açık oturumların kapatıldı. Yeni şifrenle giriş
                yapabilirsin.
              </Text>
            </View>
            <AuthButton onPress={leave}>
              {status === "signedIn" ? "Uygulamaya dön" : "Giriş yap"}
            </AuthButton>
          </>
        ) : (
          <>
            <View className="mt-5 gap-2.5">
              <LogoMark size="md" />
              <Text
                accessibilityRole="header"
                className="mt-3.5 font-display text-[32px] leading-[35px] tracking-[-0.96px] text-brand-ink"
              >
                Yeni şifre belirle
              </Text>
              <Text className="text-base text-brand-ink-soft">
                En az 8 karakterlik yeni bir şifre seç.
              </Text>
            </View>

            <View className="mt-8 gap-3.5">
              <form.AppField
                name="newPassword"
                validators={{ onChange: ({ value }) => validateNewPassword(value) }}
              >
                {(field) => (
                  <field.AuthTextField
                    label="Yeni şifre"
                    placeholder="En az 8 karakter"
                    password
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                  />
                )}
              </form.AppField>
              <form.AppField
                name="confirmPassword"
                validators={{
                  onChangeListenTo: ["newPassword"],
                  onChange: ({ value, fieldApi }) =>
                    validatePasswordConfirmation(
                      value,
                      fieldApi.form.getFieldValue("newPassword")
                    ),
                }}
              >
                {(field) => (
                  <field.AuthTextField
                    label="Yeni şifre (tekrar)"
                    password
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={() => void form.handleSubmit()}
                  />
                )}
              </form.AppField>
            </View>

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
                  disabled={!token}
                  onPress={() => void form.handleSubmit()}
                >
                  Şifreyi güncelle
                </AuthButton>
              )}
            </form.Subscribe>
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
