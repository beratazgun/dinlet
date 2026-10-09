# Dinlet

**Dinlet**, sınava hazırlanan öğrencilerin (KPSS, YKS, ALES) ders notlarını
bölümlere ayrılmış, anlatılan seslere çeviren bir uygulamadır. Bu klasör iOS ve
Android istemcisidir. Öğrenci PDF'ini yükler, notunu otobüste ya da
yürürken podcast gibi dinler, aralıklı tekrar ve sesli sorularla pekiştirir
ya da not mağazasından hazır içerik ekler.

Üç parçadan biridir ([ana README](../README.md)): **dinlet-backend** (NestJS API), **dinlet-worker**
(Python PDF ve ses worker'ı) ve bu uygulama.

## Özellikler

- **Yükleme ve işleme.** PDF seçilir; dönüştürmeden önce sayfa sayısı, kotaya
  etkisi ve okuma biçimi görülür, işleme Socket.IO ile canlı izlenir.
- **Oynatıcı.** Arka planda çalma, hız ve uyku zamanlayıcısı, dalga formlu
  ilerleme çubuğu, metin görünümü, "tam anlatım" veya "hızlı tekrar" modu,
  isteğe bağlı bölüm özeti, bölüm sonunda okunan sorular ve uygulama boyunca
  mini oynatıcı.
- **Çevrimdışı dinleme.** Notun sesleri cihaza indirilip internetsiz çalınır.
- **Çalışma araçları.** Klasör, etiket ve favoriler; ilerlemeli sınav geri
  sayımı; aralıklı tekrarlı günlük "Tekrar" sekmesi ve sesli soru oynatıcısı
  (soru, düşünme süresi, cevap, "bildim / bilemedim"); her not için kapsam
  kontrolü ve hafıza kancaları.
- **Not mağazası.** Sınav ve derse göre gezinme, arama, örnek bölüm dinleme,
  ücretsiz içerik ekleme, ücretli içerik ve paket satın alma, satın almaları
  geri yükleme. Kullanıcılar kendi notlarını ücretsiz paylaşabilir; editörler
  yayından önce inceler.
- **Kendi sesinle kayıt.** Tam ekran kayıt ekranında bölümü paragraf paragraf
  kaydetme, canlı ses seviyesi göstergesi, tek paragrafı dinleyip yeniden
  kaydetme ve her bölümde kendi sesin mi yapay zekâ sesi mi çalacağını seçme.
- **Hesap ve gizlilik.** E-posta, Google ve Apple ile giriş, ayrı KVKK
  rızaları, açık oturumları yönetme ve uygulama içinden hesap silme.
- **Erişilebilirlik.** Yazı boyutu, kelime vurgusu, disleksi için Atkinson
  Hyperlegible yazı tipi, yüksek kontrast ve hareketi azaltma; tüm ekranlarda
  ekran okuyucu etiketleri.

## Teknolojiler

| Alan          | Seçim                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Çatı          | Expo SDK 57, React Native 0.86 (New Architecture), React 19.2                |
| Gezinme       | Tipli rotalarla Expo Router                                                  |
| Stil          | Uniwind ile Tailwind CSS v4                                                  |
| Sunucu verisi | TanStack Query ve küçük, tipli bir modül kaydı (`tanstack-query-craft`)      |
| API istemcisi | Backend'in OpenAPI şemasından üretilir                                       |
| Ses           | Çalma ve kayıt için `expo-audio`, indirmeler için `expo-file-system`         |
| Formlar       | TanStack Form + Zod                                                          |
| Kimlik        | `expo-secure-store`'da cihaza bağlı Bearer oturum, Google ve Apple ile giriş |

## Üretilen API istemcisi

Ağ kodu API'nin OpenAPI belgesinden üretilir; istek ve yanıt tipleri hep
backend'le uyumludur:

```bash
pnpm api:sync     # openapi-typescript tipleri + her API etiketi için bir modül
```

`scripts/generate-api-modules.mjs`, tipli fonksiyonları ve sorgu/mutation
tanımlarını `src/networks/api/<modül>/<modül>.gen.ts` dosyasına yazar ve her
modülü tipli bir kayda ekler. Ekranlar
`useCraftQuery("store", "getItem", [{ id }])` gibi argümanı ve sonucu tamamen
tipli çağrılar yapar. Elle yazılan eklemeler (sonsuz listeler, dosya yükleme)
üretilen dosyanın yanında durur ve yeniden üretimde korunur.

## Klasör yapısı

```
app/                     Expo Router rotaları
  (auth)/                karşılama, giriş, kayıt
  (app)/(tabs)/          kütüphane, tekrar, mağaza, indirilenler, hesap
  (app)/documents/       not detayı
  (app)/store/           katalog, içerik, paket, paylaşım, paylaştıklarım
  (app)/record/          kendi sesinle kayıt ve gözden geçirme
  (app)/player.tsx       tam ekran oynatıcı
src/
  components/            özelliğe göre arayüz (oynatıcı, kütüphane, mağaza, yükleme…)
  context/               oynatıcı ve indirme sağlayıcıları
  hooks/                 ses yardımcıları (klip oynatıcı, örnek oynatıcı)
  lib/                   ağ katmanı, kimlik, indirmeler, sorgu kaydı
  networks/              üretilen API modülleri
  types/api/             üretilen OpenAPI tipleri
scripts/                 API modülü üreticisi
```

## Yerelde çalıştırma

Gerekenler: Node.js 24, pnpm, Xcode (iOS) veya Android Studio ve yerelde
çalışan dinlet-backend API'si.

```bash
pnpm install
cp .env.example .env     # EXPO_PUBLIC_API_URL; gerçek cihazda bilgisayarın yerel IP'si
pnpm ios                 # veya: pnpm android (development build'i derler)
pnpm start               # ilk native build'den sonra Metro
```

Uygulama yerel modüller (ses kaydı, Apple ve Google girişi) kullandığı için
Expo Go'da değil, development build'de çalışır. Uygulama içi satın alma henüz
bağlı değil; RevenueCat SDK'sı yalnızca `src/lib/purchases.ts` dosyasına
eklenecek.

```bash
pnpm typecheck
```

## Lisans

[MIT](LICENSE)
