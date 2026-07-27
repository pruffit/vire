# План — Соцслой ч.2 (блок/жалобы/уведомления + активность + чат)

Спека: `docs/superpowers/specs/2026-07-18-social-slice2-design.md`. Ветка `feat/social-friends`.
Следующая миграция — `0039`. Роутинг: фундамент и треки — Sonnet-сабагенты; самокритика —
независимый Sonnet; оркестрация/арбитраж — главная Opus-сессия.

## DAG

```
FND (фундамент, sequential)
 ├─► A (§11.6 UI)      ┐
 ├─► B (§11.5 чат)     ├─ параллельно
 └─► C (§11.4 актив.)  ┘
        └─► NAV (свод навигации, sequential после A/B)
              └─► CRIT (самокритика) ─► FIX ─► GATES ─► SHIP(merge)
```

Контеншен по навигации (`components/nav.tsx`, `listener/library-sidebar.tsx`,
`listener/mobile-tab-bar.tsx`, `listener/listener-sidebar.tsx`) разведён: треки A/B/C НЕ
трогают навигацию — только создают свои компоненты (колокольчик, точки входа). Отдельный
шаг NAV вклеивает их в навигацию одним агентом, чтобы не было конфликтов.

---

## FND — фундамент (Sonnet, TDD на core)

Один агент, держит всю модель данных в контексте. По спеке §«Порядок» п.1.

1. **Схема** (`packages/db/src/schema/`): `user_blocks`, `reports` (+enums
   `report_target_type`/`report_status`) в `interactions.ts`; `notifications` (+enum
   `notification_type`) в новом `notifications.ts`; `conversations`+`messages` в новом
   `chat.ts`. Экспорт из `schema/index.ts`. Индексы/чеки/unique — по спеке.
2. **Миграция**: `pnpm --filter @vire/db db:generate` → `0039_*`. Проверить SQL глазами
   (enum'ы, чеки `<>`/`<`, unique-пары).
3. **Queries** (`packages/db/src/queries/`): `blocks.ts`, `reports.ts`, `notifications.ts`,
   `chat.ts` — сигнатуры из спеки. Даты — `now()` в SQL, не JS-Date. Колонки в raw-sql не
   интерполировать (см. gotchas).
4. **Порты** (`packages/core/src/repositories/`): `IBlockRepository`, `IReportRepository`,
   `INotificationRepository`, `IChatRepository`. **Порт** `RealtimePublisher`
   (`packages/core/src/ports/realtime.ts`): `publish(userId, event): void|Promise<void>`.
5. **Drizzle-репо** (`packages/db/src/repositories/`): по образцу
   `DrizzleFriendshipRepository`.
6. **Core-сервисы** (`packages/core/src/services/`) + Vitest-тесты (TDD):
   - `BlockService` — block (транзакция: insert + удалить friendship-ребро), unblock,
     isBlocked (either-way), listBlocked. Идемпотентность block.
   - `ReportService` — submit (валидация reason zod 1..500, анти-дубль OPEN на пару),
     listOpen, count, resolve.
   - `NotificationService` — notify (insert + `publisher.publish`), list, countUnread,
     markAllRead, markRead.
   - `ChatService` — openOrGet (канон пары least/greatest), send (guard друзья+блок,
     валидация body 1..4000, insert, update last_message_at/last_read, publish), history,
     markRead, listConversations, countUnread. Инъекции: chat-репо, friendship-рид, block-рид,
     `RealtimePublisher`.
   - Расширить `FriendshipService`: обязательная инъекция `INotificationRepository` (+ блок-рид
     для guard в `request`). request → notify(FRIEND_REQUEST) адресату; авто-принятие встречной →
     notify(FRIEND_ACCEPT) инициатору; accept → notify(FRIEND_ACCEPT) инициатору. `request`
     возвращает `ForbiddenError` при блоке (расширить union ошибок).
     ⚠️ Не сломать существующие вызовы/тесты `FriendshipService` — обновить композицию
     `apps/web/lib/friends.ts` и все фейки в тестах.
7. **`errors.ts`**: `ForbiddenError` уже введён в прошлом срезе (§1.2) — переиспользовать.
8. **`apps/web/lib/realtime.ts`**: `publish` (основной redis), синглтон-подписчик (отдельный
   ioredis, PSUBSCRIBE `rt:*`, EventEmitter fan-out), `subscribe(userId, cb): () => void`.
   Деградация без Redis, `.on('error')`.
9. **Композиция веба** (`apps/web/lib/`): `blocks.ts`, `reports.ts`, `notifications.ts`,
   `chat.ts` — фабрики сервисов с Drizzle-репо и `RealtimePublisher` поверх `lib/realtime.ts`.

**Гейты FND:** `typecheck @vire/db @vire/core @vire/web`, `test @vire/core`, `test @vire/web`
(не сломаны существующие). НЕ мёрджить — вернуть отчёт.

---

## A — §11.6 UI блок/жалоба/админка (Sonnet)

Зависит от FND (сервисы блок/жалоба/уведомления).
- Роуты: `app/api/v1/users/[userId]/block/route.ts` (POST/DELETE), `app/api/v1/reports/route.ts`
  (POST, rate-limit 5/час), `app/api/v1/admin/reports/[id]/resolve/route.ts` (MODERATOR+),
  `app/api/v1/notifications/route.ts` (GET), `app/api/v1/notifications/read/route.ts` (POST).
- UI: `components/friends/block-button.tsx`, `components/friends/report-button.tsx` (модалка
  причины), `components/notifications/notification-bell.tsx` (поповер, `components/popover.tsx`,
  SSE-подписка через `lib/realtime` client hook — см. B, координировать hook).
- Профиль `/u/[userId]`: вклеить блок/жалобу в поповер рядом с `FriendButton`; при блоке —
  скрыть лайки/чат, показать «Разблокировать».
- Админка: `app/admin/reports/page.tsx` (дизайн-кит `components/admin/ui.tsx`), счётчик OPEN в
  обзоре «требует внимания». Пункт сайдбара админки — в шаге NAV? Нет, админ-сайдбар отдельный
  (`app/admin/layout.tsx`) — трогает A, не пересекается со слушательской навигацией.
- Тесты роутов (права/валидация/rate-limit). Мобилка, `audit:design`.

## B — §11.5 чат (Sonnet)

Зависит от FND (ChatService, realtime).
- SSE-роут `app/api/v1/realtime/stream/route.ts` (auth, `runtime='nodejs'`, ReadableStream,
  heartbeat 25с, cleanup по signal). Клиентский хук `lib/use-realtime.ts` (EventSource,
  реконнект, диспатч по type) — общий для чата и колокольчика (координировать с A).
- Chat-роуты: `chat/messages` (POST send), `chat/[conversationId]/messages` (GET history),
  `chat/[conversationId]/read` (POST). Rate-limit на send.
- Страницы: `app/(listener)/messages/page.tsx`, `.../messages/[conversationId]/page.tsx`.
- UI: `components/chat/{conversation-list,chat-thread,message-composer,message-bubble}.tsx`.
  Оптимистичная отправка, автоскролл, SSE-инкремент. Кнопка «Написать» на `/u/[userId]`.
- app-shell: тред — скролл внутри списка сообщений (`overflow-y-auto` + `min-h-0`), НЕ
  `h-screen`/`min-h-screen`. Тесты (guard друзья+блок, валидация body, SSE auth). Мобилка,
  `audit:design`.

## C — §11.4 активность друзей (Sonnet)

Зависит от FND (нужны блок-рид + friendship). Самая изолированная.
- Query `getFriendsActivity(userId, limit)` в `@vire/db` (UNION ALL лайки/подписки/плейлисты
  друзей, приватность по `social_visibility`, минус блок, сорт+лимит в SQL).
- `apps/web/lib/activity.ts`: `FriendActivityItem` + чистая сборка/сорт, тест.
- Секция главной (`home-sections.tsx` за Suspense, `fallback={null}`), переиспользуя
  `FriendLikedTrackRow`/`PlaylistCard`/карточку артиста + аватар друга. Тест приватности.

## NAV — свод навигации (Sonnet, после A/B)

Вклеить в слушательскую навигацию: колокольчик (из A) в `components/nav.tsx`; пункт
«Сообщения» с unread-бейджем в `library-sidebar.tsx`/`listener-sidebar.tsx`/`mobile-tab-bar.tsx`.
unread-счётчики через `lib/listener-data.ts` (React `cache()`, как `countUnseenIncomingCached`).
Один агент — чтобы правки навигации не конфликтовали.

## CRIT → FIX → GATES → SHIP
- CRIT: независимый Sonnet прожаривает диф по VireMusic-чеклисту + gotchas (мобилка, дубли, утечки
  SSE-листенеров, layout-shell, приватность/блок-гейты, N+1 в activity/conversations).
- FIX: закрыть найденное.
- GATES: typecheck(web/core/db)·lint·check:routes·test·audit:design·build — весь вывод.
- SHIP: фичедоки (`social-friends.md` + `notifications.md` + `chat.md`), отметки в
  `stage-2.md`/`TODO.md`, bump версии в двух `package.json`, lockfile если менялись deps,
  коммиты по логическим кускам, **мёрдж `feat/social-friends` → main** (пользователь
  авторизовал «вынеси в мейн»).
```
