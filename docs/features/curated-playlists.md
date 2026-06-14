# Подборки на главной (редакционные + личные)

Секция «Подборки» на главной = **две группы по 4 карточки**:
- **Общие** — одинаковы для всех, обновляются раз в сутки в 00:00 (МСК).
- **Личные** — генерятся под каждого юзера по его вкусу, обновляются раз в 4 часа.
  Гостю/новому юзеру без сигнала личную половину закрывает фолбэк на популярное —
  сетка всегда полная.

Не путать с пользовательскими плейлистами (`docs/features/interactions.md`) — те
создаёт сам слушатель.

## Что делает

### Общие (shared)
- `Сейчас набирает` (TRENDING) — топ прослушиваний за 7 дней.
- `Свежее` (FRESH) — последние опубликованные треки.
- `Возвращаются снова` (RELISTEN) — треки с возвратами (2+ дня от одного юзера).
- Топ-настроения (MOOD) — **только 3 самых наполненных** (раньше генерились все
  18; лишние mood-подборки удаляются при каждом прогоне).
- Показ: приоритет TRENDING → FRESH → MOOD → RELISTEN, берём 4.

### Личные (personal)
- Сигнал: лайки + прослушивания за 90 дней → топ-настроения этих треков.
- Генерим до 4: «Для тебя» (микс по топ-настроениям) + mood-подборки под вкус.
- Нет сигнала (< 3 треков) → личные подборки удаляются.
- Хранятся как `playlists` с `kind='PERSONAL'`, `target_user_id=<юзер>`, `is_curated=true`.
  В личный список юзера не попадают (там фильтр по `owner_user_id`).

## Где код
- **Генерация:** `packages/db/src/queries/editorial.ts`
  (`generateSharedPlaylists`, `generatePersonalPlaylists`,
  `generatePersonalPlaylistsForAllUsers`, `generateAllEditorialPlaylists`).
- **Запросы для главной:** `packages/db/src/queries/playlists.ts`
  (`getEditorialPlaylists` — общие, `getPersonalPlaylists`, `getPopularPlaylists` — фолбэк).
- **Расписание:** воркер `apps/worker/src/workers/editorial.worker.ts` + планировщики
  в `apps/worker/src/index.ts` (`upsertJobScheduler`: `shared-daily` cron `0 0 * * *`,
  `personal-4h` cron `0 */4 * * *`, tz `Europe/Moscow`).
- **Ручной прогон:** `/admin` → «Обновить подборки» → `POST /api/v1/admin/editorial`
  (`generateAllEditorialPlaylists` — общие + личные).
- **UI:** `apps/web/app/page.tsx` (секция «Подборки»), `components/editorial-playlist-card.tsx`.
- **Схема:** `playlists.kind` enum (+`PERSONAL`), `playlists.target_user_id`
  (миграция `0017`).

## Ограничения / на будущее
- Личные пересобираются целиком (delete + insert), а не диффом — проще, при росте
  числа юзеров можно оптимизировать.
- Персонализация идёт по настроениям; жанры (`track_genres`) пока не учитываются.
- Личные подборки `visibility=PUBLIC` (доступны по прямой ссылке) — id не
  раскрывается, но строгой приватности нет.
- Планировщик — per-process; при нескольких репликах воркера `upsertJobScheduler`
  идемпотентен (один scheduler по id), дублей джобов не будет.
