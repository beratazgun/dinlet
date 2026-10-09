import { ConsentType } from "#database/enums.js";

/**
 * Uygulamada gösterilen KVKK ve kullanım metinleri.
 *
 * Metin değişince `utils/consents.ts`'teki sürüm de artırılır; kullanıcıdan
 * yeniden onay istenir. Veri sorumlusunun kimliği env'den gelir
 * (`LEGAL_CONTROLLER_*`).
 *
 * TASLAKTIR: Yayına almadan önce bir hukukçu tarafından gözden geçirilmeli;
 * özellikle yurt dışına aktarımın hukuki dayanağı (KVKK md. 9) ve saklama
 * süreleri işletmenin fiili durumuna göre kesinleştirilmelidir.
 */

export const LEGAL_DOCUMENT_SLUGS = [
  "privacy-notice",
  "terms-of-use",
  "cross-border-transfer",
] as const;

export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number];

export const LEGAL_DOCUMENT_CONSENT: Record<LegalDocumentSlug, ConsentType> = {
  "privacy-notice": ConsentType.PRIVACY_NOTICE,
  "terms-of-use": ConsentType.TERMS_OF_USE,
  "cross-border-transfer": ConsentType.CROSS_BORDER_TRANSFER,
};

export interface LegalController {
  name: string;
  address: string;
  email: string;
}

export interface LegalSection {
  heading: string;
  /** Paragraflar; `• ` ile başlayanlar madde olarak gösterilir. */
  body: string[];
}

export interface LegalDocumentContent {
  title: string;
  sections: LegalSection[];
}

function privacyNotice(c: LegalController): LegalDocumentContent {
  return {
    title: "Aydınlatma Metni",
    sections: [
      {
        heading: "Veri sorumlusu",
        body: [
          `Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla ${c.name} ("Dinlet") tarafından hazırlanmıştır. Adres: ${c.address}. İletişim: ${c.email}.`,
        ],
      },
      {
        heading: "İşlenen kişisel veriler",
        body: [
          "• Kimlik ve iletişim: ad, soyad, e-posta adresi.",
          "• Hesap güvenliği: şifrenin geri döndürülemez özeti, oturum ve cihaz kimliği, IP adresi, tarayıcı/uygulama bilgisi, giriş kayıtları.",
          "• Yüklediğin içerik: PDF notların, bunlardan çıkarılan metin, bölüm anlatımları ve üretilen ses dosyaları.",
          "• Kullanım: dinleme ilerlemesi, aylık sayfa kullanımı, işlem kayıtları.",
          "• Abonelik: plan, abonelik durumu ve mağaza bilgisi. Kart bilgilerin Dinlet'e ulaşmaz; ödemeyi App Store veya Google Play alır.",
          "• Bildirim: bildirim göndermek için cihazının bildirim anahtarı.",
          "• Apple veya Google ile girişte bu hizmetlerin paylaştığı ad ve e-posta.",
        ],
      },
      {
        heading: "İşleme amaçları ve hukuki sebepler",
        body: [
          "• Hesabını açmak, oturumunu yönetmek, notlarını dinlenebilir anlatıma ve sese çevirmek, aboneliğini ve kotanı yürütmek: sözleşmenin kurulması ve ifası (KVKK md. 5/2-c).",
          "• Hesap güvenliği, kötüye kullanımın önlenmesi, hata ve performans takibi, yedekleme: meşru menfaat (md. 5/2-f).",
          "• Onay kayıtlarının ve yasal yükümlülüklerin gerektirdiği kayıtların saklanması: hukuki yükümlülük (md. 5/2-ç) ve bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e).",
          "• Notlarının anlatıma çevrilmek üzere yurt dışındaki yapay zekâ servislerine aktarılması: açık rızan (md. 9). Rıza vermezsen notların bu servislere gönderilmez; metin yapay zekâ kullanılmadan, olduğu gibi seslendirilir.",
        ],
      },
      {
        heading: "Aktarılan taraflar",
        body: [
          "Veriler yalnızca hizmeti sunmak için gereken ölçüde şu hizmet sağlayıcılarla paylaşılır:",
          "• Sunucu ve barındırma hizmeti (uygulama sunucusu ve veritabanı).",
          "• Cloudflare: dosya depolama (PDF ve ses), içerik dağıtımı ve ağ güvenliği.",
          "• E-posta gönderim hizmeti: hesap onayı, şifre sıfırlama ve bilgilendirme e-postaları.",
          "• RevenueCat, Apple ve Google: abonelik doğrulama ve mağaza ödemeleri.",
          "• Expo, Apple ve Google: anlık bildirimler; Apple ve Google ile giriş.",
          "• Yapay zekâ servisleri (yalnızca açık rızanla): Google (Gemini), Mistral AI ve Anthropic (Claude).",
          "Bu sağlayıcıların bir kısmı yurt dışında bulunur. Yapay zekâ servisleri dışındaki aktarımlar KVKK md. 9'da öngörülen güvencelerle yapılır.",
          "Kanunen yetkili kamu kurum ve kuruluşlarına, talep halinde ve mevzuatın gerektirdiği ölçüde aktarım yapılabilir.",
        ],
      },
      {
        heading: "Toplama yöntemi",
        body: [
          "Veriler uygulamadaki formlar, yüklediğin dosyalar, Apple ve Google ile giriş ve uygulamanın kullanımı sırasında elektronik ortamda toplanır.",
        ],
      },
      {
        heading: "Saklama süresi",
        body: [
          "Hesap verilerin hesabın açık olduğu sürece saklanır. Bir notu sildiğinde PDF, metin ve ses dosyaları en geç 7 gün içinde kalıcı olarak silinir. Hesabını sildiğinde hesap hemen kapanır, tüm içeriğin en geç 7 gün içinde kalıcı olarak silinir.",
          "Onay kayıtları ve yasal yükümlülük gereği tutulması gereken kayıtlar ilgili mevzuattaki süreler boyunca saklanır; güvenlik kayıtları 90 gün sonra silinir. Yedekler 30 gün içinde döngüyle silinir.",
        ],
      },
      {
        heading: "Hakların",
        body: [
          "KVKK md. 11 uyarınca; verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi isteme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhine bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğradıysan zararın giderilmesini talep etme haklarına sahipsin.",
          `Başvurularını ${c.email} adresine iletebilirsin. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır. Hesabını ve verilerini uygulamadaki "Hesabı sil" adımıyla da silebilirsin.`,
        ],
      },
    ],
  };
}

function termsOfUse(c: LegalController): LegalDocumentContent {
  return {
    title: "Kullanım Koşulları",
    sections: [
      {
        heading: "Hizmet",
        body: [
          `Dinlet, ${c.name} tarafından sunulan; yüklediğin PDF notlarını bölümlere ayırıp dinlenebilir bir anlatıma ve sese çeviren bir mobil uygulamadır. Uygulamayı kullanarak bu koşulları kabul etmiş olursun.`,
        ],
      },
      {
        heading: "Hesap",
        body: [
          "• Hesap açarken doğru bilgi vermeli, şifreni ve cihazını korumalısın. Hesabındaki işlemlerden sen sorumlusun.",
          "• Hesabını dilediğin zaman uygulamadan silebilirsin.",
        ],
      },
      {
        heading: "Yüklediğin içerik",
        body: [
          "• Yüklediğin içeriklere hakkın olduğunu (içeriğin sahibi olduğunu veya kişisel çalışma amacıyla kullanma iznin bulunduğunu) beyan edersin. Başkasının telif hakkını, kişisel verilerini veya gizli bilgilerini ihlal eden içerik yükleyemezsin.",
          "• İçeriğin sana aittir. Dinlet içeriğini yalnızca senin için anlatıma ve sese çevirmek amacıyla işler; başkalarıyla paylaşmaz ve kendi içeriği gibi kullanmaz.",
          "• Üretilen anlatım ve ses yalnızca kişisel kullanımın içindir; yeniden yayımlanamaz veya satılamaz.",
          "• Hak ihlali bildirimi aldığımız içerikleri inceleyip kaldırabiliriz.",
        ],
      },
      {
        heading: "Yapay zekâ ile üretilen içerik",
        body: [
          "Sesler yapay zekâ ile sentezlenir. Yurt dışına aktarım rızası verdiysen anlatım metni de yapay zekâ ile düzenlenir. Üretilen içerik hatalı, eksik veya kaynak metinden farklı olabilir; önemli bilgileri asıl kaynağından doğrulamalısın. Dinlet bir eğitim kurumu değildir ve sınav başarısı vaat etmez.",
        ],
      },
      {
        heading: "Plan, kota ve abonelik",
        body: [
          "• Ücretsiz planda her ay sınırlı sayıda sayfa dinlenebilir. Kota ve plan ayrıntıları uygulamada gösterilir.",
          "• Pro abonelik App Store veya Google Play üzerinden satın alınır; ücretlendirme, yenileme, iptal ve iade bu mağazaların koşullarına tabidir. Aboneliği mağaza hesabından iptal edebilirsin; dönem sonuna kadar Pro olarak kalırsın.",
        ],
      },
      {
        heading: "Kullanım kuralları",
        body: [
          "Hizmeti kötüye kullanamaz, otomatik araçlarla aşırı yük oluşturamaz, güvenlik önlemlerini aşmaya çalışamaz, hukuka aykırı içerik yükleyemezsin. Bu kurallara aykırılıkta hesabın askıya alınabilir veya kapatılabilir.",
        ],
      },
      {
        heading: "Sorumluluk",
        body: [
          "Hizmet olduğu gibi sunulur; kesintisiz veya hatasız çalışacağı garanti edilmez. Kanunun izin verdiği ölçüde Dinlet, dolaylı zararlardan sorumlu değildir. Tüketici olarak kanundan doğan hakların saklıdır.",
        ],
      },
      {
        heading: "Değişiklikler ve uygulanacak hukuk",
        body: [
          "Bu koşullar güncellenebilir; önemli değişikliklerde uygulama içinde yeniden onayın istenir. Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır; uyuşmazlıklarda tüketici hakem heyetleri ve tüketici mahkemeleri yetkilidir.",
          `İletişim: ${c.email}`,
        ],
      },
    ],
  };
}

function crossBorderTransfer(c: LegalController): LegalDocumentContent {
  return {
    title: "Yurt Dışına Aktarım Açık Rızası",
    sections: [
      {
        heading: "Neye rıza veriyorsun?",
        body: [
          `Yüklediğin notların metni, dinlenebilir bir anlatıma dönüştürülmek üzere ${c.name} tarafından yurt dışında bulunan yapay zekâ servislerine aktarılır: Google (Gemini), Mistral AI ve Anthropic (Claude). Hangi servisin kullanılacağı o anki kullanılabilirliğe göre seçilir.`,
          "Aktarılan veri yalnızca notunun ilgili bölümünün metnidir. Notunda kişisel veri (ör. ad, numara) varsa bunlar da aktarılabilir; bu yüzden başkalarına ait kişisel veri içeren notları yüklememeni öneririz.",
        ],
      },
      {
        heading: "Rıza vermezsen",
        body: [
          "Rıza isteğe bağlıdır; vermemen hesabını veya uygulamayı kullanmanı engellemez. Notların yurt dışındaki yapay zekâ servislerine gönderilmez; metin yapay zekâ ile düzenlenmeden, olduğu gibi seslendirilir.",
        ],
      },
      {
        heading: "Rızanı geri çekme",
        body: [
          "Rızanı dilediğin zaman uygulamadan geri çekebilirsin. Geri çekme, sonraki işlemlerden itibaren geçerli olur; daha önce üretilmiş anlatımları etkilemez.",
          `Ayrıntılar için Aydınlatma Metni'ne bakabilir, ${c.email} adresine yazabilirsin.`,
        ],
      },
    ],
  };
}

export const LEGAL_DOCUMENTS: Record<
  LegalDocumentSlug,
  (controller: LegalController) => LegalDocumentContent
> = {
  "privacy-notice": privacyNotice,
  "terms-of-use": termsOfUse,
  "cross-border-transfer": crossBorderTransfer,
};
