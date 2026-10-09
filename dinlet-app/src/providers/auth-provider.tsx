import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearAccessToken,
  getAccessToken,
  loadSessionStorage,
  saveAccessToken,
} from "@/lib/auth/session-storage";
import { signOutFromGoogle } from "@/lib/auth/social-sign-in";
import { setUnauthorizedHandler } from "@/lib/network-manager";
import { logoutApi, type LoginApiResponse } from "@/networks/api/auth/auth";

export type AuthStatus = "loading" | "signedIn" | "signedOut";

type AuthSession = NonNullable<LoginApiResponse["Data"]>;

interface AuthContextValue {
  status: AuthStatus;
  /** Login / kayıt onayı / sosyal giriş yanıtındaki oturumu başlatır. */
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Oturum durumu. Kayıtlı bir anahtar varsa açılışta oturum açık sayılır;
 * anahtar geçersizse ilk istek 401 alır ve durum `signedOut`'a döner.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");

  const endSession = useCallback(async () => {
    await clearAccessToken();
    await signOutFromGoogle();
    queryClient.clear();
    setStatus("signedOut");
  }, [queryClient]);

  useEffect(() => {
    loadSessionStorage()
      .then(() => setStatus(getAccessToken() ? "signedIn" : "signedOut"))
      .catch(() => setStatus("signedOut"));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void endSession());
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const signIn = useCallback(
    async (session: AuthSession) => {
      if (!session.accessToken) {
        throw new Error("Oturum anahtarı alınamadı.");
      }
      await saveAccessToken(session.accessToken);
      queryClient.clear();
      setStatus("signedIn");
    },
    [queryClient]
  );

  const signOut = useCallback(async () => {
    // Sunucudaki oturum kapanamasa da cihazdaki oturum kapanır.
    await logoutApi().catch(() => undefined);
    await endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({ status, signIn, signOut }),
    [status, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth, AuthProvider içinde kullanılmalı.");
  return context;
}
