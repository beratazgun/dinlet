/**
 * S3 / LocalStack ses URL'sini istemci ortamına göre çözümler.
 * Geliştirme ortamında (fiziksel cihaz veya yerel ağdaki simülatör) `localhost:4566`
 * adresini `EXPO_PUBLIC_API_URL` içindeki ana makine IP adresine dönüştürür.
 */
export function resolveAudioUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "";
  try {
    const match = apiUrl.match(/^https?:\/\/([^/:]+)/);
    const host = match?.[1];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return url.replace(/:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, `://${host}$2`);
    }
  } catch {
    // url olduğu gibi bırakılır
  }
  return url;
}
