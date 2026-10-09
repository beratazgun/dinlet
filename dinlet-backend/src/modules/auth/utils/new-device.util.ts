/**
 * Yeni cihaz tespiti için cihaz kimliği. Tarayıcı/OS sürüm numaraları
 * atılır ki her otomatik güncelleme "yeni cihaz" uyarısı üretmesin; IP
 * kullanılmaz çünkü mobil ağlarda sürekli değişir.
 *
 * User-agent yoksa cihaz tanımlanamaz (`null`) ve uyarı üretilmez.
 */
export function deviceKeyOf(
  userAgent: string | null | undefined,
): string | null {
  const normalized = userAgent?.trim();
  if (!normalized) return null;
  return normalized
    .replace(/\/[\d.]+/g, "/")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Uyarı yalnızca daha önce en az bir cihazı bilinen hesapta, listede olmayan
 * bir cihazdan giriş yapılınca verilir; ilk giriş "yeni cihaz" sayılmaz.
 */
export function shouldAlertNewDevice(result: {
  isNewDevice: boolean;
  knownDeviceCountBefore: number;
}): boolean {
  return result.isNewDevice && result.knownDeviceCountBefore > 0;
}
