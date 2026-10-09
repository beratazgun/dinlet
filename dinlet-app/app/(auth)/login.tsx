import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCraftMutation } from "@tanstack-query-craft";
import {
  AuthButton,
  BackButton,
  FormError,
  LogoMark,
  SocialSignInButtons,
} from "@/components/auth";
import { useAppForm } from "@/context/form-context";
import {
  getApiErrorCode,
  getApiErrorMessage,
} from "@/lib/network-manager/api-error";
import { useAuth } from "@/providers/auth-provider";
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "E-posta adresini yaz.")
  .email("Geçerli bir e-posta adresi yaz.");

const passwordSchema = z.string().min(1, "Şifreni yaz.");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;

function validateEmail(value: string) {
  const result = emailSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

function validateLoginPassword(value: string) {
  const result = passwordSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const login = useCraftMutation("auth", "login");
  const forgotPassword = useCraftMutation("auth", "forgotPassword");

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const email = value.email.trim();
      try {
        const response = await login.mutateAsync({ email, password: value.password });
        await signIn(response.data);
      } catch (error) {
        // Onaylanmamış hesap: onay ekranına geçilir, oradan bağlantı yeniden
        // istenebilir.
        if (getApiErrorCode(error) === "EMAIL_NOT_VERIFIED") {
          router.push({ pathname: "/check-email", params: { email } });
          return;
        }
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  function handleForgotPassword() {
    const email = form.getFieldValue("email").trim();
    if (validateEmail(email)) {
      Alert.alert(
        "Şifremi unuttum",
        "Önce e-posta adresini yaz; sıfırlama bağlantısını oraya gönderelim."
      );
      return;
    }
    forgotPassword.mutate(
      { email },
      {
        onSuccess: () =>
          Alert.alert(
            "Bağlantı gönderildi",
            `${email} adresine kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderdik.`
          ),
        onError: (error) =>
          Alert.alert("Gönderilemedi", getApiErrorMessage(error)),
      }
    );
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
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} />

        <View className="mt-5 gap-2.5">
          <LogoMark size="md" />
          <Text
            accessibilityRole="header"
            className="mt-3.5 font-display text-[32px] leading-[35px] tracking-[-0.96px] text-brand-ink"
          >
            Tekrar hoş geldin
          </Text>
          <Text className="text-base text-brand-ink-soft">
            Kaldığın bölümden dinlemeye devam et.
          </Text>
        </View>

        <View className="mt-8">
          <SocialSignInButtons onError={setFormError} />
        </View>

        <View className="my-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-brand-hairline" />
          <Text className="text-[13px] font-medium text-brand-muted">
            veya e-posta ile
          </Text>
          <View className="h-px flex-1 bg-brand-hairline" />
        </View>

        <View className="gap-3.5">
          <form.AppField name="email" validators={{ onChange: ({ value }) => validateEmail(value) }}>
            {(field) => (
              <field.AuthTextField
                label="E-posta"
                placeholder="ornek@eposta.com"
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
            validators={{ onChange: ({ value }) => validateLoginPassword(value) }}
          >
            {(field) => (
              <field.AuthTextField
                label="Şifre"
                password
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void form.handleSubmit()}
              />
            )}
          </form.AppField>
          <Pressable
            accessibilityRole="link"
            onPress={handleForgotPassword}
            disabled={forgotPassword.isPending}
            hitSlop={8}
            className="self-end py-1.5"
          >
            <Text className="text-sm font-semibold text-brand-indigo">
              Şifremi unuttum
            </Text>
          </Pressable>
        </View>

        {formError ? (
          <View className="mt-4">
            <FormError>{formError}</FormError>
          </View>
        ) : null}

        <View className="min-h-6 flex-1" />

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <AuthButton loading={isSubmitting} onPress={() => void form.handleSubmit()}>
              Giriş yap
            </AuthButton>
          )}
        </form.Subscribe>

        <View className="mt-[18px] flex-row justify-center">
          <Text className="text-[15px] text-brand-ink-soft">Hesabın yok mu? </Text>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.replace("/register")}>
            <Text className="text-[15px] font-bold text-brand-indigo">Kayıt ol</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
