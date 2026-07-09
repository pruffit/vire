# План: единое отображение фитов/версий + фикс автоскролла LRC

Spec: `docs/superpowers/specs/2026-07-10-track-display-and-lyrics-scroll.md`.
Две независимые задачи — параллельные сабагенты (Sonnet).

## Задача A — автоскролл лирики (`apps/web/components/lyrics-scroll.tsx`)

1. На скролл-контейнер (`containerRef`, строка ~45) добавить `relative` — он становится
   offsetParent для строк, `offsetTop` считается от него (это и есть фикс).
2. Вынести доскролл в функцию `recenter(behavior: ScrollBehavior)` (та же математика
   центрирования); эффект по `[active]` зовёт `recenter('smooth')`.
3. Добавить эффект с `ResizeObserver` на контейнер: при изменении его размера
   `recenter('instant')` (закрывает раскрытие motion-блока height 0→auto в
   `components/player/lyrics.tsx` и ресайз вьюпорта). Не забыть disconnect в cleanup;
   не дёргать, если активной строки нет.
4. Обновить `docs/features/lyrics.md`: заметка про инвариант «скролл-контейнер лирики
   обязан быть `relative`» и почему.

## Задача B — фиты/версии на всех поверхностях

### B1. Общий UI-примитив
`apps/web/components/track-title.tsx` — `TrackTitleText({ title, version?, feat? })`:
рендерит `title`, затем при наличии ` <span class="font-normal opacity-55">feat. A, B</span>`
и ` <span class="font-normal opacity-55">— Version</span>` (opacity — тема-агностично,
работает и в артист-теме, и в нейтральной). Не блочный, встраивается в существующие
truncate-спаны. `feat: string[]` — уже готовые имена.

### B2. Данные (`feat` считаем на границе web через `featuredNames` из `lib/track-display.ts`)
- `store/player.ts` `PlayerTrack`: + `version?: string | null`, `feat?: string[]`
  (persist-совместимо, поля опциональны).
- `lib/player/to-player-track.ts`: пробросить оба поля.
- `packages/db` queries: добрать `tracks.version`, `tracks.credits` в:
  `search.ts` (SearchTrack), `discovery.ts` (PlayableChartTrack, DiscoveryTrack),
  запросы плейлистов, артист-топ (ArtistPlayableTrack), запрос треков релиза для
  `/api/v1/releases/[id]` (шторка). Наружу из web-слоя отдавать `version` + `feat`.
- `packages/api-contracts` `wave.ts` WaveTrackDTO: + `version: string|null`, `feat: string[]`
  (+ источник данных в wave-запросе/роуте).
- Все места, где собирается очередь `toPlayerTracks(...)` — передавать version/feat
  (release track-list, страница трека, плейлисты, поиск, чарты, wave, quick-look).

### B3. Поверхности (рендер через TrackTitleText)
| Поверхность | Файл | Правка |
|---|---|---|
| Список треков релиза | `app/(listener)/artists/[slug]/releases/[releaseId]/track-list.tsx` | убрать `displayTrackTitle` из строки, рендер TrackTitleText; queue: + version/feat |
| Hero страницы трека | `.../tracks/[trackId]/page.tsx` | h1 — чистый title; под h1 приглушённая строка `feat. … · Version`; metadata/JSON-LD оставить на `displayTrackTitle` |
| Шторка релиза | `components/release-quick-look.tsx` (+ его API-роут) | строки трек-листа через TrackTitleText |
| Мини-плеер / фуллскрин | `components/player/mini-bar.tsx`, `fullscreen.tsx` (TitleLink в shared) | TitleLink рендерит TrackTitleText из PlayerTrack |
| Панель очереди | `components/player/queue-panel.tsx` | TrackTitleText |
| Общий TrackRow | `components/track-row.tsx` | `TrackRowTrack` + `version?/feat?`, титул через TrackTitleText → поиск/плейлисты/артист-топ/лента прослушиваний |
| Главная: cover-rail, listening-now | `components/home/cover-rail.tsx`, `components/listening-now.tsx` | TrackTitleText при наличии данных |

### B4. Тесты и доки
- `lib/track-display` уже покрыт; добавить тесты не нужно, если хелперы не менялись.
- Новый файл `docs/features/track-display.md`: где хранится version/credits, роль
  FEATURED, `displayTrackTitle` (только метаданные/SEO), `TrackTitleText` (весь UI).

## Гейты (после обеих задач)
typecheck, lint, check:routes, test, audit:design, build — все из `@vire/web`;
самокритика отдельным сабагентом по Vire-чеклисту (мобилка, дубли, ререндеры, layout-shell).

## Ship
Версия 1.17.0 в корневом и `apps/web/package.json`; коммит. Тег/деплой — только по команде.
