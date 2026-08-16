# Platform Core + SDUI — исходное задание и журнал фаз

**Источник:** постановка Danya от 10.08.2026. Это опорный документ программы — при старте
новой сессии читать его первым, затем `docs/architecture-audit.md` и журнал фаз внизу.

---

## Роль исполнителя

Senior Staff/Principal Software Architect + Senior Full-Stack Engineer, проектирующий
платформенную архитектуру для AI-native продуктов.

Задача — превратить существующий VireMusic в первый production vertical будущей
**VireMusic Platform Core**. Веб на Next.js практически готов. **Полный rewrite запрещён**,
нужна эволюция.

---

## 1. Стратегическое видение

Сейчас: `VireMusic Web → Next.js → Backend`.

Цель:

```
                         PLATFORM CORE
                 ┌────────────┴────────────┐
            Core Services             Shared Contracts
                 └────────────┬────────────┘
                             API
             ┌────────────────┼────────────────┐
            Web             Mobile           Desktop
          Next.js       iOS / Android      Win / macOS
             └────────────────┼────────────────┘
                         SDUI Protocol
                    Platform-specific UI renderers
```

Поверх Core в дальнейшем: VireMusic, VireVideo, VireLearn, VireShop и другие verticals.
Каждый переиспользует Core, но имеет собственную domain logic, UI и branding.

## 2. Главная архитектурная идея

Разделить на **Platform Core** (универсальные capabilities) и **Product Domain**
(специфика вертикали).

Core: authentication, users, organizations, memberships, RBAC, permissions, sessions, API,
shared contracts, billing, subscriptions, payments, notifications, media/files, storage,
search, analytics, audit logs, admin framework, feature flags, configuration, design tokens,
UI primitives, SDUI engine, infrastructure abstractions.

Domain для VireMusic: Artist, Track, Release, Album, Playlist, Music Library, Streaming,
Audio Processing. Для VireVideo: Creator, Video, Channel, Playlist, Streaming, Video Processing.
Для VireLearn: Teacher, Course, Lesson, Module, Progress.

**Core не должен знать о domain entities конкретного продукта.** Не `Core ├── Music ├── Video`,
а `Core ← Product Domain ← Product Application`.

## 3. Критическое ограничение

**«Abstract after evidence».** Не создавать абстракции потому, что они теоретически могут
понадобиться. Явно общая capability — выделять сразу. Используется только VireMusic и
неочевидно, что это Core — оставить в домене. Не строить enterprise architecture ради
архитектуры.

## 4. Существующий Web

Не переписывать приложение. Не удалять существующие компоненты без необходимости.
Не заменять рабочую архитектуру ради соответствия новой.
Путь: `Existing VireMusic → Gradual extraction → Platform Core → Multiplatform ecosystem`.

## 5. Сначала аудит

Полностью изучить репозиторий: Next.js, React, TypeScript, routing, server/client components,
server actions, API routes, database, ORM, authentication, authorization, state management,
data fetching, caching, storage, media, payments, UI, design system, types, utilities,
business logic, infrastructure, deployment, CI/CD, environment configuration, testing.

Найти: (1) что VireMusic-specific; (2) что потенциально Core; (3) что слишком связано с Next;
(4) что связано с браузером; (5) что можно использовать на других клиентах; (6) что вынести
в shared contracts; (7) где дублирование; (8) что мешает будущему Mobile/Desktop;
(9) что подходит для SDUI; (10) что категорически не подходит.

**До завершения аудита код не переписывать.**

## 6. Документация

```
docs/
├── architecture-audit.md
├── architecture.md
├── platform-core.md
├── api-contracts.md
├── sdui.md
├── multiplatform.md
└── migration-plan.md
```

Описывать не только конечную архитектуру, но и путь миграции.

## 7. Предлагаемая структура (к оценке, не к автоматическому внедрению)

```
apps/{web,admin,docs}
packages/{core,auth,users,permissions,billing,subscriptions,notifications,media,
          search,analytics,api,database,storage,ui,design-tokens,sdui}
products/viremusic
```

Сначала оценить текущий репозиторий. Если monorepo преждевременен — объяснить почему
и предложить более безопасный переход.

## 8. Shared Domain Contracts

Единый источник истины: User, Organization, Membership, Role, Permission, Subscription,
Plan, Payment, MediaFile, Notification. Не зависят от React/Next/DOM/browser API.
Рассмотреть OpenAPI/JSON Schema для генерации клиентских типов и SDK.

## 9. API-first architecture

Стремиться к `Client → API → Application → Domain → Infrastructure → DB`, а не
`Next.js UI → Next-specific logic → DB`, где это мешает будущим клиентам.

Versioned API `/api/v1` с группами: `/auth /users /organizations /permissions /billing
/subscriptions /media /search /notifications /analytics` и доменными
`/music /artists /releases /tracks /playlists`.

## 10. Platform Core capabilities

- **Identity:** Users, Sessions, Authentication, OAuth, Email verification, Password reset, Devices
- **Organizations:** Organization, Membership, Roles, Permissions, RBAC
- **Billing:** Plans, Subscriptions, Payments, Invoices, Entitlements
- **Media:** Upload, Storage, Metadata, Processing, CDN. Core даёт pipeline, но не знает,
  что файл — музыкальный трек или видео. Core: `MediaFile`, `MediaAsset`, `ProcessingJob`.
  VireMusic: `Track`, `AudioAsset`, `Waveform`. VireVideo: `Video`, `VideoAsset`, `Thumbnail`
- **Notifications:** Email, Push, In-app, Webhook. Domain events вида `track.released`,
  `video.published`, `course.completed`. Core даёт механизм событий и доставки
- **Search:** `SearchIndex`, `SearchDocument`, `SearchQuery`, `SearchResult`. Домены
  регистрируют свои searchable entities
- **Analytics:** Core даёт `Event`, `UserEvent`, `ProductEvent`, `PageView`, `Conversion`;
  продукт определяет свои события

## 11. Admin Framework

Core умеет: Users, Organizations, Roles, Permissions, Billing, Subscriptions, Media,
Analytics, Settings, Audit logs. VireMusic добавляет Artists, Tracks, Releases, Albums,
Playlists. **Не создавать generic CRUD abstraction, которая станет магической.**
Предпочтение — «explicit configuration over magic».

## 12. Design System

Shared foundation: Colors, Typography, Spacing, Radius, Shadows, Breakpoints, Motion, Icons.
Примитивы: Button, Input, Modal, Card, Tabs, Dropdown, Toast, Table, Form.
Product-specific остаются доменными: TrackCard/ArtistCard/ReleaseCard/Player/Playlist
против VideoCard/ChannelCard/VideoPlayer.

## 13. Multiplatform strategy

Клиенты: Web, iOS, Android, Windows, macOS. **Не делать один визуальный UI для всех.**

Общее: domain contracts, API, business rules, capabilities, design tokens, SDUI schema.
Платформенное: renderer, navigation, interaction, animations, native controls,
system integration, audio, notifications, storage.

## 14. Server-Driven UI

SDUI — важная часть, но не вся архитектура. Типизированный протокол:

```ts
type UIBlock = HeroBlock | TrackListBlock | ArtistGridBlock | ReleaseGridBlock | BannerBlock;
```

```json
{ "screen": "home", "version": 1,
  "blocks": [{"type":"hero"},{"type":"release-grid"},{"type":"artist-carousel"}] }
```

Registry: `{ hero: Hero, "release-grid": ReleaseGrid, "artist-carousel": ArtistCarousel }`.

SDUI отвечает за: composition, ordering, configuration, feature flags, personalization,
A/B tests, dynamic content.

SDUI **не** содержит: arbitrary JavaScript, eval, сложную бизнес-логику, весь application
state, критическую client logic, сложные формы целиком, audio player logic, authentication logic.

## 15. Product Manifest

Исследовать описание вертикали через manifest (`id`, `modules`, `entities`, `features`,
`theme`). Не превращать в magic framework — использовать только там, где реально уменьшает coupling.

## 16–17. White-label и SaaS potential

Архитектура должна потенциально позволять `Platform Core → VireMusic / Customer A / B / C`
со своими Brand, Logo, Colors, Typography, Domain, Features, Modules, Content, Pricing.
Но **не реализовывать** полноценную enterprise multi-tenancy и self-service SaaS сейчас —
спроектировать boundaries и migration path. Сначала одна качественная реализация VireMusic.

## 18. VireMusic как первый vertical

Domain: Artist, Track, Release, Album, Playlist, Library, Streaming.
Core: User, Auth, Organization, Permissions, Billing, Media, Search, Notifications,
Analytics, API, SDUI, Admin. Сущность на границе — объяснить решение.

## 19. Migration strategy

Не переписывать. Постепенно: keep working → extract contracts → extract core capabilities →
introduce API boundaries → introduce shared UI → introduce SDUI selectively → add future clients.
**Каждая миграция обратима.**

## 20. Testing

Unit, Integration, API, Contract, E2E, SDUI schema validation.
Особенно важны contract tests между Core/API и клиентами.

## 21. Infrastructure

Docker, CI/CD, environment management, secrets, database migrations, storage, CDN, queues,
background jobs, monitoring, logging, error tracking. **Не добавлять инфраструктуру, пока не нужна.**

## 22. Security

Authentication, authorization, RBAC, input validation, rate limiting, CSRF, CORS, secrets,
file upload security, API security, tenant isolation, audit logs — особенно под будущий
white-label/SaaS сценарий.

## 23. Финальный критерий

Должно стать возможным: `PLATFORM CORE → {VireMusic, VireVideo, VireLearn} → Shared API →
{Web, Mobile, Desktop}`. Создание нового продукта сводится к: define domain → configure
modules → create domain UI → configure theme → configure SDUI components → connect content →
deploy. А **не** к переписыванию Auth/Users/Billing/Payments/Storage/Notifications/Admin/
Analytics/API с нуля.

## 24. Самое важное правило

**Не строить платформу ради платформы.** VireMusic — источник требований к Core.
Появляется что-то только потому, что «когда-нибудь VireVideo может это использовать» —
сначала объяснить, почему абстракция необходима сейчас. Сомневаешься — оставляй
в product domain до второго use case.

## 25. Фазы работы

| Фаза | Содержание | Артефакт |
|---|---|---|
| 0 | Repository Audit — ничего не менять | `architecture-audit.md` |
| 1 | Target Architecture | `architecture.md`, `platform-core.md`, `multiplatform.md`, `sdui.md` |
| 2 | Migration Plan — последовательность малых безопасных изменений | `migration-plan.md` |
| 3 | First Extraction — минимальный очевидный Core capability | код |
| 4 | API Contracts — стабильные контракты первой группы сущностей | код + `api-contracts.md` |
| 5 | Shared UI — только действительно reusable primitives | код |
| 6 | SDUI Foundation — минимальный typed protocol и renderer | код |
| 7 | VireMusic Migration — перевести один небольшой участок | код |
| 8 | Future Client Readiness — проверить возможность Mobile/Desktop без копирования логики | отчёт |

## Правила взаимодействия

Перед каждой крупной фазой показывать: (1) что обнаружено; (2) что предлагается изменить;
(3) почему необходимо; (4) какие альтернативы рассмотрены; (5) trade-offs; (6) что изменится
в репозитории; (7) как проверить результат; (8) как откатить.

**Не делать большие архитектурные изменения молча.** Считаешь идею технически неоправданной —
сказать прямо и предложить более простой вариант. Существующая реализация лучше предложенной
абстракции — оставить существующую.

## Главная цель

Не «идеальный фреймворк», а: **VireMusic как первый качественный продукт на базе постепенно
формирующегося Platform Core, который в будущем позволит одному разработчику с AI быстро
создавать и запускать новые специализированные Web/Mobile/Desktop продукты и при
необходимости превращать их в SaaS или white-label решения.**

---

# Журнал фаз

Обновлять при каждом переходе. Это точка входа для новой сессии.

## Ответы на развилки (зафиксировано 10.08.2026)

| Вопрос | Ответ | Следствие |
|---|---|---|
| Второй продукт — план или гипотеза? | **Реальный план, 3–6 мес** | Обобщение границ обосновано доказательством: organizations/membership, полиморфные likes/follows, generic media, event-модель аналитики — режем |
| Апгрейд VPS? | **В планах** | Двухступенчатый деплой: Core как пакеты сейчас, отдельный `apps/api` — опция после апгрейда |
| Что вперёд — платформа или Этап 2? | **Сначала фундамент** | Порядок работ: RBAC → read-path HTTP → контракты → вынос чистой логики |

## Статус

| Фаза | Статус | Дата | Артефакт |
|---|---|---|---|
| 0 — Audit | ✅ завершена | 10.08.2026 | `docs/architecture-audit.md` |
| 1 — Target Architecture | ✅ завершена | 10.08.2026 | `architecture.md` · `platform-core.md` · `sdui.md` · `multiplatform.md` |
| 2 — Migration Plan | ✅ завершена | 10.08.2026 | `migration-plan.md` (+ `api-contracts.md` написан авансом) |
| 3 — First Extraction | 🟡 в работе | 12.08.2026 | Волна 0 ✅ (0.1 раскладка core, 0.2 барьер `check:layers`) · Волна 1 ✅ (`platform/access`, единый гейт на admin-периметре, `audit_log` — `docs/features/rbac.md`) · Волна 2 ✅ завершена (read-path в HTTP): 2.1 артист, 2.2 релиз, 2.3 каталог релизов, 2.4 каталог артистов, 2.5 плейлист, 2.6 лента, 2.7 блоки главной (6 эндпоинтов `/v1/home/*`, предусловие SDUI выполнено) · Волна 3 ✅ завершена (контракты, см. фаза 4) · Волна 5 ✅ завершена 16.08.2026 (перенос чистой логики, 3 среза: очередь плеера + форматтеры; примитивы насыщения `saturateLinear`/`saturateLog`; сессия волны и `engine-policy`). 5.5 сужен: чистые предикаты движка вынесены, `IAudioEngine` отложен до второго драйвера · Волна 7 ✅ завершена 16.08.2026 (уведомления и конфигурация, 4 среза: валидация env через zod на старте; общая оболочка письма + транскодинг в i18n; реестры типов и внешних событий уведомлений, `notification_type` enum → text; feature flags из БД + `/admin/flags`). Предусловие волны 8 закрыто |
| 4 — API Contracts | ✅ завершена | 12.08.2026 | Волна 3 (4 среза): `common.ts` + follow/like/presave + artist/release ресурсные (срез 1); весь `playlists/**` кроме SSE (срез 2); `chat/**`+`notifications/**` (срез 3); барьер `check:contracts` (роут `/api/v1` без схемы в `@vire/api-contracts` вне allowlist → красный) + доки (срез 4). Итог: 40/119 роутов на контрактах, 79 в allowlist (`docs/api-contracts.md`) |
| 5 — Shared UI | ⬜ | | |
| 6 — SDUI Foundation | ⬜ | | |
| 7 — VireMusic Migration | ⬜ | | |
| 8 — Client Readiness | ⬜ | | |

## Принятые архитектурные решения

1. **Сначала директория, потом пакет.** Границы живут как директории внутри существующих
   пакетов и защищаются линтером; отдельным пакетом становятся при появлении второго
   физического потребителя. Основание: в репозитории уже три пустых пакета, созданных
   «под будущее» (`ui` — 2 компонента, `api-contracts` — 3 файла, `media` — пуст).
2. **Структура из 16 пакетов и `products/` отклонена** на текущем этапе — см. выше.
3. **Одна реализация, два входа.** Логика чтения — read-сервис в core; Server Component
   вызывает в процессе, HTTP-роут вызывает тот же сервис. RSC через собственный HTTP
   не гоняем (лишний хоп, потеря стриминга, 1 ГБ RAM).
4. **Core как отдельный сервис — только после апгрейда VPS.** Сейчас набор пакетов
   в одном образе.
5. **Главный блокер — не абстракции, а read-path:** 27/53 страниц читают БД напрямую,
   HTTP-эквивалента нет.
6. **Права — только роли, ownership отдельно.** Матрица `can(actor, permission)` не знает
   о владении ресурсом: ownership зависит от данных и живёт в сервисах core. Роль `ARTIST`
   намеренно без прав — артист-периметр держится на `artist_profiles`, иначе ломаются
   несколько аккаунтов на артиста.
7. **Набор значений — реестр в коде, не enum в БД.** Типы уведомлений (и по той же логике
   флаги) объявляются реестром в core: БД хранит `text`, отсутствие значения в реестре —
   ошибка, а не молчаливое «неизвестно». Новый тип не требует ни миграции, ни синхронного
   релиза клиентов; цена — валидация переезжает из БД в сервис, поэтому она обязательна.
8. **Драйвер плеера не абстрагируется до второго клиента.** Из `audio-engine.ts` в core
   вынесены только чистые решения (`engine-policy`); HLS-драйвер, мутабельные счётчики
   и работа со стором остались в web. Порт `IAudioEngine` появится вместе со вторым
   драйвером (нативный плеер мобильного), не раньше — «abstract after evidence».
9. **`search` и `billing` остаются в `platform/`** несмотря на доменную форму
   (`SearchResults = {artists, releases, tracks}`, `TRACK_PRICE` в `PurchaseService`):
   механизм нейтрален, мешают только значения. Обобщение — отдельным шагом по
   `platform-core.md` §2.6–2.7, не перекладыванием файлов.
