// First, and it has to be first: this is what loads the Tailwind pipeline and
// the theme tokens every class name below resolves through.
import '../global.css';

import { useEffect, useState } from 'react';
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useCraftQuery } from '@tanstack-query-craft';
import { PanelUIProvider, useThemeMode } from 'panelui-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { DownloadProvider, PlayerProvider } from '@/context';
import '@/networks';

// Fonts and the stored session load before the first screen is drawn, so the
// app never flashes the system font or the welcome screen at a signed-in user.
void SplashScreen.preventAutoHideAsync();

/**
 * React Navigation paints its own theme background over every screen and
 * defaults to an opaque light grey, which sits on top of the themed background
 * underneath — so without this the page never follows the theme.
 *
 * Building the navigation theme from the live tokens fixes it for every theme
 * at once: `useCSSVariable` subscribes to theme changes, so this re-runs on
 * each switch, including the named themes that the OS knows nothing about.
 */
function ThemedNavigation() {
  const { mode } = useThemeMode();
  const { status } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    // Erişilebilirlik: "Okuması kolay yazı tipi".
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  /*
   * Apple / Google ile açılan hesaplar kayıt formundaki KVKK onaylarını
   * görmez; metin sürümü değişince eski onaylar da geçersiz olur. Zorunlu
   * onaylardan biri eksikse kütüphane yerine onay adımı açılır. Durum
   * bilinmezken (istek sürerken, ağ hatasında) uygulama açık kalır; sunucu
   * zorunlu onayı yine kayıt sırasında ister.
   */
  const me = useCraftQuery('auth', 'getMe', [], { enabled: status === 'signedIn' });
  const consents = me.data?.data?.consents;
  const consentsMissing = !!consents && !(consents.privacyNotice && consents.termsOfUse);

  // İlk açılışta yazı tipleri, kayıtlı oturum ve (oturum varsa) onay durumu
  // gelene kadar açılış ekranı kalır. Sonrasında yığın hiç sökülmez.
  const [booted, setBooted] = useState(false);
  const ready =
    (fontsLoaded || !!fontError) &&
    status !== 'loading' &&
    (status !== 'signedIn' || me.isFetched);

  useEffect(() => {
    if (ready && !booted) {
      setBooted(true);
      void SplashScreen.hideAsync();
    }
  }, [ready, booted]);
  const [background, card, text, border, primary] = useCSSVariable([
    '--color-background',
    '--color-card',
    '--color-foreground',
    '--color-border',
    '--color-primary',
  ]) as (string | undefined)[];

  /*
   * The window itself, which is behind everything React draws and is not
   * something a class name can reach. It matters because this theme is
   * PanelUI's rather than the device's: someone can be in a dark PanelUI theme
   * on a phone set to light, and then every strip the app is not painting —
   * behind the status bar, under the navigation bar, the gap a screen
   * transition opens — stays the light window colour. Telling the window the
   * token is what closes that gap.
   */
  useEffect(() => {
    if (background) void SystemUI.setBackgroundColorAsync(background);
  }, [background]);

  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      ...(background ? { background } : null),
      ...(card ? { card } : null),
      ...(text ? { text } : null),
      ...(border ? { border } : null),
      ...(primary ? { primary, notification: primary } : null),
    },
  };

  if (!booted) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedIn' && !consentsMissing}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && consentsMissing}>
          <Stack.Screen name="consents" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* E-postadaki bağlantılar ve KVKK metinleri oturum olsun olmasın
            açılır, bu yüzden korumaların dışında. */}
        <Stack.Screen name="verify-email" options={{ gestureEnabled: false }} />
        <Stack.Screen name="reset-password" options={{ gestureEnabled: false }} />
        <Stack.Screen name="legal/[document]" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Not style="auto": that reads the OS appearance, which is left
          unspecified for the named themes. */}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        {/* Owns the portal host that dialogs, sheets, menus and toasts render
            into. Overlays mount into it, so it has to be above every screen. */}
        <AuthProvider>
          <PanelUIProvider>
            <DownloadProvider>
              <PlayerProvider>
                <ThemedNavigation />
              </PlayerProvider>
            </DownloadProvider>
          </PanelUIProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
