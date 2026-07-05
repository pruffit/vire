# Автоопределение жанра (auto-genre)

Воркер после транскодинга прогоняет трек через классификатор жанра (Essentia
discogs-effnet, ONNX) и предлагает артисту готовые жанры — критично для алгоритма
«Волна» (без жанров трек хуже участвует в рекомендациях) и как страховка против
артистов, которые не проставляют жанры вручную.

## Что делает

- После HLS-транскодинга и BPM/key-анализа воркер (за фичефлагом `AUTO_GENRE`)
  декодирует первые ~120 секунд трека, строит мел-спектрограмму и прогоняет её
  через ONNX-модель Essentia discogs-effnet, получая топ-400 предсказаний по
  таксономии Discogs.
- Предсказания маппятся в наш `genreEnum` (жанровая близость, см. код), суммируются
  по нашим жанрам и нормализуются → топ-5 сохраняется в `track_audio.genre_suggestions`
  (JSONB) **всегда**, если классификация прошла успешно — независимо от того,
  проставил ли артист жанры сам.
- **Автоприменение**: если у трека ещё нет ни одной строки в `track_genres` (артист
  ничего не выбирал), автоматически проставляются топ-2 предложения с
  confidence ≥ 0.1 (см. `decideAutoApplyGenres`). Если жанры уже есть — их никто
  не трогает.
- В дашборде (`GenrePicker`) под выбранными жанрами показывается строка
  «Предложено: …» — пилюли из `genre_suggestions`, которых ещё нет среди выбранных;
  клик добавляет жанр (уважая лимит 3). Артист в любой момент может изменить/убрать
  жанры вручную — автоприменение это не блокирует.
- Ошибка классификации (модель не скачана, битый файл, исключение инференса) НЕ
  блокирует переход трека в `READY` — только логируется.

## Как работает классификатор

1. **Декодирование**: `fluent-ffmpeg` → mono, 16 кГц, f32le, первые 120 сек
   (`apps/worker/src/lib/audio-analysis.ts` → `decodeMonoPcm`, переиспользуется
   и BPM/key-анализом на 22050 Гц).
2. **Мел-спектрограмма** (`apps/worker/src/lib/mel-spectrogram.ts`) — своя реализация
   на чистом TS (без WASM-зависимости essentia.js), воспроизводящая препроцессинг
   Essentia `TensorflowInputMusiCNN`: STFT (Hann, frameSize=512, hopSize=256) →
   степенной мел-фильтрбанк (96 полос, Slaney-шкала, unit-area нормализация,
   0–8000 Гц) → `log10(1 + 10000·energy)`. Параметры зафиксированы под обучающий
   сетап модели — менять нельзя, иначе предсказания станут мусором.
3. **Патчи и батчи**: кадры режутся на патчи по 128 фреймов (без перекрытия —
   упрощение относительно Essentia `patchHopSize=62`, для «подсказки» не критично)
   и группируются в батчи по 64 патча — не ради формы модели (она поддерживает
   динамический batch), а ради RAM-бюджета: длинный трек не выделяет один
   гигантский тензор целиком (VPS 1ГБ RAM).
4. **Инференс** (`apps/worker/src/lib/genre-classifier.ts`) — `onnxruntime-node`,
   сессия ONNX грузится один раз на процесс воркера (ленивый синглтон), инференс
   батчей последовательный. Sigmoid-предсказания усредняются по всем патчам трека.
5. **Маппинг** (`apps/worker/src/lib/discogs-genre-map.ts` + `discogs-genre-labels.ts`)
   — 400 меток Discogs (`Parent---Subgenre`) → наш `genreEnum` (65 значений).
   Точечные сабжанры бьются напрямую (`Electronic---Techno` → `TECHNO`), широкие
   категории без аналога либо сведены к ближайшему по духу значению (`WORLD` для
   Latin-стилей), либо осознанно отброшены (`Non-Music` кроме Spoken Word,
   `Children's`, `Brass & Military`, нишевые стили). Список меток и маппинг
   проверены в юнит-тестах.

### Важное отклонение от исходного плана: одна модель, не две

Изначально предполагалось две ONNX-модели — embedding (`discogs-effnet-bs64-1`)
и отдельная голова классификации (`genre_discogs400-discogs-effnet-1`). По факту
(проверено на essentia.upf.edu/models.html) голова `genre_discogs400` экспортирована
**только в TensorFlow (.pb)**, ONNX-версии у неё нет. При этом сама embedding-модель
в варианте с динамическим батчем (`discogs-effnet-bsdynamic-1.onnx`, ~18МБ) отдаёт
**тот же самый** топ-400 Discogs-жанров вторым выходом (`PartitionedCall:0`,
sigmoid) — она обучалась на этой же задаче. Поэтому используется **одна** эта
модель, отдельная голова не скачивается и не нужна.

## Где код

- **Декодирование PCM:** `apps/worker/src/lib/audio-analysis.ts` (`decodeMonoPcm`)
- **Мел-спектрограмма:** `apps/worker/src/lib/mel-spectrogram.ts`
- **Классификатор (ONNX-инференс):** `apps/worker/src/lib/genre-classifier.ts`
- **Метки модели (400, порядок = индекс модели):** `apps/worker/src/lib/discogs-genre-labels.ts`
- **Маппинг Discogs → наш enum + агрегация:** `apps/worker/src/lib/discogs-genre-map.ts`
- **Политика автоприменения:** `apps/worker/src/lib/genre-policy.ts` (`decideAutoApplyGenres`)
- **Интеграция в пайплайн:** `apps/worker/src/workers/transcode.worker.ts` (шаг после BPM/key-анализа)
- **Анализ по требованию:** `apps/worker/src/workers/analyze-genre.worker.ts`
  (consumer очереди `analyze-genre`), producer — `apps/web/lib/queue.ts`
  (`analyzeGenreQueue`), job-тип — `packages/core/src/jobs.ts` (`AnalyzeGenreJobData`)
- **Скачивание модели:** `apps/worker/scripts/download-models.mjs` (`pnpm --filter @vire/worker models:download`)
- **UI-подсказка + запуск анализа:** `apps/web/components/genre-picker.tsx` (дашборд),
  `apps/web/app/admin/tracks/[id]/edit/track-edit-form.tsx` (админка), общий хук —
  `apps/web/lib/use-genre-analysis.ts`
- **API анализа по требованию:**
  `apps/web/app/api/v1/dashboard/tracks/[id]/analyze-genre|genre-suggestions/route.ts`,
  `apps/web/app/api/v1/admin/tracks/[id]/analyze-genre|genre-suggestions/route.ts`
- **Данные:**
  - `packages/db/src/schema/releases.ts` — `track_audio.genre_suggestions` (JSONB,
    `[{ genre, confidence }]`, топ-5)
  - `packages/db/src/queries/track-audio.ts` — `getGenreSuggestionsForTracks`,
    `getGenreSuggestionsSnapshot` (+ `updatedAt`, для поллинга), `saveGenreSuggestions`
  - `packages/db/src/queries/track-genres.ts` — `getTrackGenres`/`setTrackGenres`
    (используются и автоприменением, и ручным UI)
  - Миграция: `packages/db/src/migrations/0029_pink_wraith.sql`

## Анализ по требованию

Треки, залитые до фичи или без флага `AUTO_GENRE`, остаются без предсказаний
навсегда — транскодинг уже прошёл и не перезапускается. Кнопка «Определить
жанр»/«Проанализировать» (дашборд артиста и админка) запускает тот же классификатор
отдельно от транскодинга, **не глядя на флаг `AUTO_GENRE`** — это явный запрос
пользователя, а не фоновый шаг пайплайна.

- **Очередь** `analyze-genre` (`QUEUE_ANALYZE_GENRE`, `packages/core/src/jobs.ts`):
  джоба `{ trackId }`, `deduplication.id = analyze-genre:{trackId}` — дедуп повторных
  кликов, пока предыдущая джоба ещё не завершена (ключ дедупликации снимается на
  completed/failed; фиксированный `jobId` для этого не подходит — джоба остаётся
  в completed/failed до срабатывания `removeOnComplete`/`removeOnFail`, и повторный
  `.add()` с тем же `jobId` молча вернул бы старую джобу вместо новой). Producer —
  `apps/web/lib/queue.ts` (`analyzeGenreQueue`), consumer —
  `apps/worker/src/workers/analyze-genre.worker.ts` (concurrency 1, зарегистрирован
  в `apps/worker/src/index.ts`).
- **Пайплайн джобы**: ключ исходника берётся из БД (`getTrackSourceKey` —
  `trackAudio.flacKey`, тот же vault-ключ `tracks/{id}/source.{ext}`, что и при
  транскодинге), скачивается во временный файл, прогоняется через
  `classifyTrackGenreOnDemand` (вариант `classifyTrackGenre` для явного запроса —
  `apps/worker/src/lib/genre-classifier.ts`), результат сохраняется
  (`saveGenreSuggestions`) и прогоняется через ту же `decideAutoApplyGenres`
  (жанры автопроставляются только если у трека их ещё нет). Временный файл
  чистится в `finally` независимо от исхода.
- **Отличие от best-effort `classifyTrackGenre`**: если модель не скачана —
  `classifyTrackGenreOnDemand` логирует ошибку и **бросает** (джоба падает штатно,
  видно в BullMQ/алертах), вместо тихого `null`. Явный запрос пользователя не должен
  молча остаться без результата.
- **API артиста**: `POST /api/v1/dashboard/tracks/[id]/analyze-genre` (auth + ownership
  через артиста-владельца релиза, 202 + enqueue), `GET .../genre-suggestions`
  (текущий снимок — `getGenreSuggestionsSnapshot`, поле `updatedAt` для поллинга).
- **API админки**: `POST /api/v1/admin/tracks/[id]/analyze-genre` + `GET
  .../genre-suggestions`, доступ MODERATOR/ADMIN/SUPERADMIN (без VIEWER — это
  мутирующее действие даже для GET-эндпоинта видимости, по паттерну соседних admin-роутов).
- **UI**: общий хук `apps/web/lib/use-genre-analysis.ts` — POST запускает анализ,
  дальше поллинг `GET .../genre-suggestions` каждые 4с до 2 минут. Готовность
  определяется по смене `updatedAt`, а не по появлению suggestions — при повторном
  анализе трек может получить те же топ-5 жанров (модель детерминирована на том же
  аудио), сравнение по значению ложно решило бы, что анализ не завершился. Таймаут/
  сетевая ошибка — тост (`components/toast`). В `GenrePicker` (дашборд) — кнопка
  «Определить жанр» когда suggestions пусты, иконка повторного анализа рядом со
  строкой «Предложено» когда есть. В админке (`app/admin/tracks/[id]/edit/track-edit-form.tsx`)
  — блок «Предложено моделью»: пилюли топ-5 с процентом уверенности, клик добавляет
  жанр в выбранные (лимит 3), кнопка «Проанализировать».

## Env

- `AUTO_GENRE` — `true`/`1` включает классификацию **при транскодинге**; по
  умолчанию выключено. Анализ по требованию (см. выше) этот флаг не проверяет.
- `AUTO_GENRE_MODELS_DIR` — куда скачана модель (`models:download`); по умолчанию
  `apps/worker/models` (относительно cwd воркера). Общий и для транскодинга, и для
  анализа по требованию.

## Ограничения / на будущее

- **Лицензия модели — CC BY-NC-ND 4.0 (MTG/UPF), некоммерческая.** Пригодна для
  Этапа 1 (Friends & Family, без прямых продаж). До старта Этапа 2 (прямые продажи,
  коммерческое использование) нужно либо получить коммерческую лицензию у MTG,
  либо перейти на платный API (например, Musiio) — использовать модель в проде
  с активными продажами без лицензии нельзя.
- Модель не в git (`apps/worker/models/` в `.gitignore`) — без
  `pnpm --filter @vire/worker models:download` и `AUTO_GENRE=true` шаг тихо
  пропускается (warn-лог), трек всё равно уходит в `READY`. Для анализа по
  требованию отсутствие модели — не warn, а падение джобы (см. выше).
- В прод-образ воркера модель **запекается на build-time**: `apps/worker/Dockerfile`
  качает её отдельным слоем (до `COPY . .`, кэшируется; `apps/worker/models` в
  `.dockerignore`, чтобы локальная копия не перетирала слой при ручной сборке).
  Локально — `models:download` руками, как раньше.
- **Осознанный трейдофф:** сборка воркера зависит от доступности
  `essentia.upf.edu` (митигация — retry ×3 + pinned SHA-256 в
  `download-models.mjs` и кэш GHA-слоя). Недоступность хоста валит build
  ГРОМКО (красный CI), а не тихо выкатывает образ без модели — это выбрано
  специально. Если начнёт мешать деплоям — зеркалировать модель в свой S3.
- Маппинг Discogs → наш enum — эвристика по жанровой близости, не наука; часть
  Discogs-стилей (Latin, большинство Non-Music, Children's, Brass & Military)
  осознанно не имеют аналога и отбрасываются.
- Патчи режутся без перекрытия (упрощение относительно эталонного
  `patchHopSize=62` у Essentia) — для «подсказки жанра» точность важнее
  бит-в-бит воспроизводимости обучающего пайплайна, но не идентична ему.
- Автоприменение — только когда у трека вообще нет жанров; если артист поставил
  хотя бы один — классификатор ничего не меняет и не перезаписывает.
