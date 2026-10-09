import { useEffect, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import {
  getUserSettings,
  loadUserSettings,
  saveUserSettings,
  subscribeUserSettings,
  type UserSettings,
} from "@/lib/settings-storage";

/**
 * Kullanıcı ayarları, değişince yeniden çizer. Bir ekranda değiştirilen
 * ayar (ör. erişilebilirlik) açık olan diğer ekranlara da hemen yansır.
 */
export function useUserSettings() {
  const settings = useSyncExternalStore(subscribeUserSettings, getUserSettings);

  useEffect(() => {
    void loadUserSettings();
  }, []);

  return {
    settings,
    update: (patch: Partial<UserSettings>) => saveUserSettings(patch),
  };
}

/** Uygulama ayarı veya sistemin "hareketi azalt" ayarı açıksa `true`. */
export function useReduceMotion(): boolean {
  const { settings } = useUserSettings();
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setSystemReduceMotion
    );
    return () => subscription.remove();
  }, []);

  return settings.reduceMotion || systemReduceMotion;
}
