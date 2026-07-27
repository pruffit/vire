# Спека: точечная зачистка core + уникализация meta-descriptions

Дата: 2026-07-17. Взято из §1 «инженерка без продуктовых решений» (TODO.md / stage-2.md §1.2, §1.7, контент-SEO).

## Контекст и триаж скоупа

Первичный аудит показал, что большая часть §1 уже закрыта:
- `play_events` прямые инсерты — **закрыто** (очередь `QUEUE_PLAY_EVENTS` + воркер).
- Чистота `packages/core`: `new Date()`/`Math.random()` в `packages/core/src` — 0 вхождений
  (эффекты инъектируются), `Result<T,E>` раскатан.

Остаются две безопасные, чисто инженерные задачи (ниже). Явно **дескоуплено**:
- **JWT refresh** — фикс регрессирует намеренно выбранный статик-рендеринг/перф ради редкого
  папер-ката с обходом (релогин). Остаётся в `TECHNICAL_DEBT.md`.
- **Playlist `create` narrowing** — синтезируемые поля семантически верны для нового плейлиста;
  сужение порта = churn на 4 файла без функциональной пользы. Остаётся в `TECHNICAL_DEBT.md`.
- **bio артистов** — авторский контент, не генерим. **schema.org/OG валидация** — внешнее/ручное.

## Задача A — `NotFoundError.resource` (структурный тег ресурса)

**Проблема.** `apps/web/app/api/v1/playlists/[id]/tracks/route.ts:37` различает 404 «Playlist»
vs «Track» через `error.message.startsWith('Track')` — сломается молча при смене формата
сообщения `NotFoundError`.

**Решение.** Хранить `resource` в `NotFoundError` (первый аргумент конструктора уже везде
передаётся — 30+ call-sites, менять их не нужно).

- `packages/core/src/errors.ts`: `readonly resource: string;`, присвоить в конструкторе.
  Экспортный контракт (`message`, `name`, `_tag`) не менять — только добавить поле.
- Роут: `error.resource === 'Track' ? 'Track not found' : 'Not found'`. Убрать хрупкий коммент.
- Тексты ответов и коды — **1:1** с прежним поведением (никаких видимых изменений API).

**Тесты.**
- `packages/core/src/__tests__/errors.test.ts`: `resource` доступен и равен переданному.
- Route-тест плейлистов (если ассертит текст 404 Track/Playlist) — проходит без правок логики.

## Задача B — уникализация фолбэка meta-description релиза и трека

**Проблема.** Фолбэк описания одинаков по форме у всех релизов:
`${title} — релиз ${artist} на VireMusic.` (`releases/[releaseId]/page.tsx:54`), у трека —
`${fullTitle} · ${release.title} — ${artist} на VireMusic.` (`.../tracks/[trackId]/page.tsx:63`).
Дубль-подобные мета-описания вредят SEO.

**Решение.** Чистый хелпер в `apps/web/lib/meta-descriptions.ts` (новый файл), варьирующий текст
по доступным на объекте данным — **без новых запросов в БД**:
- `releaseMetaDescription({ title, artistName, type, year, trackCount })`
- `trackMetaDescription({ trackTitle, releaseTitle, artistName, year })`

Форма варьируется по типу релиза (сингл/EP/альбом → разные слова) и наличию года/кол-ва треков;
при отсутствии данных — грациозная деградация к короткой форме. Всегда возвращает непустую строку.
`release.description` (заданное артистом) по-прежнему имеет приоритет над фолбэком.

Использовать доступные поля доменного `Release` (проверить тип: `type`, `releaseDate` → год,
`tracks.length`). Не тянуть жанры отдельным запросом — только то, что уже загружено.

**Тесты.** `apps/web/lib/__tests__/meta-descriptions.test.ts` (или рядом по конвенции):
- разные типы релиза дают разный текст;
- отсутствие года/кол-ва треков не ломает (нет «undefined», нет висящих скобок);
- всегда непустая строка.

## Слои / архитектура (vire-architecture)

- `errors.ts` — доменный слой `packages/core`, поле-тег корректно тут.
- Хелпер meta-descriptions — чистая функция в `apps/web/lib` (presentation-утилита, не бизнес-логика,
  в core не нужна — используется только в Next-метадате).

## Гейты
`typecheck` (web+core), `lint`, `check:routes`, `test`, `build`. UI-рендер не трогаем →
`audit:design` не обязателен (метадата, не разметка).

## Не в скоупе
JWT refresh, playlist create narrowing, bio, внешняя валидация разметки — см. «Дескоуплено».
