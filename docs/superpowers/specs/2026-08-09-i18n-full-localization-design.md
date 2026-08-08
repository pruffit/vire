# Полная локализация VireMusic (i18n) — дизайн

Дата: 2026-08-09. Статус: утверждён к реализации.

## Задача

Сайт целиком на русском: текст зашит в ~480 файлов (`apps/web/app` 187, `components` 161,
`lib` 124, `packages/core` 57, `apps/worker` 29), плюс серверные ошибки, письма, словари
жанров/настроений, юр. страницы и русская плюрализация в `lib/format.ts`.

Цель — двуязычный сайт (ru по умолчанию + en) на инфраструктуре, где **добавление новой
локали = добавление словаря + строка в конфиг**, без правок компонентов. Горизонт — языки
СНГ и бывшего СНГ (uk, kk, uz, az, hy, ka, be, ky, tg, ro/md, lv/lt/et), но в этой работе
заполняем только ru и en.

Решения, зафиксированные с Danya:
- Языки: старт ru + en; архитектура расширяемая.
- URL: подпуть `/en/*`, ru **без** префикса (`localePrefix: 'as-needed'`).
- Охват: публичное + оболочка слушателя, дашборд артиста, письма и пуш. **Админка `/admin`
  остаётся русской** (внутренний бэкофис) — она не уезжает под `[locale]`.
- Авторский контент (названия, био, посты, чат) не переводим. Возможность артисту самому
  дать перевод своих текстов — отдельная будущая фаза, в этот объём не входит.
- Английские тексты пишем сразу, включая terms/privacy/about.

## Библиотека: next-intl 4.13.5

Peer-диапазон включает `next: ^16.0.0` — совместим с текущим Next 16.2.11 / React 19.2.
Даёт то, что дорого писать самому: locale-роутинг с `as-needed`-префиксом, согласование
языка (Accept-Language + cookie), ICU-плюрализацию через `Intl.PluralRules` (важно для
славянских и тюркских форм), форматтеры дат/чисел, `alternates.languages` для hreflang,
навигационные обёртки, статический рендер по локалям.

Воркер и любой не-React контекст используют `createTranslator` из `use-intl` (транзитивная
зависимость next-intl, framework-agnostic) — один и тот же ICU-движок и те же словари.

## Архитектура

### `packages/i18n` — единственный источник строк

```
packages/i18n/
  src/
    config.ts        LOCALES, DEFAULT_LOCALE, isLocale(), LOCALE_LABELS, LOCALE_OG
    messages.ts      getMessages(locale) — динамический импорт неймспейсов
    translator.ts    getTranslator(locale) — createTranslator для воркера/сервера
  messages/
    ru/{common,nav,player,home,catalog,artist,release,track,playlist,library,
        search,profile,social,chat,jam,party,auth,dashboard,legal,faq,
        moods,genres,platforms,errors,email,seo,pwa}.json
    en/…  (та же структура)
```

Пакет чистый (без Next и React) — его импортируют и `apps/web`, и `apps/worker`.
Правило: строка живёт в словаре ровно один раз; неймспейс = зона продукта, не файл.

### Роутинг

Дерево переезжает под `app/[locale]/`:

| Переезжает | Остаётся на корне |
|---|---|
| `(auth)`, `(listener)`, `dashboard`, `offline`, `feed` | `api`, `admin`, `robots.ts`, `manifest.ts`, `sitemap.xml`, `sitemaps/[shard]`, корневой `opengraph-image.tsx`, `fwqa688` |

- `i18n/routing.ts`: `defineRouting({ locales, defaultLocale: 'ru', localePrefix: 'as-needed' })`.
- `i18n/navigation.ts`: реэкспорт `Link`, `redirect`, `usePathname`, `useRouter`,
  `getPathname`. Все 53 файла с `next/link` и 75 с `next/navigation` внутри локализованной
  зоны переключаются на эти обёртки — иначе внутренние переходы теряют префикс.
- `proxy.ts` (Next 16 = бывший middleware): композиция `createMiddleware(routing)` **до**
  `auth()`-гейта; редиректы на `/sign-in` строятся через `getPathname({ locale })`, чтобы
  англоязычного не выбрасывало на русский логин. Matcher расширяется на `/en/...`,
  `/admin` и `/api` из него по-прежнему исключены.
- `app/[locale]/layout.tsx`: `setRequestLocale(locale)` + `NextIntlClientProvider`,
  `<html lang={locale}>`, `generateStaticParams` по локалям.

### Профиль пользователя и выбор языка

- Миграция: `users.locale varchar(8) null` (null = не выбирал → согласование по браузеру).
- Переключатель языка — в сайдбаре слушателя и в `/profile` → «Оформление»
  (`components/listener/profile/appearance-settings.tsx`, там уже живут настройки вида).
  Пишет cookie `NEXT_LOCALE` и, для залогиненного, `users.locale` через
  `POST /api/v1/user/profile`.
- Письма и пуш берут локаль из `users.locale`, фолбэк — `ru`.
- Роль/имя в JWT кладутся при логине и не перечитываются — **locale в JWT не кладём**,
  читаем из cookie (клиент) и из БД (письма), иначе смена языка потребует релогина.

### Серверные ошибки → коды

Сейчас `packages/core` кидает готовый русский текст (~115 мест в `services/*`), и он
уходит в JSON API и прямо в тост. Вводим код:

```ts
new ValidationError('Название: 1–200 символов', 'playlist.title_length')
```

- Классы в `packages/core/src/errors.ts` получают опциональное поле `code`.
- Route handlers отдают `{ error: message, code }` — старое поле остаётся ради
  совместимости клиентов и логов.
- Клиент показывает `t(\`errors.\${code}\`)`, фолбэк — `error` с сервера.
- Тексты в `packages/core` остаются русскими как техническое сообщение для логов; переводы
  живут в `messages/*/errors.json`. `packages/core` не узнаёт про i18n — слои не текут.

### Editorial-плейлисты (платформенный текст в БД)

`packages/db/src/queries/editorial.ts` пишет русские заголовки прямо в
`playlists.title/description` и потом ищет их обратным маппингом `MOOD_BY_LABEL` по русской
строке — хрупко и нелокализуемо. Меняем:

- Миграция: `playlists.editorial_kind varchar(32) null`, `playlists.editorial_params jsonb null`.
- Генератор пишет `kind` (`rising` | `returning` | `fresh` | `for_you` | `mood`) + параметры
  (например `{ mood: 'NIGHT' }`); `title/description` продолжают писаться по-русски как
  фолбэк для старых клиентов и админки.
- Рендер берёт `t(\`playlist.editorial.\${kind}\`, params)`; обратный маппинг настроения
  идёт по `editorial_params.mood`, а не по строке заголовка.
- Бэкфилл существующих строк — одноразовым скриптом по текущему `MOOD_BY_LABEL`.

### Форматирование

- `lib/format.ts`: русские `plural/pluralTracks/pluralReleases` и суффиксы `с/м/ч` в
  `formatListenTime` удаляются, заменяются ICU-сообщениями (`{count, plural, …}`).
  `formatDuration`, `formatCount`, `releaseYear`, `totalDuration` остаются как есть —
  они языконезависимы.
- 24 файла с `toLocaleDateString`/`toLocaleString` (сейчас неявная локаль рантайма)
  переводятся на `useFormatter()` / `getFormatter()` из next-intl; в `/admin` остаются
  как есть с явным `'ru-RU'`.

### SEO

- `lib/site.ts`: `SITE_DESCRIPTION`/`SITE_TITLE`/`SITE_LOCALE` перестают быть константами —
  берутся из `seo.json` по локали; `SITE_NAME` и `SITE_URL` остаются константами.
- `lib/metadata.ts::pageMetadata` получает `locale` и проставляет
  `alternates.languages` (hreflang ru/en/x-default) + `openGraph.locale`.
- `sitemap.xml` и шардовые сайтмапы отдают обе локали с `xhtml:link alternate`.
- `manifest.ts`, `structured-data.ts` (`websiteJsonLd`, `artistsCatalogJsonLd`,
  `inLanguage`), `meta-descriptions.ts`, `lib/faq.ts` (FAQ идёт и в UI, и в FAQPage JSON-LD)
  — все локализуются.
- OG-картинки (`lib/og/card.tsx`, 6 `opengraph-image.tsx`) получают локаль из сегмента.

### Защита от регресса

`scripts/check-i18n.mjs` + npm-скрипт `check:i18n` (по образцу `check-route-slugs.mjs`,
вешается на `prebuild` и в CI-job `gates`): падает, если в локализованной зоне
(`app/[locale]/**`, `components/**` кроме `components/admin/**`) встречается кириллический
строковый литерал в JSX-тексте, в пропсах `title/label/placeholder/aria-label` или в
`toast(...)`. Комментарии и `/admin` игнорируются.

Плюс тест на паритет словарей: множества ключей ru и en совпадают, значений-пустышек нет.

## Порядок работ (срезы)

| Срез | Содержание | Зависит от |
|---|---|---|
| 0 | `packages/i18n`, next-intl, `[locale]`-переезд, proxy, навигация, `users.locale`, переключатель языка, `check:i18n` | — |
| A | Оболочка слушателя + публичные страницы (nav, sidebar, tab bar, плеер, главная, каталоги, артист/релиз/трек, поиск, плейлисты, библиотека, профиль) | 0 |
| B | Соцслой: друзья, чат, уведомления, джем, вечеринка | 0 |
| C | Словари и форматирование: moods, genres, platforms, discovery-reason, jam-mode, `format.ts`, даты | 0 |
| D | Дашборд артиста | 0 |
| E | Серверные ошибки: коды в `packages/core`, handlers, клиентский маппинг | 0 |
| F | Письма и пуш по `users.locale` (`email-templates.ts`, `notify-release.worker.ts`, push) | 0 |
| G | Юр. страницы и about (ru→en перевод), FAQ | A |
| H | SEO: hreflang, sitemap, manifest, structured-data, OG-картинки | A |
| I | Editorial-плейлисты (миграция kind/params + бэкфилл) | C |
| J | Тесты (~45 файлов с русскими ассертами), `docs/features/i18n.md`, гейты | всё |

Каждый срез — отдельный прогон с зелёными гейтами; ship одним релизом после J.

## Риски

- **Переезд под `[locale]`** — самая опасная часть: ломает пути в `redirect()`, `Link`,
  тестах, PWA (`public/sw.js` кеширует оболочку по путям), `check:routes`. Срез 0
  выполняется отдельно и верифицируется прогоном dev-сервера + curl по обоим префиксам,
  а не только гейтами (рантайм-баги старта гейты не ловят — см. CLAUDE.md).
- **Объём en-перевода** — ~1400 слов только на юр. страницах и about; переводит сабагент,
  вычитывает Danya.
- **Паритет словарей** ловится тестом, но качество перевода — нет; расхождения смысла
  проверяются точечно.
- **`localePrefix: 'as-needed'`** означает, что ru-URL не меняются → внешние ссылки,
  смартлинки, sitemap, OG и индекс не ломаются. Это осознанный выбор в пользу нулевого
  SEO-риска для существующего трафика.
