import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform, TurboModuleRegistry } from "react-native";
import type {
  LoginWithAppleApiResponse,
  LoginWithGoogleApiResponse,
} from "@/networks/api/auth/auth";

/**
 * Yerel Apple / Google girişleri. Her ikisi de backend'in doğrulayacağı bir
 * kimlik token'ı döndürür; kullanıcı vazgeçerse `null` döner.
 */

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export class SocialSignInError extends Error {}

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

let googleModule: GoogleSignInModule | null = null;
let googleConfigured = false;

/**
 * Google Sign-In'in native modülü yalnızca development / store build'de
 * vardır; Expo Go'da yoktur ve paket içe aktarıldığı anda hata fırlatır. Bu
 * yüzden modül ilk kullanımda ve yalnızca native taraf kayıtlıysa yüklenir.
 */
function loadGoogle(): GoogleSignInModule {
  if (googleModule) return googleModule;
  if (!TurboModuleRegistry.get("RNGoogleSignin")) {
    throw new SocialSignInError(
      "Google ile giriş Expo Go'da çalışmaz; development build ile dene."
    );
  }
  googleModule = require("@react-native-google-signin/google-signin") as GoogleSignInModule;
  return googleModule;
}

function configureGoogle(): GoogleSignInModule {
  const google = loadGoogle();
  if (googleConfigured) return google;
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new SocialSignInError("Google ile giriş henüz yapılandırılmadı.");
  }
  google.GoogleSignin.configure({
    // idToken'ın audience'ı web client ID'dir; backend onu doğrular.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
  return google;
}

export async function signInWithGoogle(): Promise<
  LoginWithGoogleApiResponse["Body"] | null
> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } =
    configureGoogle();

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;

    const { idToken } = response.data;
    if (!idToken) {
      throw new SocialSignInError("Google kimlik bilgisi alınamadı.");
    }
    return { idToken };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SocialSignInError(
          "Google Play Hizmetleri bu cihazda kullanılamıyor."
        );
      }
    }
    throw error;
  }
}

export async function signOutFromGoogle(): Promise<void> {
  if (!googleConfigured || !googleModule) return;
  await googleModule.GoogleSignin.signOut().catch(() => undefined);
}

/** Sign in with Apple yalnızca iOS'ta sunulur. */
export function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return Promise.resolve(false);
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<
  LoginWithAppleApiResponse["Body"] | null
> {
  // Apple'a nonce'un SHA-256'sı verilir, backend'e ham hali; backend token'daki
  // değerle karşılaştırır ve token'ın bu istek için üretildiğini doğrular.
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new SocialSignInError("Apple kimlik bilgisi alınamadı.");
    }
    return {
      identityToken: credential.identityToken,
      nonce,
      // Apple adı yalnızca ilk girişte verir.
      name: credential.fullName?.givenName ?? null,
      surname: credential.fullName?.familyName ?? null,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      return null;
    }
    throw error;
  }
}
