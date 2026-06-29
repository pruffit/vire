# Фронт-аудит UI/код (июнь 2026)

Дата: 2026-06-29. Скоуп: `apps/web` (`app/**`, `components/**`, `packages/ui/src/**`).
Контекст: сессия редизайна 404 + `/design` + сквозной аудит площадки.
Статус-метки: ✅ исправлено в этой сессии · ⏸ осознанно отложено · ℹ️ замечание.

## TOP-15 находок

| # | Файл | Проблема | Категория | Статус |
|---|------|----------|-----------|--------|
| 1 | `app/(auth)/sign-in/auth-forms.tsx` | `FormField` — `<label>` не связан с input | a11y HIGH | ✅ обёртка `<label>` вокруг children |
| 2 | `app/(listener)/playlists/[id]/playlist-settings-menu.tsx` | label «Название»/«Описание» без `htmlFor` | a11y HIGH | ✅ `htmlFor` + `id` |
| 3 | `app/(listener)/profile/linked-accounts-client.tsx` | label паролей без `htmlFor` | a11y HIGH | ✅ `htmlFor` + `id` |
| 4 | `components/credits-editor.tsx` | `key={i}` в `AnimatePresence` → битая exit-анимация | rerenders HIGH | ✅ стабильный `_id` |
| 5 | `components/track-share.tsx` | `setTimeout` без cleanup | memory MED | ✅ `timerRef` + cleanup |
| 6 | `components/release-share-button.tsx` | `setTimeout` без cleanup | memory MED | ✅ `timerRef` + cleanup |
| 7 | `components/artist-catalog.tsx` + `artist-hover-chip.tsx` | дубль `pluralReleases` | reuse MED | ✅ → `lib/format.ts` |
| 8 | `profile-card.tsx` + `app/admin/page.tsx` | дубль `plural` | reuse MED | ✅ → `lib/format.ts` |
| 9 | `components/featured-release.tsx` | дубль `releaseYear` | reuse MED | ✅ → `lib/format.ts` |
| 10 | `components/listener/liked-track-row.tsx` | `<div onClick>` без клавиатуры | a11y MED | ✅ `role`/`tabIndex`/`onKeyDown`/`aria-label` |
| 11 | `components/links-editor.tsx` | `key={i}` в мутируемом списке | rerenders MED | ⏸ контролируется родителем, нет AnimatePresence |
| 12 | `components/videos-editor.tsx` | `key={i}` | rerenders MED | ⏸ то же |
| 13 | `components/add-to-playlist-button.tsx` | `inPlaylists` всегда пуст — нет статуса «уже в плейлисте» | functional MED | ⏸ фича (нужен эндпоинт) |
| 14 | `components/easter-eggs.tsx` | `setTimeout` без cleanup | memory LOW | ✅ `useRef` + cleanup |
| 15 | `components/global-search.tsx` | мёртвый `onMouseEnter={() => {}}` | dead code LOW | ✅ удалён |

## По категориям

**Утечки/ресурсы.** Закрыты таймеры в track-share, release-share-button, easter-eggs
(timerRef + clearTimeout + cleanup-effect). Других неубранных слушателей/интервалов/Hls/
обсёрверов аудит не нашёл.

**Рендеры/реконсиляция.** Реальный баг был только в credits-editor (exit-анимация
`AnimatePresence` на `key={i}`) — исправлен стабильным `_id`. links/videos-editor —
тот же паттерн, но без AnimatePresence и под контролем родителя → отложено.

**Переиспользование.** `pluralReleases` добавлен в `lib/format.ts`; убраны локальные копии
`plural`/`releaseYear`/`pluralReleases` из 5 файлов (см. [[feedback-decompose-reuse]]).

**a11y.** Связаны лейблы с инпутами (auth, playlist-settings, смена пароля), добавлен
клавиатурный доступ к строке трека, `sr-only h2` на 404 (был скип h1→h3), контраст
подписей на `/design` поднят до AA.

**Мобилка/app-shell.** Нарушений `min-h-screen`/`h-screen` в коде НЕТ — инвариант
app-shell соблюдён (см. [[feedback-no-prod-down-runtime-gates]]). Таблицы админки —
`overflow-x-auto` корректно. На `/design` починен узкий мобайл (artist-layer грид).

**Tailwind v4.** Легаси-алиасы `bg-gradient-to-*` мигрированы на канонические
`bg-linear-to-*` в 5 файлах; `h-[360px]`/`h-[400px]` → `h-90`/`h-100`.

## Бэклог (следующие заходы)

- links/videos-editor: стабильные ключи, если будет дёргаться фокус/анимации.
- add-to-playlist: загрузка «в каких плейлистах уже есть трек».
- Поэкранная UX-доводка остальных страниц (аудит дал карту, объём отдельных сессий).
