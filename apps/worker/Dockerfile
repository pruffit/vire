# syntax=docker/dockerfile:1
# Воркер запускается через tsx (devDependency), поэтому НЕ --prod.
# Этот же образ — «ops»: миграции и make-admin (есть tsx + @vire/db + исходники).
FROM node:22-alpine

# ffmpeg с кодеками — ключевое требование транскодинга
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# ONNX-модель автожанра: models/ в .gitignore и в контекст сборки не попадает —
# качаем отдельным слоем ДО COPY . ., чтобы кэшировался, пока скрипт не менялся.
COPY apps/worker/scripts/download-models.mjs apps/worker/scripts/download-models.mjs
RUN node apps/worker/scripts/download-models.mjs

# Весь монорепо (node_modules отрезаны .dockerignore).
COPY . .

# Подграф воркера (+ core/db/config) с devDeps — нужен tsx.
RUN pnpm install --frozen-lockfile --filter @vire/worker... --filter @vire/db...

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
