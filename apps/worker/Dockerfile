# syntax=docker/dockerfile:1
# Воркер запускается через tsx (devDependency), поэтому НЕ --prod.
# Этот же образ — «ops»: миграции и make-admin (есть tsx + @vire/db + исходники).
FROM node:22-alpine

# ffmpeg с кодеками — ключевое требование транскодинга
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# Весь монорепо (node_modules отрезаны .dockerignore).
COPY . .

# Подграф воркера (+ core/db/config) с devDeps — нужен tsx.
RUN pnpm install --frozen-lockfile --filter @vire/worker... --filter @vire/db...

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
