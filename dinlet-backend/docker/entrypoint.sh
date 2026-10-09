#!/bin/sh
# API container girişi: önce bekleyen migration'ları uygular, sonra komutu
# (varsayılan: uygulama) çalıştırır. Prisma 8 migration'ı uygulama kodundan
# uygulamadığı için bu adım uygulama başlamadan önce burada yapılır.
# Migration başarısız olursa container başlamaz; eski sürüm çalışmaya devam eder.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] migration uygulanıyor..."
  node_modules/.bin/prisma db migrate --no-interactive
fi

exec "$@"
