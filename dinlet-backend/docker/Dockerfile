# syntax=docker/dockerfile:1

# ---- Builder ----
FROM node:24-alpine AS builder

# argon2 / esbuild gibi native paketler için derleme araçları
RUN apk add --no-cache python3 make g++ && corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# generated/ (Prisma contract) repoda commit'li; hermetik build için emit atlanır.
RUN pnpm run build

# Dev bağımlılıklarını at → sadece production node_modules kalır (argon2 derlenmiş
# halde). Prisma CLI production bağımlılığıdır: migration açılışta uygulanır.
RUN pnpm prune --prod

# ---- Runner ----
FROM node:24-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Runtime, package.json "imports" alanını `--conditions=compiled` ile dist yollarına
# çözdüğü için package.json da kopyalanmalı. Env, container'a değişken olarak verilir.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json
# `prisma db migrate` için yapılandırma ve migration paketleri.
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/src/infra/database/migrations ./src/infra/database/migrations
COPY --from=builder --chown=node:node /app/src/infra/database/generated ./src/infra/database/generated
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000

# Açılışta bekleyen migration'lar uygulanır (RUN_MIGRATIONS=false ile kapatılır),
# ardından uygulama başlar.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "--conditions=compiled", "dist/src/main.js"]
