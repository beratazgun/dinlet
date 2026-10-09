import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json'ın üstüne env'e bağlı ayarlar.
 *
 * Google Sign-In'in config plugin'i iOS için ters çevrilmiş iOS client
 * ID'sini URL şeması olarak ister ve verilmezse prebuild'i durdurur. Client ID
 * env'den geldiği için plugin yalnızca o tanımlıyken eklenir.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(
      '.apps.googleusercontent.com',
      ''
    )}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  return { ...config, name: config.name ?? 'Dinlet', slug: config.slug ?? 'dinlet', plugins };
};
