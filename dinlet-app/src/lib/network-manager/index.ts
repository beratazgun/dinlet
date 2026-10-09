import axios, { type AxiosInstance } from "axios";
import {
  getAccessToken,
  getDeviceId,
  loadSessionStorage,
} from "@/lib/auth/session-storage";

export interface NetworkManagerOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.VITE_PUBLIC_BACKEND_URL_V1 ||
  "http://localhost:3000/api/v1";

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Oturumlu bir istek 401 aldığında çağrılır (oturum süresi doldu, başka
 * cihazdan kapatıldı). Auth provider kendini buraya kaydeder.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

/**
 * React Native için optimize edilmiş Axios HTTP istemcisi üretir.
 *
 * Her istekte backend'in mobil oturum başlıkları eklenir: `X-Client: mobile`
 * (oturum anahtarının yanıtta dönmesi için), `X-Device-Id` (oturum cihaza
 * bağlıdır) ve varsa `Authorization: Bearer <accessToken>`.
 */
export function createNetworkManager(
  options: NetworkManagerOptions = {}
): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL ?? DEFAULT_BASE_URL,
    timeout: options.timeout ?? 30000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  instance.interceptors.request.use(async (config) => {
    await loadSessionStorage();

    config.headers.set("X-Client", "mobile");
    const deviceId = getDeviceId();
    if (deviceId) config.headers.set("X-Device-Id", deviceId);
    const accessToken = getAccessToken();
    if (accessToken) config.headers.set("Authorization", `Bearer ${accessToken}`);

    return config;
  });

  // Response interceptor: data unwrap desteği
  instance.interceptors.response.use(
    (response) => {
      // response.data döndürülür
      return response.data;
    },
    (error) => {
      const sentToken = Boolean(error?.config?.headers?.Authorization);
      if (error?.response?.status === 401 && sentToken) {
        unauthorizedHandler?.();
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Uygulamanın varsayılan networkManager instance'ı.
 */
export const networkManager: AxiosInstance = createNetworkManager();
