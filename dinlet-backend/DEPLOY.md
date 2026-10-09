# Dinlet — Production kurulumu (Dokploy)

Tek VPS (Hostinger KVM 2: 2 vCPU, 8 GB RAM) üzerinde Dokploy + Cloudflare
(proxy, R2, CDN). Doküman §11'in uygulaması. Production'da docker-compose
kullanılmaz; her bileşen ayrı bir Dokploy servisidir.

| Dokploy servisi   | Tür                        | Kaynak                          | Not                                                    |
| ----------------- | -------------------------- | ------------------------------- | ------------------------------------------------------ |
| `dinlet-postgres` | Database → PostgreSQL 18   | Dokploy                         | Yedekler Dokploy → Backups (R2)                        |
| `dinlet-redis`    | Database → Redis 7         | Dokploy                         | Şifreli; AOF ve `noeviction` (aşağıya bakın)           |
| `dinlet-api`      | Application → Docker image | `ghcr.io/<owner>/dinlet-api`    | Açılışta migration, sonra API; domain `api.<alan-adı>` |
| `dinlet-tts`      | Application → Docker image | `ghcr.io/<owner>/dinlet-worker` | CPU 1.5, bellek 3 GB; `/models` volume                 |

Veritabanları dışarı açılmaz; servisler Dokploy'un iç ağında, Dokploy'un
verdiği "Internal Connection" adresleriyle konuşur. Dışarıya yalnızca
Traefik (80/443) açıktır.

## 1. Sunucu

```sh
# SSH yalnızca anahtarla
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# 80/443 yalnızca Cloudflare IP'lerinden (istemci IP'si cf-connecting-ip
# başlığından okunur; Cloudflare'i atlayan istek bu başlığı sahteleyemesin).
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp   # Dokploy paneli — kurulumdan sonra kendi IP'nizle sınırlayın
for ip in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do
  sudo ufw allow proto tcp from "$ip" to any port 80,443
done
sudo ufw enable
```

> Docker yayımlanan portlar için ufw'yi atlar. Traefik'in 80/443'ünü de
> Cloudflare'e kısıtlamak için aynı kuralları Docker'ın `DOCKER-USER`
> zincirine ekleyin veya [ufw-docker](https://github.com/chaifeng/ufw-docker)
> kullanın.

## 2. Veritabanları

**PostgreSQL** (Create Service → Database → PostgreSQL 18): veritabanı adı
`dinlet`, güçlü parola. Dış port açmayın. "Internal Connection URL"
`DATABASE_URL` olarak API'ye girilir.

**Redis** (Create Service → Database → Redis 7): güçlü parola. BullMQ
job'larının silinmemesi ve kalıcılık için Redis ayarlarında (Advanced →
Command / Args) şunlar olmalı:

```
redis-server --requirepass <parola> --appendonly yes --maxmemory 512mb --maxmemory-policy noeviction
```

**Yedekler:** Dokploy → Settings → S3 Destinations'a R2'yi ekleyin
(endpoint `https://<account-id>.r2.cloudflarestorage.com`, bucket, `backups/`
öneki). Postgres → Backups'ta günlük yedek (ör. `0 3 * * *`) tanımlayın.
R2'de `backups/` öneki için 30 günlük lifecycle kuralı saklamayı sınırlar.

## 3. Uygulamalar

Önce Dokploy → Settings → Registry'ye `ghcr.io` + okuma yetkili bir token
ekleyin (imajlar özelse).

**dinlet-api** (Create Service → Application → Docker):

- Image: `ghcr.io/<owner>/dinlet-api:latest`
- Environment: `deploy/api.env.example`'ı doldurup yapıştırın.
- Domains: `api.<alan-adı>`, container port `3000`, HTTPS (Let's Encrypt).
- Health check: `GET /api/v1/health`.
- Container açılırken önce bekleyen migration'lar uygulanır
  (`docker/entrypoint.sh`); migration başarısız olursa yeni sürüm başlamaz,
  çalışan sürüm devam eder. Tek API instance'ı varsayılır; ölçeklenirse
  `RUN_MIGRATIONS=false` yapılıp migration tek bir instance'a bırakılır.

**dinlet-tts** (Create Service → Application → Docker):

- Image: `ghcr.io/<owner>/dinlet-worker:latest`
- Environment: `deploy/worker.env.example`.
- Resources: CPU limiti `1.5`, bellek `3 GB` (API'nin yanıt süresi ağır
  işlerden etkilenmesin — doküman §6).
- Volume: `/models` (Hugging Face ve EasyOCR ağırlıkları; her deploy'da
  yeniden inmesin).
- Domain ve port yok.

**İlk kurulumda bir kez seed** (dinlet-api → Terminal):

```sh
npm run db:seed:prod
```

Roller, izinler, e-posta şablonları, zamanlanmış işler ve `SEED_ADMIN_EMAIL`
ile süper yönetici oluşur. Çalışma imajında `pnpm` yoktur; `npm run` kullanılır (production'da demo kullanıcı yoktur). Seed tekrar
çalıştırılabilir; rol izinlerini seed'deki tanıma eşitler.

`db:update` production'da **asla** kullanılmaz; şema yalnızca migration ile
değişir.

## 4. Cloudflare

| Kayıt              | Hedef                   | Ayar                                            |
| ------------------ | ----------------------- | ----------------------------------------------- |
| `api.<alan-adı>`   | VPS IP (proxy açık)     | SSL/TLS: **Full (strict)**                      |
| `audio.<alan-adı>` | R2 bucket özel alan adı | Uzun önbellek; bucket public listing **kapalı** |

R2 bucket:

- **Lifecycle:** `tmp/` öneki 1 gün (tamamlanmamış yüklemeler), `backups/` 30 gün.
- **CORS:** mobil uygulama imzalı URL'e `PUT` yapar; `PUT` ile
  `Content-Type`, `Content-Length` başlıklarına izin verin.

RevenueCat: webhook URL `https://api.<alan-adı>/api/v1/webhooks/revenuecat`,
Authorization değeri `REVENUECAT_WEBHOOK_AUTH` ile birebir aynı. Mobil SDK
`appUserID = users.id` ile başlatılmalı.

## 5. Sürekli dağıtım

`.github/workflows/ci.yml`: typecheck/lint/test → e2e → (main) API imajı
GHCR'a → `DOKPLOY_DEPLOY_WEBHOOK` (dinlet-api → Deployments → Webhook URL).
Worker'ın kendi CI'ı imajı (`linux/amd64`) GHCR'a gönderir; dinlet-tts'in
webhook'u o repoda `DOKPLOY_DEPLOY_WEBHOOK` sırrıyla tetiklenebilir.

Belirli bir sürüme dönmek için uygulamanın imaj etiketini commit SHA'sına
çekip yeniden deploy edin.

## 6. İzleme ve operasyon

- **Sağlık:** `GET /api/v1/health` — dış uptime servisinden dakikada bir.
- **Kuyruk paneli:** `https://api.<alan-adı>/admin/queues` (yalnızca
  Yönetici / Süper Yönetici oturumu; diğerlerine 404).
- **Zamanlanmış işler** (`jobs` tablosu, `/api/v1/jobs`):
  - `DOCUMENT_PIPELINE_RECONCILE` (5 dk): kaçan kuyruk olaylarını onarır.
    **Redis kaybolursa** takılı notlar bu iş tarafından en geç `staleMinutes`
    içinde yeniden kuyruğa alınır.
  - `DATA_PURGE` (03:30): silinen not ve hesapların R2 dosyalarını ve
    kayıtlarını `graceDays` (≤ 7) sonra kalıcı siler.
  - `QUEUE_HEALTH_ALERT` (10 dk): DLQ'ya düşen iş veya `tts`'te 2 saatten
    uzun bekleme → `ALERT_EMAIL`.
  - `AUDIT_LOG_CLEANUP` (04:00).
- **Geri yükleme testi (ayda bir):** Dokploy → Postgres → Backups'tan bir
  yedeği geçici bir Postgres'e geri yükleyip `select count(*) from users`
  ile doğrulayın.

## 7. Ölçekleme

1. Kuyruk uzarsa: yalnızca `dinlet-tts` çalıştıran ikinci sunucu (Dokploy'a
   ikinci sunucu olarak eklenir); aynı Redis'e özel ağ üzerinden bağlanır.
2. GPU sunucusu: ema-lightning GPU'da yüzlerce kat hızlı.
3. API yükü: oturum ve Socket.IO Redis'te olduğu için API birden fazla
   instance'a bölünebilir (migration'ı tek instance'a bırakarak).
