# Безмолвная ошибка в алерте называет место

**Дата:** 19.09.2026 · **Статус:** реализовано

## Проблема

С 07.09 в Telegram повторяется один и тот же алерт (07.09, 15.09 ×2, 18.09 ×2, 19.09):

```
🔴 [web] POST /ru: Error без message (digest=3916268529) [action /[locale]]
```

Коммит `ca674bbd` уже дописал в алерт `routeType` и `routePath` — этого хватило,
чтобы понять «server action на главной», и не хватило, чтобы понять что именно упало.

## Что установлено (разбор 19.09)

1. **`/ru` — это `/`.** `localePrefix: 'as-needed'`, next-intl переписывает корень в
   `/ru` внутренним rewrite'ом; `onRequestError` видит путь уже после rewrite.
2. **`action` — не наш server action.** Next помечает `routeType: 'action'` любой POST
   с `x-www-form-urlencoded`/`multipart` (`getServerActionRequestMetadata`
   → `isPossibleServerAction`). На главной наших экшенов нет вообще: единственные
   `'use server'` — `app/admin/actions.ts`, `(auth)/sign-in/auth-actions.ts`,
   `components/listener/profile/account-actions.ts`. Для urlencoded-POST без action-id
   `action-handler.js` возвращает `null`, и страница рендерится как обычная. Значит это
   внешний POST на `/` — почти наверняка бот.
3. **Пустой message — не от Next.** Все ошибки его action-handler'а имеют текст.
   Производитель безмолвной ошибки в нашем стеке — production-сборка **next-intl**:
   `dist/esm/production/react-client/index.js` оборачивает `useTranslations`/`useFormatter`
   в `try{...}catch{throw new Error(void 0)}` — оригинал теряется целиком. Это catch-all,
   а не конкретная ошибка: так приходит ЛЮБОЙ сбой внутри этих хуков. Промах по
   неймспейсу сюда не попадает — он становится `IntlError` через `onError`, не бросается.
4. **Один код-путь.** `digest = stringHash(message + stack)`
   (`create-error-handler.js:102`); digest не менялся с 07.09 по 19.09 через несколько
   деплоев ⇒ стек тот же.

Гипотеза (не доказана): бот POST'ит на `/`, рвёт соединение, React абортит SSR, хук
next-intl падает на этом и его `catch` стирает причину. Косвенно: в `KNOWN_NOISE` уже
лежит `transformAlgorithm is not a function` — тоже обрыв SSR-стрима.

**Почему дальше не продвинуться:** стек вычисляется в `captureError` и выбрасывается
дважды — structured-лог в stderr его не пишет вовсе, а релей `ops/telegram-alert-worker`
пересылает только поле `text`. Логи контейнера стирает деплой.

## Решение

Не ловить ошибку, а сделать следующий её приход самодиагностируемым.

- **`renderSource` в хвост алерта.** Next его отдаёт, `instrumentation.ts` уже кладёт
  в ctx, в текст он не попадал. Различает `react-server-components` (RSC-рендер) и
  `server-rendering` (SSR клиентских компонентов) — для маски next-intl это и есть
  главный разделитель гипотез.
- **Голова стека — только при пустом message.** Условие ровно то же, при котором
  `describeError` уходит в ветку «без message»: `error instanceof Error && !error.message`.
  Шесть верхних кадров, отдельными строками после основной. На алертах с внятным
  текстом ничего не меняется.
- **`stack` в structured-лог** (обрезка 2000, как у вебхука). Сейчас его там нет —
  поход по SSH в логи контейнера бесполезен даже до деплоя.

Троттлинг не ломается: стек стабилен, текст остаётся идентичным между приходами.

## Решено не делать

- **Релей не трогаем.** Он режет `text` до 4000 символов, шесть кадров туда влезают
  с запасом; отдельное поле `stack` в нём потребовало бы деплоя воркера Cloudflare
  ради того, что и так доедет.
- **Патч next-intl, снимающий маску.** Сработал бы, но ломается на каждом апгрейде
  (next-intl уже едет в открытом dependabot-PR), а прок сомнительный: для «нет
  провайдера» оригинал внутри use-intl тоже `new Error(void 0)`.
- **Разворачивать стек по source map.** `.js.map` в сборке есть
  (`enablePrerenderSourceMaps` включён по умолчанию), но standalone-сервер их не
  подключает — кадры приедут минифицированными. Этого хватает: имена чанков Next
  кодируют модуль (`…_app_api_v1_artists_[slug]_page_route_actions_….js`), по ним
  место находится. Включать source map в рантайме — память на VPS 2 ГБ ради одного
  алерта; держим как эскалацию.

## Объём

`apps/web/lib/observability.ts` + его тест, `docs/features/monitoring.md` (там записана
неточность: маскирует next-intl/react-client, а не use-intl). `instrumentation.ts` не
меняется — он уже прокидывает всё нужное.
