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

# DATABASE_URL нужен при сборке: db-клиент инициализируется на уровне модуля.
# Dummy-значение безопасно — реальные запросы идут только в рантайме.
RUN DATABASE_URL=postgresql://build:build@localhost/build pnpm --filter @vire/web build

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

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
