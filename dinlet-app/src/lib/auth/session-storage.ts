import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "dinlet.accessToken";
const DEVICE_ID_KEY = "dinlet.deviceId";

/**
 * Oturum anahtarı ve cihaz kimliği, Keychain / Keystore'da.
 *
 * Backend mobil oturumu cihaza bağlar: `accessToken` imzalı oturum kimliğidir
 * ve yalnızca aynı `X-Device-Id` ile gelen isteklerde geçerlidir. Cihaz
 * kimliği bu yüzden bir kez üretilir ve uygulama silinene kadar değişmez.
 *
 * Değerler bellekte de tutulur; her istekte Keychain'e gidilmez.
 */
let accessToken: string | null = null;
let deviceId: string | null = null;
let loaded: Promise<void> | null = null;

async function load(): Promise<void> {
  const [storedToken, storedDeviceId] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(DEVICE_ID_KEY),
  ]);

  accessToken = storedToken;
  deviceId = storedDeviceId;

  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
}

/** İlk çağrıda depodan okur; sonrakiler aynı sözü bekler. */
export function loadSessionStorage(): Promise<void> {
  loaded ??= load();
  return loaded;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getDeviceId(): string | null {
  return deviceId;
}

export async function saveAccessToken(token: string): Promise<void> {
  accessToken = token;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  accessToken = null;
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
