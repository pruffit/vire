# План: полная локализация VireMusic

Спека: `docs/superpowers/specs/2026-08-09-i18n-full-localization-design.md`.
Каждый срез — один прогон сабагента (Sonnet, если не указано иное) + гейты.

Общие правила для всех срезов:
- Строки только в `packages/i18n/messages/{ru,en}/<namespace>.json`, ru и en заполняются
  одновременно. Ключи `camelCase`, вложенность по смыслу, не по файлам.
- Никаких комментариев в коде сверх неочевидного «почему» в 1–2 строки.
- Внутри локализованной зоны — только `Link`/`redirect`/`usePathname`/`useRouter` из
  `@/i18n/navigation`, не из `next/*`.
- Гейты после среза: `typecheck` (web+core+db), `lint`, `check:routes`, `check:i18n`,
  `test`, `audit:design` (если трогали UI).

---

## Срез 0 — фундамент (блокирует всё)

1. `packages/i18n`: package.json (`@vire/i18n`, exports `.` и `./messages/*`), tsconfig из
   `@vire/config`, `src/config.ts` (`LOCALES = ['ru','en']`, `DEFAULT_LOCALE = 'ru'`,
   `isLocale`, `LOCALE_LABELS`, `LOCALE_OG` → `ru_RU`/`en_US`), `src/messages.ts`
   (`getMessages(locale)` — динамический импорт всех неймспейсов, мёрж в один объект),
   `src/translator.ts` (`getTranslator(locale)` через `createTranslator` из `use-intl`).
   Неймспейсы создаются пустыми `{}` — наполняются в срезах A–H.
2. `apps/web`: зависимости `next-intl`, `@vire/i18n`; `i18n/routing.ts`,
   `i18n/navigation.ts`, `i18n/request.ts` (`getRequestConfig` → `getMessages`);
   `next.config.ts` оборачивается `createNextIntlPlugin('./i18n/request.ts')`.
3. Переезд дерева: `app/{(auth),(listener),dashboard,offline,feed}` → `app/[locale]/…`
   (`git mv`, чтобы сохранить историю). На корне остаются `api`, `admin`, `robots.ts`,
   `manifest.ts`, `sitemap.xml`, `sitemaps`, `opengraph-image.tsx`, `fwqa688`,
   `not-found.tsx`, `global-error.tsx`.
4. `app/[locale]/layout.tsx` — из нынешнего `app/layout.tsx`: `setRequestLocale`,
   `NextIntlClientProvider`, `<html lang={locale}>`, `generateStaticParams`.
   Корневой `app/layout.tsx` сводится к минимальной обёртке для не-локализованных веток.
   Инварианты app-shell (`overflow-clip`, единственная скролл-область, запрет
   `min-h-screen`) сохраняются дословно — тест `app/__tests__/layout-shell.test.ts`
   должен продолжать проходить, при переезде обновить в нём пути.
5. `proxy.ts`: `createMiddleware(routing)` выполняется первым, затем существующий
   auth-гейт; пути в гейте сравниваются после снятия префикса локали; редиректы строятся
   `getPathname({ href, locale })`. Matcher: исключить `api`, `_next`, `admin`, статику.
6. Массовая замена импортов: 53 файла `next/link`, 75 `next/navigation` внутри
   `app/[locale]/**` и `components/**` (кроме `components/admin/**`) → `@/i18n/navigation`.
   `next/navigation` для `useSearchParams`/`notFound`/`useParams` остаётся родным.
7. БД: миграция `users.locale varchar(8)` (nullable), поле в схеме и в `getUserProfile`.
8. Переключатель языка: `components/listener/profile/appearance-settings.tsx` +
   пункт в сайдбаре; пишет cookie `NEXT_LOCALE` и `PATCH /api/v1/user/profile` для
   залогиненного. Локаль **не** кладём в JWT.
9. `scripts/check-i18n.mjs` + скрипт `check:i18n` (пока в режиме отчёта, не падения —
   включается на падение в срезе J), в `prebuild` и в CI-job `gates`.
10. `public/sw.js`: пути precache/навигационного фолбэка учитывают префикс `/en`.

**Верификация среза 0 отдельно от гейтов**: `pnpm --filter @vire/web dev`, затем
`curl` по `/`, `/en`, `/artists`, `/en/artists`, `/dashboard`, `/en/dashboard`,
`/api/health`, `/robots.txt`, `/sitemap.xml` — везде 200 и правильный `lang`.

---

## Срезы A–F (после 0, независимы между собой)

Общий формат: вынести все пользовательские строки зоны в неймспейсы, заполнить ru (перенос
существующего текста дословно) и en (перевод), заменить в компонентах на `useTranslations`/
`getTranslations`. Русские комментарии в коде НЕ трогать.

- **A — оболочка слушателя и публичное** (`nav`, `home`, `catalog`, `artist`, `release`,
  `track`, `playlist`, `library`, `search`, `profile`, `player`, `auth`, `pwa`):
  `components/nav*.tsx`, `components/listener/**`, `components/player/**`,
  `app/[locale]/(listener)/{(home),artists,releases,search,playlists,library,profile,
  smartlink,presave,notifications}`, `app/[locale]/(auth)/sign-in`, `app/[locale]/offline`,
  `app/not-found.tsx`, `app/error.tsx`, `app/template.tsx`, `components/cookie-banner.tsx`.
  Самый крупный срез — можно разбить на A1 (оболочка+плеер+главная) и A2 (артист/релиз/
  трек/плейлисты/поиск/профиль).
- **B — соцслой** (`social`, `chat`, `jam`, `party`): `components/friends/**`,
  `components/chat/**`, `components/jam/**`, `components/notifications/**`,
  `app/[locale]/(listener)/{friends,messages,u,jam,nrvz914}`.
- **C — словари и форматирование** (`moods`, `genres`, `platforms`, `common`):
  `lib/moods.ts` (18 лейблов), `lib/genres.ts` (19 групп + ~280 жанров; сценовые термины
  на латинице оставить как есть, переводить только группы и русскоязычные подписи),
  `lib/platforms.ts`, `lib/discovery-reason.ts`, `lib/jam/jam-mode-labels.ts`,
  `components/home/wave-chip-items.ts`; `lib/format.ts` — убрать `plural/pluralTracks/
  pluralReleases`, перевести вызовы на ICU-сообщения; 24 файла с `toLocale*` → `useFormatter`
  (кроме `app/admin/**`).
- **D — дашборд артиста** (`dashboard`): весь `app/[locale]/dashboard/**` +
  `components/{theme-editor,credits-editor,links-editor,videos-editor,lyrics-editor,
  genre-picker,mood-picker,date-field,color-field,number-field}.tsx`.
- **E — серверные ошибки** (`errors`): поле `code` в `packages/core/src/errors.ts`;
  проставить коды в ~115 `throw new *Error(...)` в `packages/core/src/services/**`;
  route handlers отдают `{ error, code }`; 12 файлов `app/api/**` с прямым русским
  `error:` — тоже на коды; клиентский хелпер `lib/api-error.ts` → `t(errors.<code>)` с
  фолбэком на серверный текст; словарь `errors.json` ru+en.
- **F — письма и пуш** (`email`): `packages/core/src/notifications/email-templates.ts`
  и `apps/worker/src/workers/notify-release.worker.ts` — принимают `locale`, тянут строки
  через `getTranslator` из `@vire/i18n`, `<html lang={locale}>`; получатель берётся из
  `users.locale` (фолбэк `ru`); push-payload (`title`/`body`) — тем же путём; страницы
  отписки `notifications/unsubscribe`, `presave/unsubscribe`.

---

## Срезы G–J (после A–F)

- **G — юр. тексты**: `terms` (~384 сл.), `privacy` (~465 сл.), `about` (~516 сл.),
  `lib/faq.ts` (5 Q&A). Перенос в `legal.json`/`faq.json`, en — полноценный перевод.
  Длинные документы держать в `legal.json` структурно (секции/пункты), а не одной строкой.
- **H — SEO**: `lib/site.ts` (описания по локали), `lib/metadata.ts` (+`locale`,
  `alternates.languages` ru/en/x-default, `openGraph.locale`), `lib/meta-descriptions.ts`,
  `lib/structured-data.ts` (`inLanguage`, `websiteJsonLd`, `artistsCatalogJsonLd`),
  `app/sitemap.xml/route.ts` и `app/sitemaps/[shard]/route.ts` (обе локали +
  `xhtml:link alternate`), `app/manifest.ts`, 6 `opengraph-image.tsx` + `lib/og/card.tsx`.
- **I — editorial-плейлисты**: миграция `playlists.editorial_kind`/`editorial_params`,
  генератор в `packages/db/src/queries/editorial.ts` пишет kind+params, обратный маппинг
  настроения по `editorial_params.mood` вместо `MOOD_BY_LABEL` по строке, рендер через
  `playlist.editorial.*`, одноразовый бэкфилл существующих записей.
- **J — тесты и документация**: ~45 файлов с русскими ассертами (`apps/web` 31,
  `packages/core` 12, `apps/worker` 2) переводятся на ключи/`getTranslator`; тест паритета
  словарей ru↔en (одинаковые множества ключей, нет пустых значений); `check:i18n`
  переводится в режим падения; `docs/features/i18n.md` по шаблону
  `docs/features/README.md`; правка `CLAUDE.md` (раздел про локализацию) и
  `docs/roadmap/TODO.md`.

---

## Ship

Версия в двух местах (`package.json` корня и `apps/web/package.json`) → минор 1.49.0.
`pnpm install` после правок зависимостей → коммит lockfile → только потом тег.
Деплой — по отдельной команде Danya.
