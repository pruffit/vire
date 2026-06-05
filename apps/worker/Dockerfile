FROM node:22-alpine AS base

# ffmpeg с нужными кодеками — ключевое требование воркера
RUN apk add --no-cache ffmpeg

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# Копируем манифесты для установки зависимостей
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile --prod

# Копируем исходники
COPY packages/config ./packages/config
COPY packages/core/src ./packages/core/src
COPY packages/db/src ./packages/db/src
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/

WORKDIR /app/apps/worker

CMD ["pnpm", "start"]
