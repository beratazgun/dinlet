import { useEffect, useState } from "react";
import { View } from "react-native";
import { useCraftMutation } from "@tanstack-query-craft";
import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  SocialSignInError,
} from "@/lib/auth/social-sign-in";
import { getApiErrorMessage } from "@/lib/network-manager/api-error";
import { useAuth } from "@/providers/auth-provider";
import { AuthButton } from "./auth-button";
import { AppleLogo, GoogleLogo } from "./brand-icons";

type Provider = "apple" | "google";

export interface SocialSignInButtonsProps {
  onError: (message: string | null) => void;
}

/**
 * "Apple ile devam et" (yalnızca iOS) ve "Google ile devam et". Hesap yoksa
 * backend açar, doğrulanmış e-postayla eşleşen hesap varsa bağlar; iki
 * durumda da oturum açılır.
 */
export function SocialSignInButtons({ onError }: SocialSignInButtonsProps) {
  const { signIn } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<Provider | null>(null);
  const appleLogin = useCraftMutation("auth", "loginWithApple");
  const googleLogin = useCraftMutation("auth", "loginWithGoogle");

  useEffect(() => {
    isAppleSignInAvailable()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  async function run(provider: Provider) {
    onError(null);
    setPending(provider);
    try {
      const response =
        provider === "apple"
          ? await signInWithApple().then((body) =>
              body ? appleLogin.mutateAsync(body) : null
            )
          : await signInWithGoogle().then((body) =>
              body ? googleLogin.mutateAsync(body) : null
            );
      // Kullanıcı vazgeçti.
      if (!response) return;
      await signIn(response.data);
    } catch (error) {
      onError(
        error instanceof SocialSignInError
          ? error.message
          : getApiErrorMessage(error)
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <View className="gap-3">
      {appleAvailable ? (
        <AuthButton
          variant="dark"
          icon={<AppleLogo size={19} />}
          loading={pending === "apple"}
          disabled={pending !== null}
          onPress={() => void run("apple")}
        >
          Apple ile devam et
        </AuthButton>
      ) : null}
      <AuthButton
        variant="outline"
        icon={<GoogleLogo size={19} />}
        loading={pending === "google"}
        disabled={pending !== null}
        onPress={() => void run("google")}
      >
        Google ile devam et
      </AuthButton>
    </View>
  );
}
