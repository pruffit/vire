# 1-D: домен «дашборд артиста» → core — дизайн

Кусок 1-D из нарезки §1 (`2026-07-12-stage2-refactor-slicing-design.md`).
Рефакторинг **поведение 1:1** (кроме явно принятых отклонений ниже): вынос
бизнес-логики роутов дашборда в сервисы `packages/core` по канону
handler → service → repository, эффекты (S3/очередь/время/uuid/сеть) — за портами.

## Скоуп — 8 route-файлов

| Роут | Методы | Сейчас |
|---|---|---|
| `api/v1/dashboard/releases` | POST | прямой repo + S3 в хендлере |
| `api/v1/dashboard/releases/[id]` | PATCH (DELETE уже в сервисе) | прямой repo + S3 |
| `api/v1/dashboard/releases/[id]/status` | PATCH | прямой repo + BullMQ в хендлере |
| `api/v1/dashboard/posts` | POST | query-функция в хендлере |
| `api/v1/dashboard/posts/[id]` | PATCH, DELETE | query-функции + локальный authorize() |
| `api/v1/dashboard/smart-links` | POST | query-функции + S3 |
| `api/v1/dashboard/smart-links/[id]` | PATCH, DELETE | query-функции + S3 |
| `api/v1/dashboard/profile` | POST | прямой repo + S3 + fetch видео-тайтлов |
| `api/v1/dashboard/tracks/upload` | POST | S3 в хендлере, создание уже в TrackService |

**Вне скоупа:** active-artist (cookie = чистый HTTP), live (presence),
genres/analyze/analyze-genre/genre-suggestions/audio-features (тонкие обёртки над
query/очередью — кандидаты 1-H), user/profile (не артист). Zod-переписывание
FormData-парсинга — НЕ делаем (churn без пользы, парсинг переносится как есть).

## Ошибки: + `ValidationError`

В `packages/core/src/errors.ts` добавить `ValidationError` (`_tag`-стиль, как
NotFoundError/ConflictError). Маппинг в хендлерах: `NotFoundError→404`,
`ConflictError→409`, `ValidationError→400`, иначе `403`. Тексты ошибок —
**байт-в-байт** текущие (включая русские: «Нужно название», «Некорректный адрес
(slug)», «Такой адрес уже занят» (409!), «Релиз не найден» (это 400, не 404 —
поэтому ValidationError)).

## Порты (новые)

```ts
// packages/core/src/repositories/storage.ts
export interface IFileStorage {
  upload(key: string, body: Uint8Array, contentType: string): Promise<string>; // → публичный URL
}
```
`IPlaylistCoverStorage` в `repositories/playlist.ts` становится алиасом
`IFileStorage` (реэкспорт типа, потребители не трогаются).

```ts
// в services/release.ts (паттерн ITranscodeQueue)
export interface INotifyReleaseQueue { add(data: NotifyReleaseJobData): Promise<void>; }
// NotifyReleaseJobData — тип в core (releaseId, releaseTitle, releaseType, coverUrl, artistProfileId, artistName, artistSlug)

// repositories/artist-post.ts
export interface IArtistPostRepository {
  create(input: { artistProfileId: string; title: string | null; body: string }): Promise<ArtistPost>;
  findById(id: string): Promise<ArtistPost | null>;
  update(id: string, patch: { title: string | null; body: string }): Promise<void>;
  delete(id: string): Promise<void>;
}

// repositories/smart-link.ts
export interface ISmartLinkRepository {
  slugTaken(artistProfileId: string, slug: string, excludeId?: string): Promise<boolean>;
  create(artistProfileId: string, input: SmartLinkInput): Promise<string>; // → id
  findById(id: string): Promise<SmartLink | null>;
  update(id: string, artistProfileId: string, patch: Partial<SmartLinkInput>): Promise<void>;
  delete(id: string, artistProfileId: string): Promise<boolean>;
  releaseOwnedByArtist(artistProfileId: string, releaseId: string): Promise<boolean>;
}

// services/artist.ts
export interface IVideoTitleResolver { resolve(url: string): Promise<string>; }
```

Drizzle-реализации в `packages/db/src/repositories/` — тонкие делегаты к
существующим query-функциям (`createArtistPost`, `getSmartLinkById`, …);
`releaseOwnedByArtist` — через `getReleaseOptions(artistId).some(...)` (1:1 с
текущей проверкой). Доменные типы `ArtistPost`, `SmartLink`, `SmartLinkInput`
переезжают/дублируются в `core/types` (сейчас типы у query-слоя — core не
импортирует db, поэтому типы объявляются в core, db-слой их реэкспортит или
маппит).

## Сервисы

Конструкторы: обязательный repo + опциональный объект deps
(`deps?: { coverStorage?; notifyQueue?; uuid?; … }`) — существующие call-sites
(release DELETE, публичные GET) не трогаются; метод, которому не хватает
инъекции, кидает `Error` (программная ошибка сборки DI, не Result).
Дефолт `uuid` — `crypto.randomUUID`, `now` — `Date.now` (инъектируемы в тестах).

### ReleaseService (расширение)
- `create(artistProfileId, params { title, type, genre, releaseDate, description, cover?: { buffer, ext, mime } })` → `Result<{ releaseId }>`. releaseId = uuid(); ключ обложки `covers/{releaseId}.{ext}` через coverStorage; далее repo.create. Тримминг title/description — в сервисе (1:1).
- `update(releaseId, artistProfileId, params + linerNotes)` → `Result<{ releaseId }, NotFoundError | Error>`; findById → NotFound('Not found'), чужой → err(Error('Forbidden')) → 403; обложка: новый файл → upload, иначе прежний coverUrl.
- `changeStatus(releaseId, artistProfileId, status, artist: { name, slug })` → `Result<{ status }>`; ownership как выше; `wasPublished = release.status !== 'PUBLISHED' && status === 'PUBLISHED'` → notifyQueue.add(payload 1:1).
- Валидация type/genre/'Title is required' — остаётся на краю (хендлер), как сейчас: это парсинг FormData.

### ArtistPostService (новый, services/artist-post.ts)
- Чистая функция `normalizePostInput(payload: unknown): { title: string | null; body: string }` переезжает в core (сейчас `normalize` экспортится из роута).
- `create(artistProfileId, payload: unknown)` → `Result<{ post }, ValidationError>`: normalize → 'Body is required' / 'Too long' (лимиты 120/2000 — константы сервиса).
- `update(postId, artistProfileId, payload)` → `Result<void, NotFoundError | ValidationError | Error>`: findById → NotFound('Not found'); чужой → Error('Forbidden'); затем normalize+лимиты.
- `delete(postId, artistProfileId)` → `Result<void, NotFoundError | Error>`.
- Ответы 1:1: `{ post }` 201; `{ ok: true }`.

### SmartLinkService (новый, services/smart-link.ts)
- Чистые `normalizeSlug`, `isValidSlug`, `parseSmartLinkLinks` переезжают из `apps/web/lib/smart-link.ts` в core; web-lib превращается в реэкспорт (клиентские импорты не трогаем).
- `create(artistProfileId, input { title, slugRaw, subtitle, releaseDate, releaseIdRaw, links, isPublished, cover? })` → `Result<{ id, slug }, ValidationError | ConflictError>`: 'Нужно название' → Validation; slug = normalizeSlug(slugRaw || title), isValidSlug → Validation; slugTaken → Conflict; releaseId непустой и не releaseOwnedByArtist → Validation('Релиз не найден'); обложка `covers/smartlinks/{uuid()}.{ext}`.
- `update(id, artistProfileId, patch-поля из FormData как typed input)` → `Result<void, NotFoundError | ValidationError | ConflictError>`: findById + чужой → **NotFound** (текущий код отдаёт 404 и на чужой — сохранить!); далее по-полёвно 1:1 (slug меняется → uniqueness с excludeId; removeCover; releaseId пустой → null).
- `delete(id, artistProfileId)` → `Result<void, NotFoundError>` (repo.delete → false = NotFound).

### ArtistService (расширение, services/artist.ts)
- `updateProfile(artist: ArtistProfile, input)` → `Result<{ ok: true }, ValidationError>`; artist передаётся снапшотом (хендлер уже держит его из getActiveArtist) — fallback-семантика «не пришло — оставить прежнее» 1:1.
- input: `{ name, bio, avatar?: файл | null, removeAvatar, header?, removeHeader, linksRaw: string | null, videosRaw: string | null, bg, text, accent, grain, fontSans, fontMono }` — парс JSON links/videos (с молчаливым keep-existing при битом JSON), лимиты 10/20, isHex, каталоги шрифтов — в сервисе. Каталоги шрифтов инъектируются: `deps.fonts: { sans: readonly string[]; mono: readonly string[] }` (лежат в web `lib/font-catalog.ts` — в core их не тащить).
- Тайтлы видео — через `IVideoTitleResolver` (адаптер над `resolveVideoTitle`).
- Cache-busting `?v=` — инъектируемый `now`.
- Валидация изображений (`validateImageUpload` + policies) остаётся на краю; сервис получает `{ buffer, ext, mime }`.

### TrackService (расширение)
- Конструктор: 4-й опц. параметр `deps?: { audioStorage?: IFileStorage; uuid? }`.
- `createUpload` поглощает: генерацию trackId, `sourceKey = tracks/{trackId}/source.{ext}`, CONTENT_TYPE-мапу, загрузку в audioStorage. Хендлер оставляет себе rate-limit, парсинг/валидацию файла (magic bytes, размер, ext) и передаёт `{ ext, buffer }`.
- **Принятое отклонение (улучшение):** S3-загрузка теперь ПОСЛЕ проверки владения релизом — при 403/404 осиротевший объект в S3 больше не создаётся. Ответы 1:1.

## Web-адаптеры

- `apps/web/lib/file-storage.ts` — `S3FileStorage implements IFileStorage` поверх `uploadToStream`; для аудио — поверх `uploadBuffer` (если сигнатуры расходятся — два тонких класса в одном файле). `lib/playlist-cover-storage.ts` переключить на общий класс (или оставить реэкспортом) — не плодить дубли.
- `lib/queue.ts` `notifyReleaseQueue` уже структурно совместим с `INotifyReleaseQueue`.
- `lib/video-meta.ts` — адаптер `VideoTitleResolver`.

## Принятые отклонения (то же семейство, что в 1-C)

1. Парсинг тела (JSON/FormData) в хендлере теперь ДО проверки владения ресурсом
   в PATCH-роутах постов/смартлинков: битый JSON на чужом ресурсе → 400 вместо
   403/404. Валидный вход — порядок 1:1 (ownership → валидация внутри сервиса).
2. Track upload: S3-загрузка после ownership-проверки (см. выше).
3. Profile: проверка 'Name is required' до парса links/videos (эффектов нет, ответ тот же).

## Тесты

- Core: юнит-тесты новых/расширенных сервисов (моки портов) — create/update/status
  релиза (вкл. wasPublished-ветку и «queue не дёргается при повторной публикации»),
  посты (лимиты, ownership), смартлинки (slug-конфликт 409, чужой → NotFound,
  'Релиз не найден'), updateProfile (fallback-семантика, битый JSON, лимиты 10/20,
  isHex, шрифты вне каталога), createUpload (ключ/contentType, порядок storage-вызова).
- Web: существующие route.test.ts переводятся на моки сервисных зависимостей
  (паттерн C2 — `class { method = mockFn }`); смартлинки без тестов — добавить
  route.test.ts на оба файла (права, slug 409, 1:1 ответы).

## Исполнение (последовательно, Sonnet, после — независимая самокритика)

- **D1** — core: ValidationError, порты, типы, сервисы, юнит-тесты. Гейты core.
- **D2** — web: адаптеры, переключение 8 роутов, route-тесты. Гейты web полн.
- **D3** — доки: architecture.md (карта сервисов), stage-2 §1.1, TECHNICAL_DEBT,
  CLAUDE.md (счётчик тестов), отклонения — сюда в спеку, если добавятся.

## Отклонения при реализации (приняты)

1. Парсинг тела (JSON/FormData) в хендлере теперь ДО проверки владения ресурсом
   в PATCH-роутах постов/смартлинков: битый JSON на чужом ресурсе → 400 вместо
   403/404. Валидный вход — порядок 1:1 (ownership → валидация внутри сервиса).
2. Track upload: S3-загрузка после ownership-проверки — при 403/404 осиротевший
   объект в S3 больше не создаётся. Ответы 1:1.
3. Profile: проверка 'Name is required' до парса links/videos (эффектов нет, ответ тот же).
4. `releases` POST/PATCH/status и `smart-links` create/update: краевая валидация
   (title/type/genre, image-байты, status-enum) теперь в хендлере ДО сервисной
   ownership-проверки — при двух одновременных дефектах (напр. нет title И чужой
   релиз) ответ 400 вместо прежних 404/403. Тексты `'Not found'`/`'Forbidden'` для
   release PATCH/status сохранены байт-в-байт через ветвление по `instanceof NotFoundError`.
5. Смартлинки: порядок «байты обложки vs полевые проверки» поменялся — обложка
   раньше валидировалась последней, теперь валидируется в хендлере первой (до
   вызова сервиса, где идут проверки title/slug/release).
