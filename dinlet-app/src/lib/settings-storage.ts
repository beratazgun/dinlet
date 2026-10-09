import * as SecureStore from "expo-secure-store";

export type TextSize = "m" | "l" | "xl";
export type ListenMode = "full" | "quick";

export interface UserSettings {
  notifyOnReady: boolean;
  autoNextSection: boolean;
  playbackSpeed: number;
  downloadOnlyOnWifi: boolean;
  /** Erişilebilirlik: metin görünümündeki yazı boyutu. */
  textSize: TextSize;
  /** Okunan kelime metinde işaretlenir. */
  wordHighlight: boolean;
  /** Disleksi için harf ayrımı belirgin yazı tipi (Atkinson Hyperlegible). */
  dyslexiaFont: boolean;
  /** Siyah zemin, parlak vurgu. */
  highContrast: boolean;
  /** Animasyonları kapatır (sistemdeki ayar da dikkate alınır). */
  reduceMotion: boolean;
  /** Dinleme modu: tam anlatım ya da hızlı tekrar (hazırsa). */
  listenMode: ListenMode;
  /** Bölüm sonunda sorular (düşünme aralığıyla) ve saklanan kancalar okunur. */
  quizAtSectionEnd: boolean;
  /** Bölüm sonundaki tekrar özeti çalınır. */
  recapAtSectionEnd: boolean;
}

const SETTINGS_KEY = "dinlet.userSettings";

const DEFAULT_SETTINGS: UserSettings = {
  notifyOnReady: true,
  autoNextSection: true,
  playbackSpeed: 1.25,
  downloadOnlyOnWifi: true,
  textSize: "m",
  wordHighlight: true,
  dyslexiaFont: false,
  highContrast: false,
  reduceMotion: false,
  listenMode: "full",
  quizAtSectionEnd: true,
  recapAtSectionEnd: true,
};

type SettingsListener = (settings: UserSettings) => void;
const listeners = new Set<SettingsListener>();

/** Ayar değişince haber verir; dönen fonksiyon aboneliği bitirir. */
export function subscribeUserSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener(cachedSettings);
}

let cachedSettings: UserSettings = { ...DEFAULT_SETTINGS };
let isLoaded = false;

export async function loadUserSettings(): Promise<UserSettings> {
  if (isLoaded) return cachedSettings;
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  isLoaded = true;
  notify();
  return cachedSettings;
}

export function getUserSettings(): UserSettings {
  return cachedSettings;
}

export async function saveUserSettings(
  patch: Partial<UserSettings>
): Promise<UserSettings> {
  cachedSettings = {
    ...cachedSettings,
    ...patch,
  };
  notify();
  try {
    await SecureStore.setItemAsync(
      SETTINGS_KEY,
      JSON.stringify(cachedSettings)
    );
  } catch {
    // ignore
  }
  return cachedSettings;
}
