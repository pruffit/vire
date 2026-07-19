# Внешняя доставка уведомлений + discoverability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Доставлять офлайн-получателю уведомления соцслоя (заявка в друзья, новое сообщение чата) по email и web-push, и дать пользователю скрыть себя из поиска людей.

**Architecture:** Источники событий (`FriendshipService.request`, `ChatService.send`) кладут job в новую очередь BullMQ `notify-external` через инъектируемый порт. Воркер-диспетчер (`apps/worker`) резолвит настройки/подписки получателя, применяет presence-гард и дебаунс, веерит в email (Brevo) и web-push. Чистая функция решения каналов — в `@vire/core`. Тумблер discoverability — отдельный самостоятельный слайс (колонка + фильтр в поиске + переключатель в профиле).

**Tech Stack:** Next.js 15 / TS strict, Drizzle (Postgres), BullMQ + ioredis (Redis), Brevo HTTP API, `web-push` (VAPID), Vitest.

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-19-notification-delivery-discoverability-design.md`.
- Ветка `feat/social-friends`. **Мёрж и деплой — НЕ в этом плане** (после E2EE, по команде; в прод не катим).
- Слои строго: Route (HTTP) → Service (`@vire/core`, framework-free) → Repository (`@vire/db`). `packages/core` не импортирует Next/Drizzle.
- Ошибки как значения (`Result<T,E>`) на фаллибл-путях; zod-валидация любого внешнего входа.
- Комментарии — только неочевидное «почему», 1–2 строки. Никаких «что делает».
- Алерт чата — **контентless** (без текста сообщения). Событий наружу два: `FRIEND_REQUEST`, `CHAT_MESSAGE`. `FRIEND_ACCEPT` наружу НЕ шлём.
- Email по умолчанию включён (`notify_email` default `true`). Все каналы деградируют молча при отсутствии env (VAPID/Brevo/Redis).
- Мобилка обязательна: тач-таргеты ≥44px, без `min-h-screen`/`h-screen`. На UI-задачах гонять `audit:design`.
- Presence-ключ per-user: `presence:user:{userId}`; чат-дебаунс: `notify:chat:emailed:{recipientId}:{conversationId}`.
- Гейты (после каждой задачи, минимум затронутых): `pnpm --filter @vire/web typecheck`, `pnpm --filter @vire/core typecheck`, `pnpm --filter @vire/db typecheck`, `pnpm --filter @vire/web lint`, `pnpm --filter @vire/web test`, `pnpm --filter @vire/core test`. На UI — `pnpm --filter @vire/web audit:design`. В конце — `pnpm --filter @vire/web build`.

---

## Файловая карта

**Данные (`packages/db`)**
- `src/schema/push-subscriptions.ts` — новая таблица.
- `src/schema/users.ts` — +3 колонки.
- `src/schema/index.ts` — реэкспорт новой схемы.
- `src/queries/push-subscriptions.ts` — upsert/deleteByEndpoint/listByUser.
- `src/queries/profile.ts` — `updateUserDiscoverable`, `updateUserNotifyEmail`, `updateUserNotifyPush`, `getUserNotifyContext`.
- `src/queries/user-directory.ts` — фильтр `discoverable`.
- `src/migrations/0040_*.sql` — генерируется drizzle-kit.

**Ядро (`packages/core`)**
- `src/jobs.ts` — `QUEUE_NOTIFY_EXTERNAL`, `ExternalNotifyJobData`.
- `src/ports/external-notify.ts` — `IExternalNotifyQueue`.
- `src/services/external-delivery.ts` — чистая `decideExternalDelivery`.
- `src/notifications/email-templates.ts` — чистые билдеры писем.
- `src/services/friendship.ts`, `src/services/chat.ts` — инъекция порта + enqueue.

**Web (`apps/web`)**
- `lib/queue.ts` — producer `externalNotifyQueue`.
- `lib/friends.ts`, `lib/chat.ts` — прокинуть порт в сервисы.
- `lib/presence.ts` — `markUserOnline` / `isUserOnline`.
- `lib/notify-unsubscribe.ts` — HMAC-отписка уведомлений.
- `app/api/v1/realtime/stream/route.ts` — пометка online.
- `app/api/v1/push/subscribe/route.ts` — POST/DELETE.
- `app/api/v1/notifications/unsubscribe/route.ts` — GET (email opt-out).
- `app/api/v1/user/profile/route.ts` — PATCH принимает `discoverable`/`notifyEmail`/`notifyPush`.
- `public/sw.js` — service worker.
- `components/listener/profile/notification-settings.tsx` — секция настроек (email/push/discoverable).
- `app/(listener)/profile/page.tsx` — вставка секции.

**Воркер (`apps/worker`)**
- `src/lib/brevo.ts` — одиночная отправка письма.
- `src/lib/webpush.ts` — инициализация VAPID + отправка push.
- `src/lib/user-presence.ts` — `isUserOnline` (ioredis).
- `src/lib/notify-debounce.ts` — Redis-дебаунс чата.
- `src/workers/notify-external.worker.ts` — диспетчер.
- `src/index.ts` — регистрация воркера.

---

## Task 1: Схема данных + миграция 0040

**Files:**
- Create: `packages/db/src/schema/push-subscriptions.ts`
- Modify: `packages/db/src/schema/users.ts`, `packages/db/src/schema/index.ts`
- Create (generated): `packages/db/src/migrations/0040_*.sql`

**Interfaces:**
- Produces: таблица `pushSubscriptions`; колонки `users.notifyEmail`, `users.notifyPush`, `users.discoverable`.

- [ ] **Step 1: Добавить колонки в users**

В `packages/db/src/schema/users.ts` внутрь `pgTable('users', {...})` рядом с `socialVisibility`:

```ts
  notifyEmail: boolean('notify_email').notNull().default(true),
  notifyPush: boolean('notify_push').notNull().default(true),
  discoverable: boolean('discoverable').notNull().default(true),
```

Убедиться, что `boolean` импортирован из `drizzle-orm/pg-core` в шапке файла (добавить в существующий импорт при отсутствии).

- [ ] **Step 2: Создать таблицу push_subscriptions**

`packages/db/src/schema/push-subscriptions.ts`:

```ts
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('push_subscriptions_user_id_idx').on(t.userId),
]);
```

- [ ] **Step 3: Реэкспорт**

В `packages/db/src/schema/index.ts` добавить `export * from './push-subscriptions';`.

- [ ] **Step 4: Сгенерировать миграцию**

Run: `pnpm --filter @vire/db db:generate`
Expected: создан `src/migrations/0040_*.sql` c `CREATE TABLE "push_subscriptions"` и тремя `ALTER TABLE "users" ADD COLUMN ... DEFAULT true NOT NULL`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema packages/db/src/migrations
git commit -m "feat(db): push_subscriptions + notify/discoverable колонки (миграция 0040)"
```

---

## Task 2: Фильтр discoverable в поиске людей

**Files:**
- Modify: `packages/db/src/queries/user-directory.ts`
- Test: `packages/db/src/queries/__tests__/user-directory.test.ts` (если каталога нет — создать; иначе добавить кейс рядом с существующими тестами directory)

**Interfaces:**
- Consumes: `users.discoverable` (Task 1).
- Produces: `searchUsersByName` возвращает только `discoverable = true`.

- [ ] **Step 1: Добавить предикат**

В `packages/db/src/queries/user-directory.ts` в `and(...)` добавить `eq(users.discoverable, true)` и импортировать `eq`:

```ts
import { and, asc, eq, ilike, isNotNull, ne } from 'drizzle-orm';
// ...
    .where(and(
      isNotNull(users.name),
      ne(users.id, excludeId),
      eq(users.discoverable, true),
      ilike(users.name, `%${query}%`),
      blockedPairsExpr(excludeId, users.id),
    ))
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS (тест-БД для интеграционного прогона может отсутствовать — фильтр верифицируется на уровне роут-теста в Task 3 и ручного QA; здесь достаточно typecheck).

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/queries/user-directory.ts
git commit -m "feat(db): поиск людей отдаёт только discoverable"
```

---

## Task 3: PATCH user/profile принимает discoverable/notifyEmail/notifyPush

**Files:**
- Modify: `packages/db/src/queries/profile.ts`, `packages/db/src/index.ts` (если реэкспорт queries идёт оттуда — проверить и добавить новые функции)
- Modify: `apps/web/app/api/v1/user/profile/route.ts`
- Test: `apps/web/app/api/v1/user/profile/route.test.ts`

**Interfaces:**
- Consumes: колонки Task 1.
- Produces: `updateUserDiscoverable(userId, value)`, `updateUserNotifyEmail(userId, value)`, `updateUserNotifyPush(userId, value)`; PATCH-схема с новыми полями.

- [ ] **Step 1: Написать падающий тест роута**

В `apps/web/app/api/v1/user/profile/route.test.ts` добавить (мок `@vire/db` уже есть в файле — расширить его новыми функциями):

```ts
it('PATCH принимает discoverable и зовёт updateUserDiscoverable', async () => {
  const { PATCH } = await import('./route');
  const res = await PATCH(new Request('http://x/api/v1/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discoverable: false }),
  }));
  expect(res.status).toBe(200);
  expect(updateUserDiscoverable).toHaveBeenCalledWith('user-1', false);
});
```

(Добавить `updateUserDiscoverable`, `updateUserNotifyEmail`, `updateUserNotifyPush` в `vi.fn()`-мок `@vire/db` в этом файле по образцу `updateUserSocialVisibility`.)

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/web test -- user/profile`
Expected: FAIL (`updateUserDiscoverable` не экспортируется / поле не в схеме).

- [ ] **Step 3: Реализовать queries**

В `packages/db/src/queries/profile.ts` по образцу `updateUserSocialVisibility`:

```ts
export async function updateUserDiscoverable(userId: string, value: boolean): Promise<void> {
  await db.update(users).set({ discoverable: value }).where(eq(users.id, userId));
}
export async function updateUserNotifyEmail(userId: string, value: boolean): Promise<void> {
  await db.update(users).set({ notifyEmail: value }).where(eq(users.id, userId));
}
export async function updateUserNotifyPush(userId: string, value: boolean): Promise<void> {
  await db.update(users).set({ notifyPush: value }).where(eq(users.id, userId));
}
```

Проверить, что эти функции экспортируются наружу пакета (тот же путь реэкспорта, что и `updateUserSocialVisibility`).

- [ ] **Step 4: Расширить PATCH-роут**

В `apps/web/app/api/v1/user/profile/route.ts`:

```ts
import { updateUserName, updateUserImage, updateUserSocialVisibility, updateUserDiscoverable, updateUserNotifyEmail, updateUserNotifyPush } from '@vire/db';

const schema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    socialVisibility: z.enum(['FRIENDS', 'PRIVATE']).optional(),
    discoverable: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nothing to update' });
```

В теле PATCH после существующих веток:

```ts
  const { name, socialVisibility, discoverable, notifyEmail, notifyPush } = parsed.data;
  if (name !== undefined) await updateUserName(session.user.id, name);
  if (socialVisibility !== undefined) await updateUserSocialVisibility(session.user.id, socialVisibility);
  if (discoverable !== undefined) await updateUserDiscoverable(session.user.id, discoverable);
  if (notifyEmail !== undefined) await updateUserNotifyEmail(session.user.id, notifyEmail);
  if (notifyPush !== undefined) await updateUserNotifyPush(session.user.id, notifyPush);
```

Расширить ответ по образцу (спред полей, что были заданы).

- [ ] **Step 5: Прогнать — проходит**

Run: `pnpm --filter @vire/web test -- user/profile`
Expected: PASS.

- [ ] **Step 6: Гейты + commit**

```bash
pnpm --filter @vire/web typecheck && pnpm --filter @vire/db typecheck
git add packages/db/src/queries/profile.ts apps/web/app/api/v1/user/profile/route.ts apps/web/app/api/v1/user/profile/route.test.ts
git commit -m "feat(api): user/profile PATCH принимает discoverable/notifyEmail/notifyPush"
```

---

## Task 4: Общий SettingToggle + тумблер discoverability в профиле

**Files:**
- Create: `apps/web/components/listener/profile/setting-toggle.tsx` — переиспользуемый презентационный тумблер (устраняет дубль между приватностью/discoverability/email — правило Vire «не плодить дубли»).
- Create: `apps/web/components/listener/profile/discoverability-settings.tsx`
- Modify: `apps/web/components/listener/profile/privacy-settings.tsx` — перевести на `SettingToggle`.
- Modify: `apps/web/app/(listener)/profile/page.tsx`

**Interfaces:**
- Produces: `SettingToggle` (пропсы ниже) — используется здесь, Task 17 (email/push) и рефактором `PrivacySettings`.
- Consumes: PATCH `discoverable` (Task 3); текущее `discoverable` из профиля (проп из серверной страницы).

- [ ] **Step 1: Презентационный SettingToggle**

`apps/web/components/listener/profile/setting-toggle.tsx` — только представление (состояние держит владелец):

```tsx
'use client';
import { cn } from '@/lib/utils';

export interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function SettingToggle({ title, description, checked, disabled, onToggle }: SettingToggleProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button" role="switch" aria-checked={checked} aria-label={title}
          disabled={disabled} onClick={onToggle}
          className="shrink-0 grid place-items-center min-h-11 min-w-11 cursor-pointer disabled:opacity-50"
        >
          <span className={cn('relative inline-flex h-6 w-11 items-center rounded-full ring-1 ring-inset transition-colors', checked ? 'bg-primary ring-primary' : 'bg-foreground/15 ring-border')}>
            <span className={cn('absolute left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-5')} />
          </span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Рефактор PrivacySettings на SettingToggle**

В `apps/web/components/listener/profile/privacy-settings.tsx` заменить встроенную разметку `<div class="rounded-xl…"><button role="switch">…` на `<SettingToggle title="Лайки видны друзьям" description={isFriends ? 'Друзья видят твои лайки.' : 'Лайки скрыты от всех.'} checked={isFriends} disabled={pending} onToggle={toggle} />`. Логика `toggle`/`useState`/`fetch` не меняется. Импортировать `SettingToggle`; неиспользуемый `cn` убрать.

- [ ] **Step 3: Компонент discoverability на SettingToggle**

`apps/web/components/listener/profile/discoverability-settings.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { SettingToggle } from './setting-toggle';

export function DiscoverabilitySettings({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const prev = on;
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      const res = await fetch('/api/v1/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoverable: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setOn(prev);
      toast.error('Не удалось сохранить настройку');
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingToggle
      title="Показывать меня в поиске"
      description={on ? 'Другие могут найти тебя по имени.' : 'Ты скрыт из поиска людей.'}
      checked={on}
      disabled={pending}
      onToggle={toggle}
    />
  );
}
```

- [ ] **Step 4: Вставить в профиль**

В `apps/web/app/(listener)/profile/page.tsx` рядом с `PrivacySettings` отрендерить `<DiscoverabilitySettings initial={user.discoverable} />`. Убедиться, что серверный фетч профиля возвращает `discoverable` (расширить select/тип, если нужно).

- [ ] **Step 5: Гейты**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web audit:design`
Expected: PASS.

Проверить мобильную ширину при ручном QA (узкий вьюпорт, тач-таргет 44px — заложен в `SettingToggle`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/listener/profile/setting-toggle.tsx apps/web/components/listener/profile/discoverability-settings.tsx apps/web/components/listener/profile/privacy-settings.tsx "apps/web/app/(listener)/profile/page.tsx"
git commit -m "feat(web): общий SettingToggle + тумблер discoverability"
```

---

## Task 5: Контракты очереди notify-external

**Files:**
- Modify: `packages/core/src/jobs.ts`
- Create: `packages/core/src/ports/external-notify.ts`
- Modify: `packages/core/src/index.ts` (реэкспорт порта, если порты реэкспортируются оттуда — проверить паттерн существующих портов)

**Interfaces:**
- Produces: `QUEUE_NOTIFY_EXTERNAL`, `ExternalNotifyJobData`, `IExternalNotifyQueue`.

- [ ] **Step 1: Константа и тип job**

В `packages/core/src/jobs.ts`:

```ts
export const QUEUE_NOTIFY_EXTERNAL = 'notify-external' as const;

export interface ExternalNotifyJobData {
  kind: 'FRIEND_REQUEST' | 'CHAT_MESSAGE';
  recipientId: string;
  actorId: string;
  conversationId?: string;
}
```

- [ ] **Step 2: Порт**

`packages/core/src/ports/external-notify.ts`:

```ts
import type { ExternalNotifyJobData } from '../jobs';

export interface IExternalNotifyQueue {
  add(data: ExternalNotifyJobData): Promise<void>;
}
```

Реэкспортировать из корневого индекса пакета так же, как реэкспортируются прочие типы (`ExternalNotifyJobData`, `IExternalNotifyQueue`, `QUEUE_NOTIFY_EXTERNAL`).

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @vire/core typecheck`
Expected: PASS.

```bash
git add packages/core/src/jobs.ts packages/core/src/ports/external-notify.ts packages/core/src/index.ts
git commit -m "feat(core): контракты очереди notify-external + порт"
```

---

## Task 6: Чистая функция решения каналов

**Files:**
- Create: `packages/core/src/services/external-delivery.ts`
- Test: `packages/core/src/__tests__/services/external-delivery.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ExternalDeliveryInput { notifyEmail: boolean; notifyPush: boolean; recipientOnline: boolean; emailDebounced: boolean; hasEmail: boolean; pushSubscriptionCount: number; }
  interface ExternalDeliveryDecision { email: boolean; push: boolean; }
  function decideExternalDelivery(input: ExternalDeliveryInput): ExternalDeliveryDecision
  ```

- [ ] **Step 1: Падающий тест**

`packages/core/src/__tests__/services/external-delivery.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideExternalDelivery } from '../../services/external-delivery';

const base = { notifyEmail: true, notifyPush: true, recipientOnline: false, emailDebounced: false, hasEmail: true, pushSubscriptionCount: 2 };

describe('decideExternalDelivery', () => {
  it('онлайн-получателю не шлём ничего', () => {
    expect(decideExternalDelivery({ ...base, recipientOnline: true })).toEqual({ email: false, push: false });
  });
  it('офлайн + оба канала включены → оба', () => {
    expect(decideExternalDelivery(base)).toEqual({ email: true, push: true });
  });
  it('email выключен в prefs → без email', () => {
    expect(decideExternalDelivery({ ...base, notifyEmail: false })).toEqual({ email: false, push: true });
  });
  it('нет email-адреса → без email', () => {
    expect(decideExternalDelivery({ ...base, hasEmail: false })).toEqual({ email: false, push: true });
  });
  it('email в окне дебаунса → без email', () => {
    expect(decideExternalDelivery({ ...base, emailDebounced: true })).toEqual({ email: false, push: true });
  });
  it('нет push-подписок → без push', () => {
    expect(decideExternalDelivery({ ...base, pushSubscriptionCount: 0 })).toEqual({ email: true, push: false });
  });
  it('push выключен в prefs → без push', () => {
    expect(decideExternalDelivery({ ...base, notifyPush: false })).toEqual({ email: true, push: false });
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/core test -- external-delivery`
Expected: FAIL (модуля нет).

- [ ] **Step 3: Реализация**

`packages/core/src/services/external-delivery.ts`:

```ts
export interface ExternalDeliveryInput {
  notifyEmail: boolean;
  notifyPush: boolean;
  recipientOnline: boolean;
  emailDebounced: boolean;
  hasEmail: boolean;
  pushSubscriptionCount: number;
}

export interface ExternalDeliveryDecision {
  email: boolean;
  push: boolean;
}

export function decideExternalDelivery(i: ExternalDeliveryInput): ExternalDeliveryDecision {
  if (i.recipientOnline) return { email: false, push: false };
  return {
    email: i.notifyEmail && i.hasEmail && !i.emailDebounced,
    push: i.notifyPush && i.pushSubscriptionCount > 0,
  };
}
```

Реэкспортировать `decideExternalDelivery` из корневого индекса `@vire/core`.

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm --filter @vire/core test -- external-delivery`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/external-delivery.ts packages/core/src/__tests__/services/external-delivery.test.ts packages/core/src/index.ts
git commit -m "feat(core): decideExternalDelivery — чистое решение каналов"
```

---

## Task 7: Enqueue из FriendshipService.request

**Files:**
- Modify: `packages/core/src/services/friendship.ts`
- Test: `packages/core/src/__tests__/services/friendship.test.ts`

**Interfaces:**
- Consumes: `IExternalNotifyQueue` (Task 5).
- Produces: `FriendshipService` принимает опциональный `externalNotify?: IExternalNotifyQueue` и при `request` зовёт `add({ kind: 'FRIEND_REQUEST', recipientId, actorId })`.

- [ ] **Step 1: Падающий тест**

В `friendship.test.ts` (по образцу существующих тестов сервиса; там уже есть фейки репо/notify):

```ts
it('request кладёт внешнее уведомление получателю', async () => {
  const add = vi.fn();
  const svc = makeService({ externalNotify: { add } }); // расширить фабрику теста опциональным портом
  await svc.request('requester-1', 'addressee-2');
  expect(add).toHaveBeenCalledWith({ kind: 'FRIEND_REQUEST', recipientId: 'addressee-2', actorId: 'requester-1' });
});
```

(Если `request` возвращает `Result` при уже существующей заявке/блоке — тест ставит «чистый» happy-path на новую заявку.)

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/core test -- friendship`
Expected: FAIL.

- [ ] **Step 3: Реализация**

В `packages/core/src/services/friendship.ts`:
- В опции конструктора добавить `externalNotify?: IExternalNotifyQueue` (импорт типа из `../ports/external-notify`).
- В методе `request`, после успешной записи заявки и вызова `notificationService.notify(...)` (или его эквивалента), добавить:

```ts
    await this.externalNotify?.add({ kind: 'FRIEND_REQUEST', recipientId: addresseeId, actorId: requesterId });
```

Порядок: enqueue только на успешном создании новой заявки (не при авто-принятии встречной — там событие `FRIEND_ACCEPT`, наружу не идёт). Enqueue — best-effort, за `?.`; провал очереди не должен валить сам `request` (если `add` может кинуть — обернуть в try/catch с молчаливой деградацией, как прочие best-effort сайд-эффекты).

- [ ] **Step 4: Прогнать — проходит + весь сервис**

Run: `pnpm --filter @vire/core test -- friendship`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/friendship.ts packages/core/src/__tests__/services/friendship.test.ts
git commit -m "feat(core): FriendshipService.request enqueue внешнего уведомления"
```

---

## Task 8: Enqueue из ChatService.send

**Files:**
- Modify: `packages/core/src/services/chat.ts`
- Test: `packages/core/src/__tests__/services/chat.test.ts`

**Interfaces:**
- Consumes: `IExternalNotifyQueue`.
- Produces: `ChatService` принимает `externalNotify?: IExternalNotifyQueue`; `send` зовёт `add({ kind: 'CHAT_MESSAGE', recipientId: toUserId, actorId: fromUserId, conversationId })`.

- [ ] **Step 1: Падающий тест**

В `chat.test.ts`:

```ts
it('send кладёт внешнее уведомление получателю', async () => {
  const add = vi.fn();
  const svc = makeService({ externalNotify: { add } });
  const res = await svc.send('from-1', 'to-2', 'привет');
  expect(res.ok).toBe(true);
  expect(add).toHaveBeenCalledWith(expect.objectContaining({ kind: 'CHAT_MESSAGE', recipientId: 'to-2', actorId: 'from-1' }));
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/core test -- chat`
Expected: FAIL.

- [ ] **Step 3: Реализация**

В `packages/core/src/services/chat.ts`:
- Опция конструктора `externalNotify?: IExternalNotifyQueue`.
- В `send`, после `publish(...)` на `toUserId`/`fromUserId` и перед `return ok(...)`:

```ts
    await this.externalNotify?.add({ kind: 'CHAT_MESSAGE', recipientId: toUserId, actorId: fromUserId, conversationId });
```

Best-effort (не валить `send` при провале очереди).

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm --filter @vire/core test -- chat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/chat.ts packages/core/src/__tests__/services/chat.test.ts
git commit -m "feat(core): ChatService.send enqueue внешнего уведомления"
```

---

## Task 9: Producer + проводка композиции

**Files:**
- Modify: `apps/web/lib/queue.ts`
- Modify: `apps/web/lib/friends.ts`, `apps/web/lib/chat.ts`

**Interfaces:**
- Consumes: `QUEUE_NOTIFY_EXTERNAL`, `ExternalNotifyJobData` (Task 5); опции сервисов (Task 7/8).
- Produces: singleton `externalNotifyQueue` с `add(data)`.

- [ ] **Step 1: Producer**

В `apps/web/lib/queue.ts` по образцу `NotifyReleaseQueue` добавить импорт `QUEUE_NOTIFY_EXTERNAL, type ExternalNotifyJobData` и класс:

```ts
const globalForExternal = globalThis as unknown as { _externalNotifyQueue?: ExternalNotifyQueue };

class ExternalNotifyQueue {
  private q = new Queue<ExternalNotifyJobData>(QUEUE_NOTIFY_EXTERNAL, {
    connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379', maxRetriesPerRequest: null as unknown as number },
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: { count: 200 }, removeOnFail: { count: 100 } },
  });
  async add(data: ExternalNotifyJobData): Promise<void> { await this.q.add('notify-external', data); }
}

export const externalNotifyQueue: ExternalNotifyQueue =
  globalForExternal._externalNotifyQueue ?? new ExternalNotifyQueue();
if (process.env.NODE_ENV !== 'production') { globalForExternal._externalNotifyQueue = externalNotifyQueue; }
```

- [ ] **Step 2: Прокинуть в сервисы**

В `apps/web/lib/friends.ts` (фабрика `friendshipService()`) и `apps/web/lib/chat.ts` (фабрика `chatService()`) добавить в конструктор сервиса опцию `externalNotify: externalNotifyQueue` (импорт из `./queue`).

- [ ] **Step 3: Гейты**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queue.ts apps/web/lib/friends.ts apps/web/lib/chat.ts
git commit -m "feat(web): producer externalNotifyQueue + проводка в сервисы"
```

---

## Task 10: Репозиторий push-подписок

**Files:**
- Create: `packages/db/src/queries/push-subscriptions.ts`
- Modify: `packages/db/src/index.ts` (реэкспорт)
- Test: покрывается на уровне роут-теста Task 11 (интеграционная БД в юнитах отсутствует) — здесь только typecheck.

**Interfaces:**
- Produces:
  ```ts
  function upsertPushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void>
  function deletePushSubscription(endpoint: string): Promise<void>
  function deletePushSubscriptionsByEndpoints(endpoints: string[]): Promise<void>
  function listPushSubscriptions(userId: string): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>>
  ```

- [ ] **Step 1: Реализация**

`packages/db/src/queries/push-subscriptions.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { pushSubscriptions } from '../schema';

export async function upsertPushSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  await db.insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth },
    });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function deletePushSubscriptionsByEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, endpoints));
}

export async function listPushSubscriptions(userId: string): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
  return db.select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
```

Реэкспортировать из `packages/db/src/index.ts`.

- [ ] **Step 2: Добавить getUserNotifyContext**

В `packages/db/src/queries/profile.ts` (или `notifications.ts`) — контекст получателя для воркера:

```ts
export async function getUserNotifyContext(userId: string): Promise<{ email: string | null; name: string | null; notifyEmail: boolean; notifyPush: boolean } | null> {
  const [row] = await db.select({ email: users.email, name: users.name, notifyEmail: users.notifyEmail, notifyPush: users.notifyPush })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function getUserDisplayName(userId: string): Promise<string | null> {
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.name ?? null;
}
```

Реэкспортировать обе.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS.

```bash
git add packages/db/src/queries/push-subscriptions.ts packages/db/src/queries/profile.ts packages/db/src/index.ts
git commit -m "feat(db): репозиторий push-подписок + notify-контекст получателя"
```

---

## Task 11: Роуты подписки на push

**Files:**
- Create: `apps/web/app/api/v1/push/subscribe/route.ts`
- Test: `apps/web/app/api/v1/push/subscribe/route.test.ts`

**Interfaces:**
- Consumes: `upsertPushSubscription`, `deletePushSubscription` (Task 10).
- Produces: `POST` (сохранить подписку), `DELETE` (удалить по endpoint).

- [ ] **Step 1: Падающие тесты**

`apps/web/app/api/v1/push/subscribe/route.test.ts` (мок `@/auth` и `@vire/db` по образцу других роут-тестов):

```ts
it('POST без сессии → 401', async () => {
  authMock.mockResolvedValueOnce(null);
  const { POST } = await import('./route');
  const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }));
  expect(res.status).toBe(401);
});

it('POST валидной подписки → 200 + upsert', async () => {
  const { POST } = await import('./route');
  const body = { endpoint: 'https://push/abc', keys: { p256dh: 'k', auth: 'a' } };
  const res = await POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  expect(res.status).toBe(200);
  expect(upsertPushSubscription).toHaveBeenCalledWith('user-1', { endpoint: 'https://push/abc', p256dh: 'k', auth: 'a' });
});

it('DELETE удаляет по endpoint', async () => {
  const { DELETE } = await import('./route');
  const res = await DELETE(new Request('http://x', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: 'https://push/abc' }) }));
  expect(res.status).toBe(200);
  expect(deletePushSubscription).toHaveBeenCalledWith('https://push/abc');
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/web test -- push/subscribe`
Expected: FAIL (роут не создан).

- [ ] **Step 3: Реализация**

`apps/web/app/api/v1/push/subscribe/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { upsertPushSubscription, deletePushSubscription } from '@vire/db';

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.VAPID_PUBLIC_KEY) return NextResponse.json({ error: 'Push disabled' }, { status: 503 });

  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

  await upsertPushSubscription(session.user.id, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  await deletePushSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Прогнать — проходит + check:routes**

Run: `pnpm --filter @vire/web test -- push/subscribe && pnpm --filter @vire/web check:routes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/v1/push/subscribe
git commit -m "feat(api): push/subscribe POST/DELETE"
```

---

## Task 12: Service worker + клиентская регистрация push

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/lib/push-client.ts` (хелперы подписки)
- (UI-кнопка включения — в Task 17; здесь только сам механизм + хелперы)

**Interfaces:**
- Produces: `subscribeToPush(): Promise<boolean>`, `unsubscribeFromPush(): Promise<void>`, `getPushState(): Promise<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>`.

- [ ] **Step 1: Service worker**

`apps/web/public/sw.js` (обычный JS, без сборки):

```js
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Vire';
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
```

(Проверить, что в `public/` есть `icon-192.png`; манифест уже ссылается на иконки — если имя иное, поправить пути.)

- [ ] **Step 2: Клиентские хелперы**

`apps/web/lib/push-client.ts`:

```ts
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export async function getPushState(): Promise<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? 'subscribed' : 'unsubscribed';
}

export async function subscribeToPush(): Promise<boolean> {
  if (!VAPID || !('serviceWorker' in navigator)) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
  const json = sub.toJSON();
  const res = await fetch('/api/v1/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return res.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await fetch('/api/v1/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
}
```

- [ ] **Step 3: Гейты**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/sw.js apps/web/lib/push-client.ts
git commit -m "feat(web): service worker + клиентские хелперы web-push"
```

---

## Task 13: Per-user presence (online-сигнал)

**Files:**
- Modify: `apps/web/lib/presence.ts`
- Modify: `apps/web/app/api/v1/realtime/stream/route.ts`

**Interfaces:**
- Produces: `markUserOnline(userId): Promise<void>`, `isUserOnline(userId): Promise<boolean>` (ключ `presence:user:{id}`, TTL 40с).

- [ ] **Step 1: Хелперы presence**

В `apps/web/lib/presence.ts` (использовать тот же ioredis-клиент/акцессор, что и остальные функции модуля — сверить имя):

```ts
const USER_PRESENCE_PREFIX = 'presence:user:';
const USER_PRESENCE_TTL_SEC = 40; // > SSE heartbeat (25с)

export async function markUserOnline(userId: string): Promise<void> {
  try { await redis().set(`${USER_PRESENCE_PREFIX}${userId}`, '1', 'EX', USER_PRESENCE_TTL_SEC); } catch { /* нет Redis — деградация */ }
}

export async function isUserOnline(userId: string): Promise<boolean> {
  try { return (await redis().exists(`${USER_PRESENCE_PREFIX}${userId}`)) === 1; } catch { return false; }
}
```

(`redis()` — заменить на реальный акцессор соединения в этом модуле.)

- [ ] **Step 2: Пометка online из SSE-стрима**

В `apps/web/app/api/v1/realtime/stream/route.ts`:
- Импорт `import { markUserOnline } from '@/lib/realtime-presence-import';` — фактически `markUserOnline` живёт в `@/lib/presence`.
- В `start(controller)` после `subscribe(...)`: `void markUserOnline(userId);`
- В интервале heartbeat (каждые 25с) перед/после отправки heartbeat: `void markUserOnline(userId);` — продлевает TTL, пока вкладка открыта.

- [ ] **Step 3: Гейты**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/presence.ts apps/web/app/api/v1/realtime/stream/route.ts
git commit -m "feat(web): per-user online-присутствие через SSE-стрим"
```

---

## Task 14: Чистые билдеры писем

**Files:**
- Create: `packages/core/src/notifications/email-templates.ts`
- Test: `packages/core/src/__tests__/notifications/email-templates.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface FriendRequestEmail { actorName: string | null; appUrl: string; unsubscribeUrl: string | null; }
  interface ChatMessageEmail { actorName: string | null; appUrl: string; unsubscribeUrl: string | null; }
  function friendRequestEmail(i: FriendRequestEmail): { subject: string; html: string }
  function chatMessageEmail(i: ChatMessageEmail): { subject: string; html: string }
  ```
- **Инвариант**: html чата НЕ содержит текста сообщения (контентless).

- [ ] **Step 1: Падающий тест**

```ts
import { describe, it, expect } from 'vitest';
import { friendRequestEmail, chatMessageEmail } from '../../notifications/email-templates';

describe('email-templates', () => {
  it('заявка: имя актора и ссылка на /friends', () => {
    const { subject, html } = friendRequestEmail({ actorName: 'Аня', appUrl: 'https://vire', unsubscribeUrl: 'https://vire/unsub' });
    expect(subject).toContain('Аня');
    expect(html).toContain('https://vire/friends');
    expect(html).toContain('https://vire/unsub');
  });
  it('сообщение: контентless, ссылка на /messages, без текста', () => {
    const { subject, html } = chatMessageEmail({ actorName: 'Аня', appUrl: 'https://vire', unsubscribeUrl: null });
    expect(subject).toContain('Аня');
    expect(html).toContain('https://vire/messages');
    expect(html).not.toContain('secret-body-text');
  });
  it('без имени — нейтральная формулировка', () => {
    expect(friendRequestEmail({ actorName: null, appUrl: 'https://vire', unsubscribeUrl: null }).subject.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/core test -- email-templates`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`packages/core/src/notifications/email-templates.ts` — общий каркас (тёмный шаблон в стиле notify-release), две функции. Тело чата БЕЗ текста сообщения:

```ts
interface Base { actorName: string | null; appUrl: string; unsubscribeUrl: string | null; }

function shell(appUrl: string, heading: string, bodyLine: string, ctaLabel: string, ctaUrl: string, unsubscribeUrl: string | null): string {
  const unsub = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#666">Отписаться от писем</a>`
    : `<a href="${appUrl}/profile" style="color:#666">Настройки уведомлений</a>`;
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">Vire</p>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;line-height:1.3">${heading}</h1>
    <p style="margin:0 0 32px;font-size:14px;color:#aaa">${bodyLine}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">${ctaLabel} →</a>
    <p style="margin:40px 0 0;font-size:12px;color:#444">${unsub}</p>
  </div>
</body></html>`;
}

export function friendRequestEmail(i: Base): { subject: string; html: string } {
  const who = i.actorName ?? 'Кто-то';
  return {
    subject: `${who} отправил вам заявку в друзья на Vire`,
    html: shell(i.appUrl, `${who} хочет добавить вас в друзья`, 'Примите или отклоните заявку на Vire.', 'Открыть заявки', `${i.appUrl}/friends`, i.unsubscribeUrl),
  };
}

export function chatMessageEmail(i: Base): { subject: string; html: string } {
  const who = i.actorName ?? 'Кто-то';
  // Контентless: текст сообщения намеренно не включаем (готовим почву под E2EE).
  return {
    subject: `Новое сообщение от ${who} на Vire`,
    html: shell(i.appUrl, `Новое сообщение от ${who}`, 'Откройте переписку на Vire, чтобы прочитать.', 'Открыть сообщения', `${i.appUrl}/messages`, i.unsubscribeUrl),
  };
}
```

Реэкспортировать обе функции из `@vire/core`.

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm --filter @vire/core test -- email-templates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/notifications/email-templates.ts packages/core/src/__tests__/notifications/email-templates.test.ts packages/core/src/index.ts
git commit -m "feat(core): чистые билдеры писем (заявка/сообщение, чат контентless)"
```

---

## Task 15: HMAC-отписка от email-уведомлений

**Files:**
- Create: `apps/web/lib/notify-unsubscribe.ts`
- Create: `apps/web/app/api/v1/notifications/unsubscribe/route.ts`
- Test: `apps/web/lib/notify-unsubscribe.test.ts`, `apps/web/app/api/v1/notifications/unsubscribe/route.test.ts`

**Interfaces:**
- Produces: `signNotifyUnsub(userId): string | null`, `verifyNotifyUnsub(userId, token): boolean`; GET-роут отписки ставит `notify_email = false`.

- [ ] **Step 1: Падающий тест хелпера**

`apps/web/lib/notify-unsubscribe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { process.env.AUTH_SECRET = 'test-secret'; });

describe('notify-unsubscribe', () => {
  it('подпись верифицируется, тампер — нет', async () => {
    const { signNotifyUnsub, verifyNotifyUnsub } = await import('./notify-unsubscribe');
    const tok = signNotifyUnsub('user-1')!;
    expect(verifyNotifyUnsub('user-1', tok)).toBe(true);
    expect(verifyNotifyUnsub('user-2', tok)).toBe(false);
    expect(verifyNotifyUnsub('user-1', tok + 'x')).toBe(false);
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm --filter @vire/web test -- notify-unsubscribe`
Expected: FAIL.

- [ ] **Step 3: Чистые sign/verify — в `@vire/core` (общие для web и worker)**

Чтобы не дублировать `PURPOSE`/логику между web и воркером (worker не импортирует `apps/web/lib`), чистые функции живут в ядре и принимают секрет параметром.

`packages/core/src/notifications/unsubscribe.ts`:

```ts
import { hmacSign, hmacVerify } from '../signing';

const PURPOSE = 'notify-email-unsub';

export function signNotifyUnsub(secret: string, userId: string): string {
  return hmacSign(secret, `${PURPOSE}:${userId}`);
}

export function verifyNotifyUnsub(secret: string, userId: string, token: string): boolean {
  return hmacVerify(secret, `${PURPOSE}:${userId}`, token);
}
```

(Сверить фактический путь модуля `signing` внутри `packages/core/src` — web импортирует его как `@vire/core/signing`.) Реэкспортировать обе функции из `@vire/core`.

`apps/web/lib/notify-unsubscribe.ts` — тонкая обёртка секретом (сигнатуры для роута/теста без секрета):

```ts
import { signNotifyUnsub as sign, verifyNotifyUnsub as verify } from '@vire/core';
import { getSigningSecret } from './app-secret';

export function signNotifyUnsub(userId: string): string | null {
  const secret = getSigningSecret();
  return secret ? sign(secret, userId) : null;
}

export function verifyNotifyUnsub(userId: string, token: string): boolean {
  const secret = getSigningSecret();
  return secret ? verify(secret, userId, token) : false;
}
```

- [ ] **Step 4: Роут отписки**

`apps/web/app/api/v1/notifications/unsubscribe/route.ts` (GET — ссылка из письма; `uid`+`token` в query):

```ts
import { NextResponse } from 'next/server';
import { updateUserNotifyEmail } from '@vire/db';
import { verifyNotifyUnsub } from '@/lib/notify-unsubscribe';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  if (!uid || !token || !verifyNotifyUnsub(uid, token)) {
    return new NextResponse('Неверная ссылка отписки', { status: 400 });
  }
  await updateUserNotifyEmail(uid, false);
  return new NextResponse('Вы отписаны от email-уведомлений Vire.', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

- [ ] **Step 5: Тест роута**

`apps/web/app/api/v1/notifications/unsubscribe/route.test.ts` (мок `@vire/db`, `AUTH_SECRET=test-secret`): валидный токен → 200 + `updateUserNotifyEmail(uid,false)`; кривой → 400 и без вызова.

- [ ] **Step 6: Прогнать всё + check:routes**

Run: `pnpm --filter @vire/web test -- notifications/unsubscribe notify-unsubscribe && pnpm --filter @vire/web check:routes`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/notifications/unsubscribe.ts packages/core/src/index.ts apps/web/lib/notify-unsubscribe.ts apps/web/lib/notify-unsubscribe.test.ts apps/web/app/api/v1/notifications/unsubscribe
git commit -m "feat: HMAC-отписка от email-уведомлений (core-логика + web-обёртка + роут)"
```

---

## Task 16: Воркер-диспетчер notify-external

**Files:**
- Create: `apps/worker/src/lib/brevo.ts`, `apps/worker/src/lib/webpush.ts`, `apps/worker/src/lib/user-presence.ts`, `apps/worker/src/lib/notify-debounce.ts`
- Create: `apps/worker/src/workers/notify-external.worker.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/src/workers/__tests__/notify-external.worker.test.ts` (структура тестов воркера — по образцу существующих в `apps/worker`)

**Interfaces:**
- Consumes: `getUserNotifyContext`, `getUserDisplayName`, `listPushSubscriptions`, `deletePushSubscriptionsByEndpoints` (`@vire/db`); `decideExternalDelivery`, `friendRequestEmail`, `chatMessageEmail`, `signNotifyUnsub` (core, секрет параметром — Task 15), `ExternalNotifyJobData`, `QUEUE_NOTIFY_EXTERNAL` (`@vire/core`).
- Produces: `createNotifyExternalWorker()`.

> Подпись отписки НЕ дублируется: воркер импортирует `signNotifyUnsub(secret, userId)` из `@vire/core` (Task 15) и подаёт секрет из env сам (`process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET`). PURPOSE живёт в одном месте (ядро).

- [ ] **Step 1: Brevo single-send**

`apps/worker/src/lib/brevo.ts`:

```ts
function brevoSender(): { name?: string; email: string } {
  const raw = process.env.SMTP_FROM ?? 'Vire <noreply@viremusic.ru>';
  const m = raw.match(/^(.+?)\s*<(.+?)>$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { email: raw };
}

export async function sendBrevoEmail(to: { email: string; name?: string | null }, subject: string, html: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return; // email-канал деградирует молча
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ sender: brevoSender(), subject, htmlContent: html, to: [to.name ? { email: to.email, name: to.name } : { email: to.email }] }),
  });
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${await res.text()}`);
}
```

- [ ] **Step 2: web-push отправка**

`apps/worker/src/lib/webpush.ts`:

```ts
import webpush from 'web-push';

let configured = false;
function ensure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
  return true;
}

export interface StoredSub { endpoint: string; p256dh: string; auth: string }

/** Возвращает endpoints, которые мертвы (410/404) — их надо удалить. */
export async function sendPush(subs: StoredSub[], payload: { title: string; body: string; url: string; tag?: string }): Promise<string[]> {
  if (!ensure() || subs.length === 0) return [];
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 410 || code === 404) dead.push(s.endpoint);
    }
  }));
  return dead;
}
```

- [ ] **Step 3: presence + debounce хелперы воркера**

`apps/worker/src/lib/user-presence.ts` (ioredis, тот же ключ, что web):

```ts
import Redis from 'ioredis';
let client: Redis | null = null;
function redis(): Redis {
  if (!client) { client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: false }); client.on('error', () => {}); }
  return client;
}
export async function isUserOnline(userId: string): Promise<boolean> {
  try { return (await redis().exists(`presence:user:${userId}`)) === 1; } catch { return false; }
}
```

`apps/worker/src/lib/notify-debounce.ts`:

```ts
import Redis from 'ioredis';
let client: Redis | null = null;
function redis(): Redis {
  if (!client) { client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: false }); client.on('error', () => {}); }
  return client;
}
const TTL_SEC = 15 * 60;
/** true = в окне дебаунса (письмо уже слали), false = можно слать (и ставит флаг). Ошибка Redis → false (fail-open). */
export async function chatEmailDebounced(recipientId: string, conversationId: string): Promise<boolean> {
  try {
    const key = `notify:chat:emailed:${recipientId}:${conversationId}`;
    const set = await redis().set(key, '1', 'EX', TTL_SEC, 'NX');
    return set === null; // NX не сработал → ключ уже был → дебаунс активен
  } catch { return false; }
}
```

- [ ] **Step 4: Диспетчер**

`apps/worker/src/workers/notify-external.worker.ts`:

```ts
import { Worker, type Job } from 'bullmq';
import { QUEUE_NOTIFY_EXTERNAL, type ExternalNotifyJobData, decideExternalDelivery, friendRequestEmail, chatMessageEmail, signNotifyUnsub } from '@vire/core';
import { getUserNotifyContext, getUserDisplayName, listPushSubscriptions, deletePushSubscriptionsByEndpoints } from '@vire/db';
import { connection } from '../queues/connection.js';
import { sendBrevoEmail } from '../lib/brevo.js';
import { sendPush } from '../lib/webpush.js';
import { isUserOnline } from '../lib/user-presence.js';
import { chatEmailDebounced } from '../lib/notify-debounce.js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SIGNING_SECRET = process.env.LINK_SIGNING_SECRET || process.env.AUTH_SECRET || null;

async function handle(job: Job<ExternalNotifyJobData>): Promise<void> {
  const { kind, recipientId, actorId, conversationId } = job.data;

  const ctx = await getUserNotifyContext(recipientId);
  if (!ctx) return;

  const online = await isUserOnline(recipientId);
  const subs = await listPushSubscriptions(recipientId);
  const emailDebounced = kind === 'CHAT_MESSAGE' && conversationId
    ? await chatEmailDebounced(recipientId, conversationId)
    : false;

  const decision = decideExternalDelivery({
    notifyEmail: ctx.notifyEmail,
    notifyPush: ctx.notifyPush,
    recipientOnline: online,
    emailDebounced,
    hasEmail: !!ctx.email,
    pushSubscriptionCount: subs.length,
  });

  if (!decision.email && !decision.push) return;

  const actorName = await getUserDisplayName(actorId);

  if (decision.email && ctx.email) {
    const token = SIGNING_SECRET ? signNotifyUnsub(SIGNING_SECRET, recipientId) : null;
    const unsubscribeUrl = token ? `${APP_URL}/api/v1/notifications/unsubscribe?uid=${recipientId}&token=${token}` : null;
    const tpl = kind === 'FRIEND_REQUEST'
      ? friendRequestEmail({ actorName, appUrl: APP_URL, unsubscribeUrl })
      : chatMessageEmail({ actorName, appUrl: APP_URL, unsubscribeUrl });
    await sendBrevoEmail({ email: ctx.email, name: ctx.name }, tpl.subject, tpl.html);
  }

  if (decision.push) {
    const who = actorName ?? 'Кто-то';
    const payload = kind === 'FRIEND_REQUEST'
      ? { title: 'Заявка в друзья', body: `${who} хочет добавить вас в друзья`, url: `${APP_URL}/friends`, tag: 'friend-request' }
      : { title: 'Новое сообщение', body: `Новое сообщение от ${who}`, url: `${APP_URL}/messages`, tag: conversationId ?? 'chat' };
    const dead = await sendPush(subs, payload);
    if (dead.length) await deletePushSubscriptionsByEndpoints(dead);
  }
}

export function createNotifyExternalWorker() {
  return new Worker<ExternalNotifyJobData>(QUEUE_NOTIFY_EXTERNAL, handle, { connection, concurrency: 4 });
}
```

- [ ] **Step 5: Регистрация воркера**

В `apps/worker/src/index.ts`: импорт `createNotifyExternalWorker` и `const notifyExternalWorker = createNotifyExternalWorker();`, добавить `.on('failed', ...)`/`.on('error', ...)` по образцу соседних воркеров (через `alertJobFailure`/`alertWorkerError`).

- [ ] **Step 6: Тест диспетчера**

`apps/worker/src/workers/__tests__/notify-external.worker.test.ts` — вынести `handle` в экспорт (или тестировать через фабрику с моками). Замокать `@vire/db`, `../lib/brevo`, `../lib/webpush`, `../lib/user-presence`, `../lib/notify-debounce`. Кейсы:
- online=true → ни `sendBrevoEmail`, ни `sendPush` не вызваны;
- офлайн, оба канала → `sendBrevoEmail` + `sendPush` вызваны;
- `sendPush` вернул мёртвый endpoint → `deletePushSubscriptionsByEndpoints` вызван с ним;
- CHAT_MESSAGE с активным дебаунсом → без email, но push есть.

(Для тестируемости выделить `handle` как экспортируемую функцию, принимающую `job.data`.)

- [ ] **Step 7: Прогнать + typecheck воркера**

Run: `pnpm --filter @vire/worker test 2>/dev/null; pnpm --filter @vire/worker typecheck 2>/dev/null || npx tsc -p apps/worker --noEmit`
Expected: PASS (сверить, как гоняются тесты/typecheck воркера в этом репо; при отсутствии отдельного скрипта — согласовать с CI-таском turbo).

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/lib apps/worker/src/workers/notify-external.worker.ts apps/worker/src/workers/__tests__/notify-external.worker.test.ts apps/worker/src/index.ts
git commit -m "feat(worker): диспетчер notify-external — presence-гард, дебаунс, email+push, прунинг"
```

---

## Task 17: UI — секция «Уведомления» в профиле

**Files:**
- Create: `apps/web/components/listener/profile/notification-settings.tsx`
- Modify: `apps/web/app/(listener)/profile/page.tsx`

**Interfaces:**
- Consumes: PATCH `notifyEmail` (Task 3); `subscribeToPush`/`unsubscribeFromPush`/`getPushState` (Task 12).

- [ ] **Step 1: Компонент**

`notification-settings.tsx` — клиентский компонент, **переиспользует `SettingToggle`** (Task 4), две строки:
- email-строка: `SettingToggle` с состоянием `notifyEmail`, PATCH `{ notifyEmail }` (оптимистично, откат+toast на ошибку — как `DiscoverabilitySettings`).
- push-строка при монтировании читает `getPushState()`; статусы: `unsupported` → `SettingToggle` disabled с описанием «Пуши не поддерживаются этим браузером»; `denied` → disabled с подсказкой разблокировать в настройках браузера; `subscribed`/`unsubscribed` → `SettingToggle`, `onToggle` зовёт `subscribeToPush()`/`unsubscribeFromPush()` и оптимистично обновляет состояние; на провал `subscribeToPush` (permission не выдан) — откат + toast.
- Тач-таргеты/aria — уже внутри `SettingToggle`, свой не изобретать.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { getPushState, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';
// ... email-тумблер копирует паттерн PrivacySettings, PATCH { notifyEmail }
```

(Полную разметку строк собрать из паттерна `PrivacySettings`/`DiscoverabilitySettings`, переиспользуя классы токенов; не плодить новый визуальный стиль.)

- [ ] **Step 2: Вставить в профиль и убрать дубль**

В `app/(listener)/profile/page.tsx`: отрендерить единый блок «Уведомления» — `NotificationSettings` (email + push) рядом с `DiscoverabilitySettings` (Task 4) и `PrivacySettings`. Прокинуть `initialNotifyEmail={user.notifyEmail}` из серверного фетча.

- [ ] **Step 3: Гейты (UI)**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web audit:design`
Expected: PASS.

Ручной QA: узкий вьюпорт, тач-таргеты; включение push → браузерный permission-промпт → подписка улетает на `/api/v1/push/subscribe`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/listener/profile/notification-settings.tsx "apps/web/app/(listener)/profile/page.tsx"
git commit -m "feat(web): секция «Уведомления» в профиле (email + push)"
```

---

## Task 18: Env, доки, версия, финальные гейты

**Files:**
- Modify: `.env.example`
- Modify: `docs/features/notifications.md`, `docs/features/social-friends.md`, `docs/roadmap/stage-2.md`
- Modify: `package.json` (корень), `apps/web/package.json`

**Interfaces:** —

- [ ] **Step 1: Env**

В `.env.example` добавить блок:

```
# Web-push (VAPID). Генерация: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@viremusic.ru
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

- [ ] **Step 2: Доки**

- `docs/features/notifications.md`: секция «Внешняя доставка» — очередь `notify-external`, каналы email/push, presence-гард, дебаунс чата, контентless-алерт чата, env VAPID, ограничения (нет пуша для FRIEND_ACCEPT, iOS-требование установленной PWA). Снять из «Ограничений» пункт «Нет письма/пуша».
- `docs/features/social-friends.md`: discoverability-тумблер.
- `docs/roadmap/stage-2.md` §11.6: отметить discoverability-тумблер и пуш/письмо как ✅ (дата 2026-07-19), обновить «Осталось».

- [ ] **Step 3: web-push dep + lockfile**

Убедиться, что `web-push` добавлен в `apps/worker/package.json` (dependencies) и `@types/web-push` в devDependencies. Затем:

Run: `pnpm install`
Expected: обновлён `pnpm-lock.yaml`.

- [ ] **Step 4: Версия в двух местах**

Поднять `version` в корневом `package.json` и `apps/web/package.json` (текущая 1.26.0 → 1.27.0).

- [ ] **Step 5: Полный прогон гейтов**

Run:
```bash
pnpm --filter @vire/web typecheck && pnpm --filter @vire/core typecheck && pnpm --filter @vire/db typecheck && \
pnpm --filter @vire/web lint && pnpm --filter @vire/web check:routes && \
pnpm --filter @vire/web test && pnpm --filter @vire/core test && \
pnpm --filter @vire/web audit:design && pnpm --filter @vire/web build
```
Expected: всё зелёное.

- [ ] **Step 6: Commit**

```bash
git add .env.example docs package.json apps/web/package.json pnpm-lock.yaml
git commit -m "docs+chore(social): доки/env внешних уведомлений + discoverability, bump 1.27.0"
```

---

## Финал (после всех задач)

- **Самокритика** — независимый сабагент (Sonnet, свежий контекст): прожарить диф по Vire-чеклисту (мобилка, дубли, утечки, layout-shell, presence fail-open, дебаунс-гонки, 410-прунинг, отсутствие текста сообщения в письме/пуше/логах).
- **Верификация рантайма**: поднять dev (web+worker), пройти сценарий — заявка офлайн-другу → письмо+пуш; сообщение офлайн-другу → контентless-алерт; онлайн-получатель → тишина; тумблер скрывает из поиска.
- **Мёрж НЕ делаем** — ждём E2EE-спеку и явную команду. В прод не катим.

## Self-review плана (сверка со спекой)

- Тумблер discoverable: Task 1 (колонка), 2 (фильтр), 3 (PATCH), 4 (UI). ✓
- Очередь/диспетчер: Task 5 (контракты), 6 (решение каналов), 7/8 (enqueue), 9 (producer), 16 (воркер). ✓
- Web-push: Task 1 (таблица), 10 (репо), 11 (роуты), 12 (SW+клиент), 16 (отправка+прунинг), 17 (UI). ✓
- Email: Task 14 (шаблоны), 15 (отписка), 16 (отправка). ✓
- Presence-гард: Task 13 (web-сигнал), 16 (проверка в воркере). ✓
- Дебаунс чата: Task 16. ✓
- Контентless чат-алерт: Task 14 (инвариант в тесте), 16 (push-payload). ✓
- Env/доки/версия: Task 18. ✓
- Плейсхолдеров нет; типы (`ExternalNotifyJobData`, `decideExternalDelivery`, `IExternalNotifyQueue`, `StoredSub`) согласованы между задачами.
