# syntax=docker/dockerfile:1
# Воркер запускается через tsx (devDependency), поэтому НЕ --prod.
# Этот же образ — «ops»: миграции и make-admin (есть tsx + @vire/db + исходники).
# База glibc (slim, НЕ alpine): нативный бинарник onnxruntime-node слинкован под
# glibc и на musl не грузится (gcompat не хватает — нет __vsnprintf_chk).
FROM node:22-slim

# ffmpeg с кодеками — ключевое требование транскодинга
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# ONNX-модель автожанра: models/ в .gitignore и в контекст сборки не попадает —
# качаем отдельным слоем ДО COPY . ., чтобы кэшировался, пока скрипт не менялся.
COPY apps/worker/scripts/download-models.mjs apps/worker/scripts/download-models.mjs
RUN node apps/worker/scripts/download-models.mjs

# Весь монорепо (node_modules отрезаны .dockerignore).
COPY . .

# Подграф воркера (+ core/db/config) с devDeps — нужен tsx.
# onnxruntime-node постинсталлом качает CUDA-рантайм (~1ГБ) — на VPS без GPU не нужен.
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN pnpm install --frozen-lockfile --filter @vire/worker... --filter @vire/db...

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
