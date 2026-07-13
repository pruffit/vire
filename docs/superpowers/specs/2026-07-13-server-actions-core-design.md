# 1-F: server actions → core — дизайн

Кусок 1-F из нарезки §1 (`2026-07-12-stage2-refactor-slicing-design.md`).
Рефакторинг **поведение 1:1**: бизнес-логика из server actions — в сервисы core,
эффекты (БД, bcrypt, очередь) — за портами. Next-специфика (`signIn`, `AuthError`,
`cookies`, `revalidatePath`, redirect) остаётся в action-файлах.

## Скоуп — 3 action-файла, 22 actions

| Файл | Всего | Переезжает в core | Остаётся тонким на краю |
|---|---|---|---|
| `app/(auth)/sign-in/auth-actions.ts` | 4 | `registerAction` (email занят → hash → create) | login/Yandex/magic-link — чистые signIn-обёртки |
| `components/listener/profile/account-actions.ts` | 2 | `setPasswordAction` (правило «пароль уже задан» → hash → set) | `linkYandexAction` — cookie + signIn |
| `app/admin/actions.ts` | 16 | 5× adminUpdate\* (post/playlist/artist/release/track) + adminDelete post/playlist + 2× retranscode | 9 тонких: RBAC + один query + revalidatePath (roles/verify/active/status×2, queue×2, createArtist, members×3) |

Тонкие actions **не трогаем** — им нечего хостить в core (гейт `requireAdmin`,
один вызов query-функции, возвращающей готовый `{ok|error}`, и revalidate).
Фиксируем это решение в TECHNICAL_DEBT как осознанное (кандидаты 1-H только если
в них заведётся логика).

## Порты

```ts
// repositories/user-account.ts
export interface IUserAccountRepository {
  findByEmail(email: string): Promise<{ id: string } | null>;
  createWithPassword(input: { email: string; name: string; passwordHash: string }): Promise<void>;
  getAuthInfo(userId: string): Promise<{ hasPassword: boolean }>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
}

// services/auth.ts (паттерн ITranscodeQueue — порт при сервисе)
export interface IPasswordHasher { hash(plain: string): Promise<string>; }
```

db-делегат `DrizzleUserAccountRepository` → существующие `findUserByEmail`,
`createUserWithPassword`, `getUserAuthInfo`, `setUserPasswordHash`.
Web-адаптер `lib/password-hasher.ts` — bcryptjs, **rounds 12** (1:1).

Расширение `ITrackRepository` (для ретранскода):
`getSourceKey(trackId): Promise<string | null>`,
`getArtistTrackSources(artistProfileId): Promise<{ trackId: string; sourceKey: string }[]>`,
`setStatus(trackId, status: TrackStatus): Promise<void>` — делегаты на
`getTrackSourceKey` / `getArtistTrackSources` / `setTrackStatus`.

Мудам/жанрам порт уже есть (`ITrackMoodsRepository`) — если в нём нет
`setGenres`, добавить делегатом на `setTrackGenres`.

## Сервисы

### AuthService (новый, services/auth.ts)
`constructor(repo: IUserAccountRepository, deps?: { hasher?: IPasswordHasher })`
- `register({ email, name, password })` → `Result<void, ConflictError>` —
  email занят → ConflictError; иначе hash → createWithPassword. Zod-валидация
  формы (имя 2–60, пароль 8–100, consent) и все тексты ошибок — на краю как сейчас;
  action маппит ConflictError → «Аккаунт с этим email уже существует. Войди вместо этого.»
- `setPassword(userId, password)` → `Result<void, ConflictError>` — правило
  `hasPassword` → ConflictError (край маппит в «Пароль уже задан…»); иначе hash → set.
- Совпадение password/confirmPassword — на краю (edge-валидация формы, 1:1).
- `signIn`/`AuthError`-обработка — только на краю; `loginAction` не меняется вовсе.

### Admin-методы на СУЩЕСТВУЮЩИХ сервисах (не плодить AdminService)
Все admin-методы **без ownership-проверки** (админ правит любой контент — как сейчас),
тексты ошибок валидации — ValidationError с байт-в-байт текущими сообщениями
(паттерн NOT_PRESAVABLE_MESSAGE), action возвращает `{ error: error.message }`.
RBAC (`requireAdmin`/`canMutate`, тихий no-op `return {}`) — остаётся на краю.

- **ArtistPostService.adminUpdate(id, { title, body })** — body trim, 1–10000
  («Текст: 1–10000 символов»), title trim → slice(0,200) | null.
  **adminDelete(id)** — pass-through для симметрии.
- **PlaylistService.adminUpdate(id, { title, visibility })** — title 1–200
  («Название: 1–200 символов»), visibility ∈ PRIVATE|PUBLIC («Неверная видимость»).
  **adminDelete(id)**.
- **ArtistService.adminUpdate(artistProfileId, { name, slug, bio, avatarUrl })** —
  name 1–120, slug lowercase + `/^[a-z0-9-]{2,60}$/`, bio trim→slice(0,2000)|null,
  avatarUrl trim||null; ошибка занятого slug из репозитория пробрасывается как
  ConflictError с текстом из db (сейчас `{ok:false, error}`) — action маппит в `{error}`.
- **ReleaseService.adminUpdate(releaseId, input)** — title 1–200, type ∈ RELEASE_TYPES
  («Неверный тип»), genre ∈ ALL_GENRES («Неверный жанр»), releaseDate: `new Date(str)` +
  isNaN («Неверная дата») — это парсинг входа, не «текущее время», в core допустим;
  description slice(0,5000), linerNotes slice(0,10000) → `repo.update`.
- **TrackService.adminUpdate(trackId, input)** — title 1–200, trackNumber целое ≥1,
  bpm null|целое 20–500 («BPM: 20–500»), lyrics ≤20000 («Текст слишком длинный»),
  version slice(0,80), musicalKey slice(0,20), moods filter(ALL_MOODS).slice(0,5),
  genres filter(ALL_TRACK_GENRES).slice(0,3) → `repo.update` + `moodsRepo.setMoods`
  + `moodsRepo.setGenres` (порядок 1:1). `sanitizeCredits` — **на краю** (парсинг
  входа, как FormData в 1-D): сервис принимает готовые `credits: TrackCredit[]`.
  Lyrics сервис принимает **сырой строкой** и парсит сам через `deps.parseLrc` —
  иначе edge-проверка длины ломает порядок валидаций (см. фикс b7f9d1c ниже).
  moodsRepo/parseLrc — через `deps?`, метод без нужной зависимости бросает Error
  (DI-паттерн 1-D).
- **TrackService.retranscode(trackId)** → `Result<void, ValidationError>` —
  нет sourceKey → «Нет исходника в vault — пересобрать нечем»; иначе
  setStatus('PROCESSING') → queue.add (ITranscodeQueue уже в сервисе).
  **retranscodeArtist(artistProfileId)** → `Result<{ queued: number }, ValidationError>` —
  пусто → «Нет треков с исходником в vault»; иначе цикл 1:1 (последовательно).

## Тесты

- Core: AuthService (email занят; hash вызван с паролем, create — с хэшем;
  setPassword при hasPassword; happy paths), adminUpdate-методы (матрица валидаций
  с байт-в-байт текстами, фильтрация moods/genres, порядок update→moods→genres),
  retranscode (нет исходника; порядок setStatus→queue.add; счётчик queued).
- Web (новые, паттерн route-тестов — vi.mock @vire/db, @/auth, next/cache, @/lib/queue):
  `auth-actions.test.ts` (register: занятый email, happy), `account-actions.test.ts`
  (setPassword: не залогинен, уже задан, happy), `admin/actions.test.ts`
  (updateTrack/updateRelease/retranscode: canMutate=false no-op, ошибка валидации,
  happy с revalidatePath) — actions раньше не были покрыты вовсе.

## Исполнение

- **F1** — код целиком (core + db-делегаты + web-адаптер hasher + 3 action-файла +
  тесты) одним Sonnet-агентом. Гейты: все (typecheck×3, lint, check:routes,
  тесты core/db/web, build).
- **F2** — доки (architecture.md, stage-2 §1.1, TECHNICAL_DEBT — решение по тонким
  actions, CLAUDE.md счётчики, отклонения — сюда).
- Затем независимая самокритика (Sonnet) по контракту 1:1 и чистоте core.

## Отклонения при реализации (приняты)

1. Фильтрация moods/genres по `ALL_MOODS`/`ALL_TRACK_GENRES` осталась на краю
   (в action): константы живут в `@vire/db`, core их не импортирует (та же
   конвенция, что в 1-E с валидацией mood/genre волны). Сервис получает уже
   отфильтрованные массивы; slicing `(0,5)`/`(0,3)` сохранён на краю.
2. В `actionAdminUpdateTrack` чистые трансформы (фильтр moods/genres,
   `sanitizeCredits`) считаются до вызова сервиса безусловно — чистые функции
   без эффектов, наблюдаемой разницы нет.
3. `ConflictError` в `AuthService` — generic-сообщения (не UI-тексты); русские
   тексты («Аккаунт с этим email уже существует…», «Пароль уже задан…»)
   хардкодятся в action по `instanceof ConflictError` — UI-копирайт остаётся на краю.

Найдено самокритикой и исправлено (`b7f9d1c`), **НЕ отклонение**: первоначальная
реализация оставила проверку `lyrics ≤ 20000` на краю ДО вызова сервиса — при
одновременно невалидном title и слишком длинном тексте админ видел «Текст
слишком длинный» вместо «Название: 1–200 символов». Исправлено переносом
проверки и парсинга LRC в `TrackService.adminUpdate` (инъекция `deps.parseLrc`,
сервис принимает сырую строку `lyrics`); порядок валидаций восстановлен и
закреплён тестом «reports the title error first…».
