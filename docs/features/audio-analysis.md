# Анализ BPM и тональности

Воркер после транскодинга определяет темп (BPM) и тональность (Camelot-нотация,
напр. `Am`) трека — используется в трек-листе, редакторах трека и алгоритме
«Волна» (BPM/key входят в профиль вкуса и сигналы похожести). Артист/модератор
может запустить анализ заново по требованию — по образцу «Определить жанр»
(`docs/features/auto-genre.md`), той же механикой поллинга.

## Что делает

- При транскодинге (`apps/worker/src/workers/transcode.worker.ts`) воркер декодирует
  первые ~180 сек трека (22050 Гц моно) и вычисляет BPM (энергия-онсеты +
  автокорреляция, с октавной коррекцией) и тональность, сохраняя их в
  `track_audio.bpm`/`track_audio.musical_key`.
- Результат редактируется вручную в дашборде (`TrackManager`) и админке
  (`TrackEditForm`) — поля BPM/Тональность обычные инпуты.
- Кнопка «Переанализировать BPM/тональность» рядом с этими полями запускает тот же
  анализ отдельной джобой (очередь `analyze-audio`), не трогая транскодинг — полезно
  для треков, залитых до фичи, или когда автоопределение промахнулось (смена темпа
  в середине трека, тихий мастеринг и т.п.). Успешный анализ сразу обновляет поля
  в форме и показывает тост «BPM и тональность обновлены».

## Как работает анализ

- **Декодирование**: `apps/worker/src/lib/audio-analysis.ts` (`decodeMonoPcm`) —
  общий декодер и для BPM/key (22050 Гц), и для классификатора жанра (16 кГц).
- **BPM**: энергия по окнам 512 сэмплов → автокорреляция → пик темпа, с октавной
  коррекцией на удвоенный/половинный темп (`detectBPM`).
- **Тональность**: аналогично в `audio-analysis.ts` (Camelot-нотация).
- Ошибка анализа не блокирует переход трека в `READY` — только логируется
  (best-effort при транскодинге).

## Анализ по требованию

- **Очередь** `analyze-audio` (`QUEUE_ANALYZE`, `packages/core/src/jobs.ts`): джоба
  `{ trackId, flacKey }`, `deduplication.id = analyze:{trackId}` — дедуп повторных
  кликов, пока предыдущая джоба не завершена (тот же паттерн, что у
  `analyzeGenreQueue` — фиксированный `jobId` не подходит: он остаётся занят и в
  completed/failed до срабатывания `removeOnComplete`/`removeOnFail`, повторный
  `.add()` с ним молча вернул бы старую джобу вместо новой). Producer —
  `apps/web/lib/queue.ts` (`analyzeQueue`), consumer —
  `apps/worker/src/workers/analyze.worker.ts` (уже существовал — используется и
  фоновым бэкфиллом (`/api/v1/admin/backfill-analysis`), и явным запросом из UI).
- **API артиста**: `POST /api/v1/dashboard/tracks/[id]/analyze` (auth + ownership
  через артиста-владельца релиза; 409, если у трека нет исходника в vault —
  `getTrackSourceKey`; 202 + enqueue), `GET .../audio-features` (текущий снимок
  `{ bpm, musicalKey, updatedAt }` — `getAudioFeaturesSnapshot`, для поллинга;
  `updatedAt` — из `track_audio.bpm_key_analyzed_at`, см. «Раздельные таймстемпы
  готовности» ниже).
- **API админки**: `POST /api/v1/admin/tracks/[id]/analyze` + `GET .../audio-features`,
  доступ MODERATOR/ADMIN/SUPERADMIN (без VIEWER — мутирующее действие даже для
  GET-эндпоинта, по паттерну соседних admin-роутов auto-genre).
- **UI**: обобщённый хук `apps/web/lib/use-track-analysis.ts` (`useTrackAnalysis`) —
  POST запускает джобу, дальше поллинг снимка каждые 4с до 2 минут; готовность
  определяется по смене `updatedAt`, а не по значению bpm/key (повторный анализ
  того же аудио детерминированным алгоритмом может дать тот же результат —
  сравнение по значению ложно решило бы, что анализ не завершился). Это тот же
  движок, на котором держится `use-genre-analysis.ts` (тонкая обёртка над ним) —
  общая механика поллинга/гонок анмаунта вынесена один раз, отличия только в
  эндпоинтах, форме снимка и текстах ошибок.
  - В `TrackManager` (дашборд) — иконка повторного анализа рядом с полями
    BPM/Тональность в развёрнутой карточке трека; результат обновляет и локальный
    инпут, и стейт списка треков (без лишнего PATCH — воркер уже записал значения
    в БД, синхронизация только локальная).
  - В `TrackEditForm` (админка) — текстовая кнопка под полями BPM/Тональность,
    дизейблится и во время анализа, и во время pending-сабмита самой формы (как
    остальные контролы формы во время сохранения).

## Раздельные таймстемпы готовности

`track_audio` — одна строка на трек, и анализ BPM/тональности, и анализ жанра
(`docs/features/auto-genre.md`) пишут в неё. Раньше оба поллинга (`use-track-analysis`
для BPM/key и его обёртка `use-genre-analysis` для жанра) определяли «готово» по
смене общего `track_audio.updated_at` — а его бампают **обе** джобы. Нажать обе
кнопки подряд («Переанализировать BPM/тональность» и «Определить жанр») — и финиш
любой из них триггерит «готово» у обоих поллингов: ложный тост о готовности второго
анализа + его настоящий результат теряется (поллинг уже остановлен).

Фикс — две отдельные nullable-колонки, каждая бампается только своей джобой:
- `bpm_key_analyzed_at` — пишет `updateTrackAnalysis`/джоба `analyze-audio`
  (`analyze.worker.ts`).
- `genre_analyzed_at` — пишет `saveGenreSuggestions`/джоба `analyze-genre`
  (`analyze-genre.worker.ts`).

`getAudioFeaturesSnapshot`/`getGenreSuggestionsSnapshot` отдают `updatedAt` из
своей колонки, а не из общего `updated_at` (тот продолжает бампаться обеими джобами
как и раньше — для остальных потребителей trackAudio ничего не меняется). Контракт
хуков не меняется: baseline у старых строк — `null`, завершение — смена значения.

## Где код

- **Декодирование + BPM/key:** `apps/worker/src/lib/audio-analysis.ts`
- **Джоба анализа (фон + по требованию):** `apps/worker/src/workers/analyze.worker.ts`
  (consumer очереди `analyze-audio`), producer — `apps/web/lib/queue.ts` (`analyzeQueue`),
  job-тип — `packages/core/src/jobs.ts` (`AnalyzeJobData`)
- **Интеграция в пайплайн транскодинга:** `apps/worker/src/workers/transcode.worker.ts`
- **API анализа по требованию:**
  `apps/web/app/api/v1/dashboard/tracks/[id]/analyze|audio-features/route.ts`,
  `apps/web/app/api/v1/admin/tracks/[id]/analyze|audio-features/route.ts`
- **UI:** `apps/web/lib/use-track-analysis.ts` (общий движок поллинга),
  `apps/web/lib/use-genre-analysis.ts` (обёртка для жанра поверх того же движка),
  `apps/web/app/dashboard/releases/[id]/track-manager.tsx`,
  `apps/web/app/admin/tracks/[id]/edit/track-edit-form.tsx`
- **Данные:**
  - `packages/db/src/schema/releases.ts` — `track_audio.bpm`, `track_audio.musical_key`
  - `packages/db/src/queries/track-audio.ts` — `updateTrackAnalysis`,
    `getAudioFeaturesSnapshot` (+ `updatedAt`, для поллинга),
    `listTracksNeedingAnalysis` (фоновый бэкфилл)
  - Массовый бэкфилл: `apps/web/app/api/v1/admin/backfill-analysis/route.ts`

## Env

- Не требуется — использует общий `REDIS_URL`/S3-переменные транскодинга.

## Ограничения / на будущее

- BPM/key-детектор — эвристика (энергия-онсеты + автокорреляция), не эталонный
  алгоритм — на сложных ритмических паттернах (переменный темп, полиритмия) может
  ошибаться; ручная правка полей всегда остаётся доступна.
- Анализ по требованию не проверяет, отличается ли новый результат от текущего —
  запускается безусловно по клику, дедуп только против одновременных повторных
  кликов (см. `deduplication.id` выше).
- Треки без исходника в vault (`flacKey` отсутствует) анализировать нечем — кнопка
  вернёт 409; это тот же случай, когда невозможен и ре-транскод.
- BPM/key и ONNX-инференс жанра — синхронный CPU-bound JS: event loop воркера
  блокируется и BullMQ-лок не продлевается. Поэтому у transcode/analyze/analyze-genre
  `lockDuration` поднят до 10 минут (на VPS с 1 ГБ RAM анализ длинного трека идёт
  минуты; при дефолтных 30с джоба теряла лок и перезапускалась параллельно самой себе).
