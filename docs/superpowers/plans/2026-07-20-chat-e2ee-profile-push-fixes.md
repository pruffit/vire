# План: багфикс-пачка чат/E2EE/профиль/push

Спека: `docs/superpowers/specs/2026-07-20-chat-e2ee-profile-push-fixes.md`.
Ветка `fix/chat-e2ee-profile-push` от `origin/main`. Два независимых потока.

## Поток A — чат-экран + E2EE + привязка

### A1. Высота чата и футер — чистый CSS `:has()`, без клиент-компонентов
- `apps/web/app/(listener)/messages/[conversationId]/page.tsx`: корневому div
  добавить атрибут `data-app-screen`.
- `apps/web/app/(listener)/layout.tsx`:
  - обёртка: `+ [&:has([data-app-screen])]:h-full` (мобилка получает цепочку высот);
  - панель: `+ [&:has([data-app-screen])]:min-h-0`;
  - `<div className="flex-1">{children}</div>` → `+ [&:has([data-app-screen])]:min-h-0`;
  - футер: обернуть `<Footer/>` не нужно — на панель добавить
    `[&:has([data-app-screen])_[data-site-footer]]:hidden`, а в `components/footer.tsx`
    корню — `data-site-footer` (или обёртка-div в layout с этим атрибутом).
- НЕ добавлять безусловный `min-h-0` (сломает обычные страницы — flex-сжатие),
  НЕ `h-screen`/`100vh` (инвариант app-shell).

### A2. Empty-state треда
- `components/chat/chat-thread.tsx`: при `messages.length === 0` и готовом `ck` —
  центрированный empty-state в скролл-области (иконка + «Напишите первое сообщение.
  Переписка защищена сквозным шифрованием»). Переиспользовать `EmptyState` из
  `components/ui-kit`, если подходит по стилю.

### A3. Глобальный бутстрап ключей
- Новый `components/chat/e2ee-bootstrap.tsx` ('use client', рендерит null):
  вызывает `getBootstrap(userId)`-логику через `useIdentity(userId)`.
- Смонтировать там, где сессия доступна для ВСЕХ залогиненных страниц —
  проверить `app/layout.tsx` (root, рядом с Nav); если auth() там нет — добавить.
  Гость → не рендерить.

### A4. Поллинг ключа собеседника
- `chat-thread.tsx`: `otherIkPub` → в state; пока null — раз в ~8с GET
  `/api/v1/keys?userId={otherUserId}`; появился → state, ck оживает, композер
  включается. Копия: «Собеседник ещё не открывал VireMusic — как только зайдёт,
  переписка станет доступна». Интервал чистить в cleanup.

### A5. Привязка устройства из любого места
- Из `device-link.tsx` извлечь A-сторону (onLinkRequest + approve-форма) в
  отдельный `components/chat/link-approve.tsx`, рендер — fixed-оверлей
  (bottom-right, поверх контента, z над плеером), смонтировать глобально рядом
  с E2eeBootstrap (A-сторона активна только когда identity.priv есть).
- B-сторона (кнопка «Привязать», SAS-код) остаётся в DeviceLink на /messages;
  добавить состояние ожидания («Откройте VireMusic на другом устройстве — там появится
  запрос подтверждения») и кнопку «Отмена» (abort + сброс).
- Обновить `device-link.test.tsx` под рефактор.

### A6. Сброс шифрования (fallback из needsLink)
- `lib/e2ee.ts`: добавить `resetIdentity(selfId)` — удалить локальную личность,
  сгенерировать новую (не через bootstrap-guard).
- `device-link.tsx` (needsLink-карточка): вторичная кнопка «Сбросить шифрование…»
  → инлайн-подтверждение с честным предупреждением («история переписок станет
  нечитаемой у вас и собеседников») → resetIdentity → POST /api/v1/keys → reload.
- `chat-thread.tsx` (needsLink-плашка): ссылка «Перейти к привязке» на /messages.

## Поток B — профиль + push

### B1. Карточки подписок
- `components/listener/followed-artists.tsx`:
  - grid → `grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]` (адаптив к ширине колонки);
  - «верифицирован» → иконка-чек рядом с именем (`shrink-0`, sr-only подпись),
    вторую строку убрать; имя — truncate уже есть, добавить min-w-0 куда нужно.
  - Проверить второе место использования (библиотека) — не сломать.

### B2. Push-диагностика
- `lib/push-client.ts`:
  - `VAPID` → `.trim()`; guard `typeof Notification !== 'undefined'` в getPushState;
  - `subscribeToPush` → возвращает `{ ok: true } | { ok: false; reason: 'permission' | 'sw' | 'push-service' | 'server' }`,
    каждый шаг в своём try/catch; ошибку логировать `console.error` для диагностики.
- `components/listener/profile/notification-settings.tsx`: тосты по reason:
  permission → «Разреши уведомления в браузере», sw/push-service → «Браузер не смог
  подписаться — push-сервис недоступен», server → «Сервер не принял подписку».
  Состояние denied обновлять после отказа.

## Гейты (в конце, главной сессией)
typecheck (web/core/db) → lint → check:routes → test → audit:design → build.
Самокритика отдельным сабагентом до гейтов.
