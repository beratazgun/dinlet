export function maskSensitiveData(text: string): string {
  if (!text) return text;

  // 1. Telefon Numaraları (TR Formatları)
  // Desteklenen formatlar:
  // - Cep: 05xx, +905xx, 905xx, 5xx (ardışık veya boşluk/nokta/tire ile ayrılmış)
  // - Sabit: 0212, 0312, 0216 vb. (3 haneli alan kodu)
  // Örn: 0.2.1.2.4.2.3.1.1.2.3 -> 021 ******* 23
  // Örn: 0 532 123 45 67 -> 053 ******* 67

  const phoneRegex =
    /(\+?\s*9\s*0\s*|\b0\s*)?([2-5]\s*\d\s*)(\d[\s.]*){7,8}\d{1,2}\b/g;

  text = text.replace(phoneRegex, (match) => {
    // Tüm boşluk, nokta, tire karakterlerini temizle
    const cleaned = match.replace(/[\s.\-()]/g, '');

    // Başlangıç kısmını belirle (alan kodu veya operatör kodu)
    let prefix = '';
    let startIndex = 0;

    if (cleaned.startsWith('+90')) {
      prefix = cleaned.substring(0, 3);
      startIndex = 3;
    } else if (cleaned.startsWith('90')) {
      prefix = cleaned.substring(0, 2);
      startIndex = 2;
    } else if (cleaned.startsWith('0')) {
      prefix = cleaned.substring(0, 3); // İlk 3 haneyi göster (0 + alan kodu)
      startIndex = 3;
    } else {
      prefix = cleaned.substring(0, 1);
      startIndex = 1;
    }

    // Son 2 haneyi göster
    const suffix = cleaned.substring(cleaned.length - 2);

    // Maskeleme
    return prefix + ' ******* ' + suffix;
  });

  // 2. E-Posta Adresleri (Geliştirilmiş)
  // Alt alan adları ve özel karakterleri de destekler
  // Örn: ahmet.yilmaz@firma.com.tr -> a****@firma.com.tr
  const emailRegex =
    /\b([a-zA-Z0-9])[a-zA-Z0-9._-]*(@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/gi;

  text = text.replace(emailRegex, (match, firstChar, domain) => {
    return firstChar + '****' + domain;
  });

  // 3. TCKN (11 haneli sayılar)
  // Boşluk veya nokta ile ayrılmış olabilir
  // Örn: 123 456 789 01 -> 123 ****** 01
  const tcknRegex = /\b(\d[\s.]?){10}\d\b/g;

  text = text.replace(tcknRegex, (match) => {
    const cleaned = match.replace(/[\s.]/g, '');
    if (cleaned.length === 11) {
      return cleaned.substring(0, 3) + ' ****** ' + cleaned.substring(9);
    }
    return match;
  });

  // 4. Kredi Kartı Numaraları (Opsiyonel - eklemek isterseniz)
  // Örn: 1234 5678 9012 3456 -> **** **** **** 3456
  const creditCardRegex = /\b(\d{4}[\s-]?){3}\d{4}\b/g;

  text = text.replace(creditCardRegex, (match) => {
    const cleaned = match.replace(/[\s-]/g, '');
    if (cleaned.length === 16) {
      return '**** **** **** ' + cleaned.substring(12);
    }
    return match;
  });

  // 5. IBAN Numaraları (TR için)
  // Örn: TR33 0006 1005 1978 6457 8413 26 -> TR33 **** **** **** **** **** 26
  const ibanRegex = /\bTR\s*\d{2}[\s]?(\d{4}[\s]?){5}\d{2}\b/gi;

  text = text.replace(ibanRegex, (match) => {
    const cleaned = match.replace(/\s/g, '');
    return (
      cleaned.substring(0, 4) +
      ' **** **** **** **** **** ' +
      cleaned.substring(cleaned.length - 2)
    );
  });

  return text;
}
