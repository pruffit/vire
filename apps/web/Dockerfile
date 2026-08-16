# syntax=docker/dockerfile:1
# ВАЖНО: образ собирается НЕ на проде (1 ГБ RAM не потянет next build),
# а локально/в CI → пушится/переносится на сервер готовым.

# ===== Сборка =====
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
WORKDIR /app

# Весь монорепо в контекст (node_modules/.next отрезаны .dockerignore).
COPY . .

# Ставим только подграф web (+ core/db/ui/config), с devDeps — нужны для сборки.
RUN pnpm install --frozen-lockfile --filter @vire/web...

# @vire/ui импортирует dist/tokens.css из @vire/design-tokens — генерируется build-скриптом
# пакета, не собирается автоматически: `pnpm --filter @vire/web build` ниже не идёт через
# turbo-граф ^build.
RUN pnpm --filter @vire/design-tokens build

# DATABASE_URL нужен при сборке: db-клиент инициализируется на уровне модуля.
# S3_PUBLIC_ENDPOINT нужен: next/image бакает remotePatterns в next.config.ts при сборке.
# Dummy-значения безопасны — реальные запросы идут только в рантайме.
ARG S3_PUBLIC_ENDPOINT=http://localhost:9000
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=
ARG NEXT_PUBLIC_METRIKA_ID=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
RUN DATABASE_URL=postgresql://build:build@localhost/build \
    S3_PUBLIC_ENDPOINT=${S3_PUBLIC_ENDPOINT} \
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=${NEXT_PUBLIC_TELEGRAM_BOT_USERNAME} \
    NEXT_PUBLIC_METRIKA_ID=${NEXT_PUBLIC_METRIKA_ID} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY} \
    pnpm --filter @vire/web build

# Барьер: libvips грузится через dlopen по RPATH, трейсер его не видит и молча собирает
# образ без него (так слёг прод v1.34.0 — ERR_DLOPEN_FAILED на каждой странице артиста).
RUN test -n "$(find apps/web/.next/standalone -name 'libvips-cpp.so.*' -print -quit)" \
    || (echo 'FATAL: libvips не попал в standalone — sharp упадёт в рантайме' && exit 1)

# ===== Рантайм =====
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone тащит server.js + протрейсенные node_modules воркспейса.
# outputFileTracingRoot=корень монорепо → структура apps/web/... сохраняется.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Кэш оптимизатора картинок (.next/cache/images) персистится в проде через том
# (docker-compose.prod.yml). Создаём папку заранее с владельцем nextjs: иначе
# Docker примонтирует пустой том как root, и nextjs не сможет в него писать —
# каждый запрос обложки превращался бы в холодную AVIF-кодировку (LCP 9с).
RUN mkdir -p apps/web/.next/cache/images && chown -R nextjs:nodejs apps/web/.next/cache

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
