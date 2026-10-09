# Dinlet Worker

**Dinlet**, sınav öğrencilerinin ders notlarını anlatılan seslere çeviren bir
mobil uygulamadır. Bu klasör, API'nin yapmaması gereken ağır işleri üstlenen
Python worker'dır: PDF okuma, Türkçe seslendirme ve ses birleştirme. GPU
istemez; API ile aynı küçük VPS'te CPU üzerinde çalışır.

Üç parçadan biridir ([ana README](../README.md)): **dinlet-backend** (NestJS API), **dinlet-app** (Expo
istemci) ve bu worker.

## Sistemdeki yeri

Worker veritabanına dokunmaz ve API'yi çağırmaz. Aynı Redis'teki BullMQ
kuyruklarını tüketir, dosyaları Cloudflare R2'de okuyup yazar ve küçük bir
sonuç döner. Durumları API kuyruk olaylarından günceller; iki taraftan biri
yeniden başlasa da iş kaybolmaz.

| Kuyruk · iş        | Girdi                                                   | Yaptığı                                                                                                                                                                              | Dönüş                                     |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `extract`          | `documentId, pdfKey, extractedKey, pageCount`           | PDF'i indirir, Docling ile Markdown'a çevirir (taranmış sayfada OCR, Docling hata verirse pdfplumber), R2'ye yazar                                                                   | `extractedKey, chars, ocrPages`           |
| `tts` · synthesize | `sectionId, title, paragraphs, recap, audioKey, clips?` | Türkçe metni normalize eder, ema-lightning ile seslendirir, duraklamaları ekler, MP3'e çevirir. `clips` varsa (tekrar özeti, soru ve cevaplar) tek seferde seslendirip ayrı kaydeder | `audioKey, durationMs, sizeBytes, clips?` |
| `tts` · mix        | `recordingId, audioKey, recapPosition, clips`           | Kullanıcının kendi sesiyle kaydettiği paragrafları tek MP3'e birleştirir: her klibi açar, aralar ekler, düşük frekans filtresi ve ses seviyesi eşitleme uygular                      | `audioKey, durationMs, sizeBytes, clips`  |

Sözleşme API'deki TypeScript tipleriyle birebir aynıdır
(`src/modules/document/queue/document-queue.types.ts` ve
`src/modules/recording/queue/recording-queue.types.ts`); iki taraf birlikte
değişir. Başarısız işleri BullMQ, API'nin verdiği ayarlarla yeniden dener.

## Öne çıkanlar

- **Türkçe metin normalizasyonu.** `normalize.py` ve `numbers_tr.py`, not
  metnini seslendirmeden önce okunabilir Türkçeye çevirir: sayılar ve sıra
  sayıları, ondalık ve yüzdeler, tarihler, yıllar, sayıdan sonraki ekler
  ("1453'te"), sınav terimleri sözlüğünden kısaltmalar, semboller ve madde
  işaretleri. `num2words` Türkçe sayıları bitişik yazdığı için sayı okunuşu
  burada yazıldı.
- **Aynı anda tek ağır iş.** `scheduler.py` işlemciyi tek bir ağır işe verir;
  metin çıkarma seslendirmeden önceliklidir. Ağır işler thread'de çalışır, olay
  döngüsü bu sırada BullMQ kilidini yenilemeye devam eder.
- **Tutarlı ses.** Bir bölüm hep aynı `seed` ile seslendirilir; yeniden deneme
  aynı sesi verir. Çıktı 24 kHz, mono, 48 kbps MP3'tür. Başlıktan sonra,
  paragraflar arasında ve özetten önceki duraklamalar ayarlanabilir.
- **Sağlam metin çıkarma.** Az metni olan sayfalar taranmış sayılıp OCR'a
  gönderilir; Docling başarısız olursa pdfplumber düz metin çıkarır.
- **Apple Silicon desteği.** torch'un oneDNN konvolüsyon çekirdeği arm64
  Docker'da SIGILL ile çöküyor; `TORCH_MKLDNN=auto` arm64'te kapatır, x86_64
  production'da açık bırakır.

## Klasör yapısı

```
main.py                 BullMQ worker'ları (extract, tts) ve düzgün kapanış
scheduler.py            ağır işler için tek yuva, metin çıkarma öncelikli
extract.py              Docling → Markdown, OCR, pdfplumber yedeği
normalize.py            sayı, tarih, kısaltma, sembol, madde işareti kuralları
numbers_tr.py           Türkçe sayı ve sıra sayısı okunuşu
abbreviations.tr.json   kısaltma sözlüğü (sınav terimleri)
synth.py                paragraf seslendirme, duraklamalar, MP3 (ffmpeg)
mix.py                  kendi sesinle kayıtları birleştirme (ffmpeg)
storage.py              R2 okuma/yazma (boto3)
bench.py                seslendirme ve metin çıkarma benchmark'ı
tests/                  normalizasyon, zamanlayıcı, tts ve mix testleri
```

## Geliştirme

Gerekenler: Python 3.12 ve [uv](https://docs.astral.sh/uv/). Modellerle
yerelde çalıştırmak için ffmpeg.

```sh
uv venv --python 3.12
uv pip install -r pyproject.toml --group dev      # testler için hafif kurulum
.venv/bin/python -m pytest
.venv/bin/ruff check .

# Modellerle birlikte (CPU torch, Docling, ema-lightning):
uv pip install -r pyproject.toml --extra ml \
  --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match
cp .env.example .env && python main.py
```

Docker ile, yandaki `dinlet-backend` klasöründen:

```sh
cp .env.example .env
docker compose -f ../dinlet-backend/docker-compose.yml up -d dinlet-tts
```

Kaynak kod container'a bağlıdır ama Python süreci kendini yenilemez; kod
değişince `docker restart dinlet-tts` gerekir.

Kapasite planı için benchmark:

```sh
python bench.py tts --minutes 10
python bench.py extract ornek.pdf
```

## Model ve kütüphane lisansları ve teşekkürler

Docling (MIT), [ema-lightning](https://huggingface.co/canberkkkkkk/ema-lightning) (Apache 2.0), pdfplumber (MIT).
Türkçe TTS modeli için [@canberkkkkkk](https://huggingface.co/canberkkkkkk)'e teşekkür ederiz. Model kartı, dinleyiciye sesin yapay zekâ ile üretildiğinin söylenmesini ister; uygulama bunu oynatıcıda gösterir.

## Lisans

[MIT](LICENSE)
