# Соц-слой (первый срез: дружба/профиль/видимость) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в VireMusic двустороннюю дружбу между пользователями, публичную страницу пользователя `/u/[userId]` с гейтом видимости лайков и показом лайков/публичных подборок друзей.

**Architecture:** Слои строго handler→service→repository (см. `vire-architecture`). `FriendshipService` в `packages/core` (порт `IFriendshipRepository` + Drizzle-реализация в `packages/db`), по образцу `FollowService`. HTTP — тонкие адаптеры в `app/api/v1/friends/*`. Видимость лайков гейтит чистая функция `canSeeLikes`. Discovery — шаринг ссылки на профиль. Всё через `Result<T,E>`.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Drizzle ORM (PostgreSQL), Vitest, Zustand-опт не нужен (страничные server components + мелкие client-кнопки), Tailwind + `@vire/ui`.

## Global Constraints

- Слои: handler не знает про БД, сервис не знает про HTTP, `packages/core` не импортирует Next. Ошибки — `Result<T,E>`, не исключения сквозь слои.
- TypeScript `strict: true`, без `any` без причины+коммента. Типы из zod на входе HTTP.
- Комментарии — почти никогда; только неочевидное «почему» в 1–2 строки. Требование и к сабагентам.
- App-shell: **никаких** `min-h-screen`/`h-screen` на страницах/лейаутах. Скролл — область лейаута.
- Мобилка: тач-таргеты ≥44px на кнопках дружбы/заявок; нет горизонтального скролла документа.
- Optimistic UI по умолчанию для интерактивов.
- Динамический сегмент — `[userId]` (не `[id]`); `check:routes` проверяет конфликты имён.
- Гейты перед «готово»: `pnpm --filter @vire/web typecheck`, `@vire/core typecheck`, `@vire/db typecheck`, `@vire/web lint`, `@vire/web check:routes`, `@vire/web test`, `@vire/web audit:design` (трогаем UI), `@vire/web build`.
- Версия бампается в ДВУХ местах: корневой `package.json` + `apps/web/package.json` (1.23.3 → 1.24.0).
- Новая фича не готова без `docs/features/social-friends.md`.

---

## File Structure

**`packages/db`:**
- `src/schema/users.ts` — +enum `userSocialVisibilityEnum`, +колонка `socialVisibility`.
- `src/schema/interactions.ts` — +enum `friendshipStatusEnum`, +таблица `friendships`.
- `src/migrations/0037_*.sql` — сгенерированная миграция (+ ручной CHECK, если drizzle не вынес).
- `src/queries/friendships.ts` — запросы дружбы (findEdge/insert/accept/delete/list/count).
- `src/queries/profile.ts` — +`getUserPublicProfile`, +`updateUserSocialVisibility`.
- `src/queries/playlists.ts` — +`getPublicPlaylistsByOwner`.
- `src/repositories/friendship.ts` — `DrizzleFriendshipRepository`.
- `src/index.ts` — экспорты нового.

**`packages/core`:**
- `src/repositories/friendship.ts` — порт `IFriendshipRepository` + типы.
- `src/services/friendship.ts` — `FriendshipService` + чистая `canSeeLikes`.
- `src/__tests__/services/friendship.test.ts` — тесты сервиса и `canSeeLikes`.
- `src/index.ts` — экспорты (если сервисы/порты реэкспортируются).

**`apps/web`:**
- `app/api/v1/friends/request/route.ts` (POST) + `.test.ts`
- `app/api/v1/friends/[userId]/accept/route.ts` (POST) + `.test.ts`
- `app/api/v1/friends/[userId]/route.ts` (DELETE) + `.test.ts`
- `app/api/v1/user/profile/route.ts` — расширить PATCH (`socialVisibility`) + дополнить `.test.ts`
- `lib/friend-profile.ts` — серверный загрузчик данных `/u/[userId]` (гейт видимости) + `.test.ts`
- `lib/friends.ts` — фабрика `friendshipService()` (DI-обёртка, переиспользуется роутами/хелпером)
- `app/(listener)/u/[userId]/page.tsx` — страница пользователя
- `app/(listener)/friends/page.tsx` — друзья + входящие заявки
- `components/friends/friend-button.tsx` (client, optimistic)
- `components/friends/incoming-requests.tsx` (client)
- `components/friends/share-profile-button.tsx` (client, поверх `components/popover.tsx`)
- `components/listener/library-sidebar.tsx` — +пункт «Друзья» с бейджем
- `app/(listener)/layout.tsx` — +`countIncoming` в данные сайдбара
- `/profile` страница — +тумблер видимости (client-фрагмент)

**Docs:** `docs/features/social-friends.md`, обновить `docs/roadmap/stage-2.md` §11.

---

## Task 1: Схема БД — таблица `friendships` и колонка видимости

**Files:**
- Modify: `packages/db/src/schema/users.ts`
- Modify: `packages/db/src/schema/interactions.ts`
- Create: `packages/db/src/migrations/0037_*.sql` (через `db:generate`)

**Interfaces:**
- Produces: таблица `friendships { id, requesterId, addresseeId, status, createdAt, updatedAt }`, enum `friendship_status` (`PENDING|ACCEPTED`), `users.socialVisibility` (`FRIENDS|PRIVATE`, default `FRIENDS`), enum `user_social_visibility`.

- [ ] **Step 1: Добавить enum и колонку видимости в `users.ts`**

В `packages/db/src/schema/users.ts` добавить после `roleEnum`:
```typescript
export const userSocialVisibilityEnum = pgEnum('user_social_visibility', ['FRIENDS', 'PRIVATE']);
```
И в объект `users` перед `createdAt`:
```typescript
  socialVisibility: userSocialVisibilityEnum('social_visibility').notNull().default('FRIENDS'),
```

- [ ] **Step 2: Добавить enum и таблицу `friendships` в `interactions.ts`**

В начало импортов `packages/db/src/schema/interactions.ts` добавить `check` и `sql`:
```typescript
import {
  pgTable, uuid, text, timestamp, integer, boolean, pgEnum, numeric, unique, index, check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
```
После объявления существующих enum-ов добавить:
```typescript
export const friendshipStatusEnum = pgEnum('friendship_status', ['PENDING', 'ACCEPTED']);
```
В конец файла добавить таблицу:
```typescript
// Двусторонняя дружба. requester — инициатор заявки. accept двигает PENDING→ACCEPTED;
// decline/cancel/unfriend удаляют строку (как unfollow). Обратный дубль ловит сервис.
export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: friendshipStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('friendships_pair_unique').on(t.requesterId, t.addresseeId),
  index('friendships_addressee_idx').on(t.addresseeId),
  index('friendships_requester_idx').on(t.requesterId),
  check('friendships_no_self', sql`${t.requesterId} <> ${t.addresseeId}`),
]);
```

- [ ] **Step 3: Сгенерировать миграцию**

Run: `pnpm --filter @vire/db db:generate`
Expected: создан `src/migrations/0037_*.sql` с `CREATE TYPE`, `ALTER TABLE users`, `CREATE TABLE friendships` (+ CHECK). Открыть файл, убедиться, что CHECK-констрейнт `friendships_no_self` присутствует; если drizzle его не вынес — добавить руками строкой:
```sql
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_no_self" CHECK ("requester_id" <> "addressee_id");
```

- [ ] **Step 4: Проверить типы**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/users.ts packages/db/src/schema/interactions.ts packages/db/src/migrations/
git commit -m "feat(db): friendships table + users.social_visibility (миграция 0037)"
```

---

## Task 2: Запросы и Drizzle-репозиторий дружбы

**Files:**
- Create: `packages/db/src/queries/friendships.ts`
- Create: `packages/db/src/repositories/friendship.ts`
- Modify: `packages/db/src/queries/profile.ts`
- Modify: `packages/db/src/queries/playlists.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: типы порта из `packages/core` (`IFriendshipRepository`, `FriendEdge`, `FriendProfile`, `IncomingRequest`) — они появятся в Task 3; Task 2 реализует их. Порядок реализации: сначала Task 3 (порт), Task 2 подключается к нему. Если исполняется раньше — временно объявить типы локально и в Task 3 свести. **Рекомендация: делать Task 3 перед Task 2.**
- Produces: `friendshipQueries` (findEdge/insertRequest/acceptRequest/deleteEdge/listFriends/listIncoming/countIncoming/userExists), `DrizzleFriendshipRepository`, `getUserPublicProfile`, `updateUserSocialVisibility`, `getPublicPlaylistsByOwner`.

- [ ] **Step 1: Написать модуль запросов дружбы**

Create `packages/db/src/queries/friendships.ts`:
```typescript
import { and, eq, or, count, desc } from 'drizzle-orm';
import { db } from '../client';
import { friendships, users } from '../schema';
import type { FriendEdge, FriendProfile, IncomingRequest } from '@vire/core';

export async function findEdge(a: string, b: string): Promise<FriendEdge | null> {
  const [row] = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId, status: friendships.status })
    .from(friendships)
    .where(or(
      and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
      and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
    ))
    .limit(1);
  return row ?? null;
}

export async function insertRequest(from: string, to: string): Promise<void> {
  await db.insert(friendships).values({ requesterId: from, addresseeId: to }).onConflictDoNothing();
}

export async function acceptRequest(requesterId: string, addresseeId: string): Promise<void> {
  await db.update(friendships).set({ status: 'ACCEPTED', updatedAt: new Date() })
    .where(and(
      eq(friendships.requesterId, requesterId),
      eq(friendships.addresseeId, addresseeId),
      eq(friendships.status, 'PENDING'),
    ));
}

export async function deleteEdge(a: string, b: string): Promise<void> {
  await db.delete(friendships).where(or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  ));
}

export async function listFriends(userId: string): Promise<FriendProfile[]> {
  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      since: friendships.updatedAt,
      reqName: users.name, reqImage: users.image,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.status, 'ACCEPTED'), eq(friendships.addresseeId, userId)))
    .orderBy(desc(friendships.updatedAt));
  const incoming = rows.map((r): FriendProfile => ({ id: r.requesterId, name: r.reqName, image: r.reqImage, since: r.since }));

  const rows2 = await db
    .select({
      addresseeId: friendships.addresseeId,
      since: friendships.updatedAt,
      addrName: users.name, addrImage: users.image,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(and(eq(friendships.status, 'ACCEPTED'), eq(friendships.requesterId, userId)))
    .orderBy(desc(friendships.updatedAt));
  const outgoing = rows2.map((r): FriendProfile => ({ id: r.addresseeId, name: r.addrName, image: r.addrImage, since: r.since }));

  return [...incoming, ...outgoing].sort((x, y) => y.since.getTime() - x.since.getTime());
}

export async function listIncoming(userId: string): Promise<IncomingRequest[]> {
  const rows = await db
    .select({ id: friendships.requesterId, name: users.name, image: users.image, requestedAt: friendships.createdAt })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.status, 'PENDING'), eq(friendships.addresseeId, userId)))
    .orderBy(desc(friendships.createdAt));
  return rows;
}

export async function countIncoming(userId: string): Promise<number> {
  const [row] = await db.select({ count: count() }).from(friendships)
    .where(and(eq(friendships.status, 'PENDING'), eq(friendships.addresseeId, userId)));
  return row?.count ?? 0;
}

export async function userExists(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return !!row;
}
```

- [ ] **Step 2: Написать Drizzle-репозиторий**

Create `packages/db/src/repositories/friendship.ts`:
```typescript
import type { IFriendshipRepository, FriendEdge, FriendProfile, IncomingRequest } from '@vire/core';
import * as q from '../queries/friendships';

export class DrizzleFriendshipRepository implements IFriendshipRepository {
  findEdge(a: string, b: string): Promise<FriendEdge | null> { return q.findEdge(a, b); }
  insertRequest(from: string, to: string): Promise<void> { return q.insertRequest(from, to); }
  acceptRequest(requesterId: string, addresseeId: string): Promise<void> { return q.acceptRequest(requesterId, addresseeId); }
  deleteEdge(a: string, b: string): Promise<void> { return q.deleteEdge(a, b); }
  listFriends(userId: string): Promise<FriendProfile[]> { return q.listFriends(userId); }
  listIncoming(userId: string): Promise<IncomingRequest[]> { return q.listIncoming(userId); }
  countIncoming(userId: string): Promise<number> { return q.countIncoming(userId); }
  userExists(userId: string): Promise<boolean> { return q.userExists(userId); }
}
```

- [ ] **Step 3: Добавить профильные запросы**

В `packages/db/src/queries/profile.ts` добавить:
```typescript
export async function getUserPublicProfile(
  userId: string,
): Promise<{ id: string; name: string | null; image: string | null; socialVisibility: 'FRIENDS' | 'PRIVATE' } | null> {
  const [row] = await db
    .select({ id: users.id, name: users.name, image: users.image, socialVisibility: users.socialVisibility })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function updateUserSocialVisibility(userId: string, v: 'FRIENDS' | 'PRIVATE'): Promise<void> {
  await db.update(users).set({ socialVisibility: v, updatedAt: new Date() }).where(eq(users.id, userId));
}
```

- [ ] **Step 4: Добавить запрос публичных плейлистов владельца**

В `packages/db/src/queries/playlists.ts` добавить (используя существующий тип `PlaylistSummary` и стиль `getUserPlaylists`):
```typescript
export async function getPublicPlaylistsByOwner(ownerUserId: string): Promise<PlaylistSummary[]> {
  const rows = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      visibility: playlists.visibility,
      coverUrl: playlists.coverUrl,
      trackCount: sql<number>`(select count(*) from playlist_tracks pt where pt.playlist_id = ${playlists.id})`,
      updatedAt: playlists.updatedAt,
    })
    .from(playlists)
    .where(and(eq(playlists.ownerUserId, ownerUserId), eq(playlists.visibility, 'PUBLIC'), eq(playlists.kind, 'USER')))
    .orderBy(desc(playlists.updatedAt));
  return rows.map((p) => ({ id: p.id, title: p.title, visibility: p.visibility, coverUrl: p.coverUrl, trackCount: Number(p.trackCount), updatedAt: p.updatedAt }));
}
```
Сверить точную форму `PlaylistSummary` (строки 6–16 файла) и повторить её поля 1:1; если поля отличаются — привести map к фактическому интерфейсу. Убедиться, что `and`, `eq`, `desc`, `sql` импортированы в файле (добавить недостающее в существующий импорт из `drizzle-orm`).

- [ ] **Step 5: Экспорты в `index.ts`**

В `packages/db/src/index.ts` добавить рядом с соседними:
```typescript
export * from './repositories/friendship';
export { findEdge, insertRequest, acceptRequest, deleteEdge, listFriends, listIncoming, countIncoming, userExists } from './queries/friendships';
export { getPublicPlaylistsByOwner } from './queries/playlists';
```
И дополнить существующий экспорт из `./queries/profile` именами `getUserPublicProfile, updateUserSocialVisibility`.

- [ ] **Step 6: Проверить типы**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS (требует, чтобы Task 3 уже объявил порт и типы в `@vire/core`)

- [ ] **Step 7: Commit**

```bash
git add packages/db/src
git commit -m "feat(db): запросы и Drizzle-репозиторий дружбы + профильные хелперы"
```

---

## Task 3: Порт и `FriendshipService` (core, TDD)

**Files:**
- Create: `packages/core/src/repositories/friendship.ts`
- Create: `packages/core/src/services/friendship.ts`
- Create: `packages/core/src/__tests__/services/friendship.test.ts`
- Modify: `packages/core/src/index.ts` (если реэкспортит сервисы/порты — добавить новые)

**Interfaces:**
- Produces:
  - Типы: `FriendshipStatus = 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'SELF'`; `FriendEdge = { requesterId: string; addresseeId: string; status: 'PENDING' | 'ACCEPTED' }`; `FriendProfile = { id: string; name: string | null; image: string | null; since: Date }`; `IncomingRequest = { id: string; name: string | null; image: string | null; requestedAt: Date }`.
  - Порт `IFriendshipRepository` (сигнатуры — как реализует Task 2).
  - `FriendshipService` c методами `request/accept/decline/cancel/unfriend/getStatus/listFriends/listIncoming`.
  - Чистая `canSeeLikes(viewerId, ownerId, ownerVisibility, areFriends)`.

- [ ] **Step 1: Объявить порт и типы**

Create `packages/core/src/repositories/friendship.ts`:
```typescript
export type FriendEdge = { requesterId: string; addresseeId: string; status: 'PENDING' | 'ACCEPTED' };
export type FriendProfile = { id: string; name: string | null; image: string | null; since: Date };
export type IncomingRequest = { id: string; name: string | null; image: string | null; requestedAt: Date };

export interface IFriendshipRepository {
  findEdge(a: string, b: string): Promise<FriendEdge | null>;
  insertRequest(from: string, to: string): Promise<void>;
  acceptRequest(requesterId: string, addresseeId: string): Promise<void>;
  deleteEdge(a: string, b: string): Promise<void>;
  listFriends(userId: string): Promise<FriendProfile[]>;
  listIncoming(userId: string): Promise<IncomingRequest[]>;
  countIncoming(userId: string): Promise<number>;
  userExists(userId: string): Promise<boolean>;
}
```

- [ ] **Step 2: Написать падающие тесты сервиса**

Create `packages/core/src/__tests__/services/friendship.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { FriendshipService, canSeeLikes } from '../../services/friendship';
import { ValidationError, NotFoundError } from '../../errors';
import type { IFriendshipRepository, FriendEdge } from '../../repositories/friendship';

function makeRepo(o?: Partial<IFriendshipRepository>): IFriendshipRepository {
  return {
    findEdge: vi.fn().mockResolvedValue(null),
    insertRequest: vi.fn().mockResolvedValue(undefined),
    acceptRequest: vi.fn().mockResolvedValue(undefined),
    deleteEdge: vi.fn().mockResolvedValue(undefined),
    listFriends: vi.fn().mockResolvedValue([]),
    listIncoming: vi.fn().mockResolvedValue([]),
    countIncoming: vi.fn().mockResolvedValue(0),
    userExists: vi.fn().mockResolvedValue(true),
    ...o,
  };
}
const edge = (requesterId: string, addresseeId: string, status: 'PENDING' | 'ACCEPTED'): FriendEdge => ({ requesterId, addresseeId, status });

describe('FriendshipService.request', () => {
  it('отклоняет заявку самому себе', async () => {
    const repo = makeRepo();
    const r = await new FriendshipService(repo).request('u1', 'u1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
    expect(repo.insertRequest).not.toHaveBeenCalled();
  });

  it('NotFoundError если адресат не существует', async () => {
    const repo = makeRepo({ userExists: vi.fn().mockResolvedValue(false) });
    const r = await new FriendshipService(repo).request('u1', 'ghost');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
  });

  it('создаёт PENDING и возвращает OUTGOING на чистой паре', async () => {
    const repo = makeRepo();
    const r = await new FriendshipService(repo).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'OUTGOING' });
    expect(repo.insertRequest).toHaveBeenCalledWith('u1', 'u2');
  });

  it('встречная PENDING (u2→u1) → сразу дружба', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'PENDING')) });
    const r = await new FriendshipService(repo).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'FRIENDS' });
    expect(repo.acceptRequest).toHaveBeenCalledWith('u2', 'u1');
    expect(repo.insertRequest).not.toHaveBeenCalled();
  });

  it('идемпотентна: своя PENDING → OUTGOING без вставки', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u1', 'u2', 'PENDING')) });
    const r = await new FriendshipService(repo).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'OUTGOING' });
    expect(repo.insertRequest).not.toHaveBeenCalled();
  });

  it('идемпотентна: уже друзья → FRIENDS', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'ACCEPTED')) });
    const r = await new FriendshipService(repo).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'FRIENDS' });
  });
});

describe('FriendshipService.accept', () => {
  it('принимает входящую PENDING', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'PENDING')) });
    const r = await new FriendshipService(repo).accept('u1', 'u2');
    expect(r.ok).toBe(true);
    expect(repo.acceptRequest).toHaveBeenCalledWith('u2', 'u1');
  });
  it('NotFoundError если входящей заявки нет', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(null) });
    const r = await new FriendshipService(repo).accept('u1', 'u2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
  });
  it('NotFoundError если PENDING исходящая (u1→u2), а не входящая', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u1', 'u2', 'PENDING')) });
    const r = await new FriendshipService(repo).accept('u1', 'u2');
    expect(r.ok).toBe(false);
  });
});

describe('FriendshipService.getStatus', () => {
  it('SELF на себе', async () => {
    expect((await new FriendshipService(makeRepo()).getStatus('u1', 'u1'))).toBe('SELF');
  });
  it('NONE без строки', async () => {
    expect((await new FriendshipService(makeRepo()).getStatus('u1', 'u2'))).toBe('NONE');
  });
  it('FRIENDS при ACCEPTED', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'ACCEPTED')) });
    expect((await new FriendshipService(repo).getStatus('u1', 'u2'))).toBe('FRIENDS');
  });
  it('OUTGOING если PENDING исходит от viewer', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u1', 'u2', 'PENDING')) });
    expect((await new FriendshipService(repo).getStatus('u1', 'u2'))).toBe('OUTGOING');
  });
  it('INCOMING если PENDING адресована viewer', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'PENDING')) });
    expect((await new FriendshipService(repo).getStatus('u1', 'u2'))).toBe('INCOMING');
  });
});

describe('canSeeLikes', () => {
  it('владелец видит всегда', () => {
    expect(canSeeLikes('u1', 'u1', 'PRIVATE', false)).toBe(true);
  });
  it('PRIVATE скрывает от друга', () => {
    expect(canSeeLikes('u1', 'u2', 'PRIVATE', true)).toBe(false);
  });
  it('FRIENDS + друзья → видно', () => {
    expect(canSeeLikes('u1', 'u2', 'FRIENDS', true)).toBe(true);
  });
  it('FRIENDS + не друзья → скрыто', () => {
    expect(canSeeLikes('u1', 'u2', 'FRIENDS', false)).toBe(false);
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `pnpm --filter @vire/core test -- friendship`
Expected: FAIL («FriendshipService is not a constructor» / модуль не найден)

- [ ] **Step 4: Реализовать сервис**

Create `packages/core/src/services/friendship.ts`:
```typescript
import { err, ok, ValidationError, NotFoundError, type Result } from '../errors';
import type {
  IFriendshipRepository, FriendProfile, IncomingRequest,
} from '../repositories/friendship';

export type FriendshipStatus = 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'SELF';

export function canSeeLikes(
  viewerId: string,
  ownerId: string,
  ownerVisibility: 'FRIENDS' | 'PRIVATE',
  areFriends: boolean,
): boolean {
  if (viewerId === ownerId) return true;
  if (ownerVisibility === 'PRIVATE') return false;
  return areFriends;
}

export class FriendshipService {
  constructor(private readonly repo: IFriendshipRepository) {}

  async request(from: string, to: string): Promise<Result<FriendshipStatus, ValidationError | NotFoundError>> {
    if (from === to) return err(new ValidationError('Нельзя добавить в друзья самого себя'));
    if (!(await this.repo.userExists(to))) return err(new NotFoundError('User', to));

    const edge = await this.repo.findEdge(from, to);
    if (edge) {
      if (edge.status === 'ACCEPTED') return ok('FRIENDS');
      if (edge.requesterId === from) return ok('OUTGOING');
      await this.repo.acceptRequest(edge.requesterId, edge.addresseeId);
      return ok('FRIENDS');
    }
    await this.repo.insertRequest(from, to);
    return ok('OUTGOING');
  }

  async accept(userId: string, otherId: string): Promise<Result<void, NotFoundError>> {
    const edge = await this.repo.findEdge(userId, otherId);
    if (!edge || edge.status !== 'PENDING' || edge.addresseeId !== userId) {
      return err(new NotFoundError('FriendRequest', otherId));
    }
    await this.repo.acceptRequest(edge.requesterId, edge.addresseeId);
    return ok(undefined);
  }

  async decline(userId: string, otherId: string): Promise<Result<void, never>> {
    await this.repo.deleteEdge(userId, otherId);
    return ok(undefined);
  }

  cancel(userId: string, otherId: string): Promise<Result<void, never>> {
    return this.decline(userId, otherId);
  }

  unfriend(userId: string, otherId: string): Promise<Result<void, never>> {
    return this.decline(userId, otherId);
  }

  async getStatus(viewerId: string, otherId: string): Promise<FriendshipStatus> {
    if (viewerId === otherId) return 'SELF';
    const edge = await this.repo.findEdge(viewerId, otherId);
    if (!edge) return 'NONE';
    if (edge.status === 'ACCEPTED') return 'FRIENDS';
    return edge.requesterId === viewerId ? 'OUTGOING' : 'INCOMING';
  }

  listFriends(userId: string): Promise<FriendProfile[]> { return this.repo.listFriends(userId); }
  listIncoming(userId: string): Promise<IncomingRequest[]> { return this.repo.listIncoming(userId); }
}
```

- [ ] **Step 5: Экспорт из core**

Если `packages/core/src/index.ts` реэкспортит сервисы/порты (проверить соседние: `follow`), добавить:
```typescript
export * from './services/friendship';
export * from './repositories/friendship';
```

- [ ] **Step 6: Запустить тесты — зелёные**

Run: `pnpm --filter @vire/core test -- friendship`
Expected: PASS (все кейсы)

- [ ] **Step 7: Проверить типы core**

Run: `pnpm --filter @vire/core typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): FriendshipService + canSeeLikes + порт (TDD)"
```

---

## Task 4: Роуты `/api/v1/friends/*` (TDD)

**Files:**
- Create: `apps/web/lib/friends.ts`
- Create: `apps/web/app/api/v1/friends/request/route.ts` + `route.test.ts`
- Create: `apps/web/app/api/v1/friends/[userId]/accept/route.ts` + `route.test.ts`
- Create: `apps/web/app/api/v1/friends/[userId]/route.ts` + `route.test.ts`

**Interfaces:**
- Consumes: `FriendshipService`, `DrizzleFriendshipRepository`, `NotFoundError`, `ValidationError`.
- Produces: HTTP-эндпоинты; фабрика `friendshipService()`.

- [ ] **Step 1: Фабрика сервиса**

Create `apps/web/lib/friends.ts`:
```typescript
import { db, DrizzleFriendshipRepository } from '@vire/db';
import { FriendshipService } from '@vire/core';

export function friendshipService() {
  return new FriendshipService(new DrizzleFriendshipRepository(db));
}
```

- [ ] **Step 2: Падающий тест `request`**

Create `apps/web/app/api/v1/friends/request/route.test.ts` по образцу `app/api/v1/tracks/[id]/like/route.test.ts` (мокать `@/auth` и `@vire/db`; проверить: 401 без сессии; 400 на невалидное тело; 429 при rate-limit; успех → `{ status: 'OUTGOING' }`; self → 400/422). Мок `friendshipService` — через `vi.mock('@/lib/friends', ...)`, возвращающий объект с `request: vi.fn()`. Смотреть существующий route-тест как эталон структуры моков.

- [ ] **Step 3: Реализовать `request`**

Create `apps/web/app/api/v1/friends/request/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { NotFoundError, ValidationError } from '@vire/core';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const schema = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`friend-request:${session.user.id}`, 30, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const result = await friendshipService().request(session.user.id, parsed.data.userId);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (result.error instanceof ValidationError) return NextResponse.json({ error: result.error.message }, { status: 422 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ status: result.value });
}
```

- [ ] **Step 4: `request` зелёный**

Run: `pnpm --filter @vire/web test -- friends/request`
Expected: PASS

- [ ] **Step 5: Падающий тест + реализация `accept`**

Create `apps/web/app/api/v1/friends/[userId]/accept/route.test.ts` (401; 404 если заявки нет; успех → `{ ok: true }`).
Create `apps/web/app/api/v1/friends/[userId]/accept/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';
import { NotFoundError } from '@vire/core';

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = await params;
  const result = await friendshipService().accept(session.user.id, userId);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? 'Not found' : 'Forbidden' }, { status });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Падающий тест + реализация `DELETE`**

Create `apps/web/app/api/v1/friends/[userId]/route.test.ts` (401; успех → `{ ok: true }`; вызывает сервис с `(viewerId, userId)`).
Create `apps/web/app/api/v1/friends/[userId]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { friendshipService } from '@/lib/friends';

type Ctx = { params: Promise<{ userId: string }> };

// decline/cancel/unfriend — одно и то же удаление ребра; сервис не различает по контракту REST.
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = await params;
  await friendshipService().unfriend(session.user.id, userId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Гейты роутов**

Run: `pnpm --filter @vire/web test -- friends` и `pnpm --filter @vire/web check:routes`
Expected: PASS (в т.ч. нет конфликта слагов; сегмент `[userId]`)

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/friends.ts apps/web/app/api/v1/friends
git commit -m "feat(api): роуты дружбы friends/request|accept|delete + тесты"
```

---

## Task 5: Видимость профиля через PATCH `/user/profile` (TDD)

**Files:**
- Modify: `apps/web/app/api/v1/user/profile/route.ts`
- Modify: `apps/web/app/api/v1/user/profile/route.test.ts`

**Interfaces:**
- Consumes: `updateUserSocialVisibility` из `@vire/db`.
- Produces: PATCH принимает `{ name? , socialVisibility? }` (хотя бы одно поле).

- [ ] **Step 1: Обновить тест PATCH**

В `apps/web/app/api/v1/user/profile/route.test.ts` добавить кейсы: PATCH с `{ socialVisibility: 'PRIVATE' }` зовёт `updateUserSocialVisibility(uid, 'PRIVATE')` и отвечает `{ ok: true }`; невалидное значение → 400; пустое тело (ни name, ни visibility) → 400. Мок `@vire/db` дополнить `updateUserSocialVisibility: vi.fn()`.

- [ ] **Step 2: Реализовать расширение PATCH**

В `apps/web/app/api/v1/user/profile/route.ts` заменить `schema` и тело PATCH:
```typescript
import { updateUserName, updateUserImage, updateUserSocialVisibility } from '@vire/db';

const schema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  socialVisibility: z.enum(['FRIENDS', 'PRIVATE']).optional(),
}).refine((d) => d.name !== undefined || d.socialVisibility !== undefined, { message: 'Nothing to update' });
```
В обработчике PATCH после парсинга:
```typescript
  const { name, socialVisibility } = parsed.data;
  if (name !== undefined) await updateUserName(session.user.id, name);
  if (socialVisibility !== undefined) await updateUserSocialVisibility(session.user.id, socialVisibility);
  return NextResponse.json({ ok: true, ...(name !== undefined ? { name } : {}), ...(socialVisibility !== undefined ? { socialVisibility } : {}) });
```
Сверить, что существующие тесты «смена имени» проходят (name теперь optional, но валидная строка обрабатывается так же).

- [ ] **Step 3: Тесты профиля зелёные**

Run: `pnpm --filter @vire/web test -- user/profile`
Expected: PASS (старые + новые)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/v1/user/profile
git commit -m "feat(api): PATCH user/profile принимает social_visibility"
```

---

## Task 6: Серверный загрузчик `/u/[userId]` с гейтом видимости (TDD)

**Files:**
- Create: `apps/web/lib/friend-profile.ts`
- Create: `apps/web/lib/friend-profile.test.ts`

**Interfaces:**
- Consumes: `getUserPublicProfile`, `getLikedTracks`, `getPublicPlaylistsByOwner` из `@vire/db`; `friendshipService`, `canSeeLikes` из core.
- Produces: `loadFriendProfile(viewerId: string | null, targetUserId: string): Promise<FriendProfileView | null>` где `FriendProfileView = { id; name; image; status: FriendshipStatus; likes: LikedTrack[]; likesVisible: boolean; playlists: PlaylistSummary[] }`.

- [ ] **Step 1: Падающий тест**

Create `apps/web/lib/friend-profile.test.ts`: мок `@vire/db` (`getUserPublicProfile`, `getLikedTracks`, `getPublicPlaylistsByOwner`) и `@/lib/friends` (`friendshipService` → `{ getStatus }`). Кейсы:
- профиль не найден → `null`;
- гость (`viewerId=null`) на `FRIENDS`-профиле → `likesVisible=false`, `likes=[]`, но `playlists` отданы;
- друг на `FRIENDS`-профиле (`getStatus→'FRIENDS'`) → `likesVisible=true`, `getLikedTracks` вызван;
- друг на `PRIVATE`-профиле → `likesVisible=false`, `getLikedTracks` НЕ вызван;
- сам пользователь (`viewerId===target`) → `likesVisible=true`.

- [ ] **Step 2: Реализация**

Create `apps/web/lib/friend-profile.ts`:
```typescript
import { getUserPublicProfile, getLikedTracks, getPublicPlaylistsByOwner, type LikedTrack, type PlaylistSummary } from '@vire/db';
import { canSeeLikes, type FriendshipStatus } from '@vire/core';
import { friendshipService } from '@/lib/friends';

export type FriendProfileView = {
  id: string;
  name: string | null;
  image: string | null;
  status: FriendshipStatus;
  likesVisible: boolean;
  likes: LikedTrack[];
  playlists: PlaylistSummary[];
};

export async function loadFriendProfile(viewerId: string | null, targetUserId: string): Promise<FriendProfileView | null> {
  const profile = await getUserPublicProfile(targetUserId);
  if (!profile) return null;

  const status: FriendshipStatus = viewerId
    ? await friendshipService().getStatus(viewerId, targetUserId)
    : 'NONE';
  const areFriends = status === 'FRIENDS';
  const likesVisible = viewerId ? canSeeLikes(viewerId, targetUserId, profile.socialVisibility, areFriends) : false;

  const [likes, playlists] = await Promise.all([
    likesVisible ? getLikedTracks(targetUserId) : Promise.resolve([] as LikedTrack[]),
    getPublicPlaylistsByOwner(targetUserId),
  ]);

  return { id: profile.id, name: profile.name, image: profile.image, status, likesVisible, likes, playlists };
}
```

- [ ] **Step 3: Тест зелёный**

Run: `pnpm --filter @vire/web test -- friend-profile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/friend-profile.ts apps/web/lib/friend-profile.test.ts
git commit -m "feat(web): loadFriendProfile — гейт видимости лайков (TDD)"
```

---

## Task 7: Страница `/u/[userId]` + кнопка дружбы + шаринг профиля (UI)

**Files:**
- Create: `apps/web/app/(listener)/u/[userId]/page.tsx`
- Create: `apps/web/components/friends/friend-button.tsx`
- Create: `apps/web/components/friends/share-profile-button.tsx`

**Interfaces:**
- Consumes: `loadFriendProfile`, `auth`, `TrackRow`, `PlaylistCover`/`playlist-card`, `components/popover.tsx`.
- Produces: серверная страница профиля; client `FriendButton` (optimistic по `status`).

- [ ] **Step 1: `FriendButton` (client, optimistic)**

Create `apps/web/components/friends/friend-button.tsx`: пропсы `{ targetUserId: string; initialStatus: FriendshipStatus }`. Состояние `status` локально; действия:
- `NONE` → кнопка «Добавить в друзья» → optimistic `OUTGOING`, `POST /api/v1/friends/request {userId}`; на ошибку — откат.
- `OUTGOING` → «Заявка отправлена» (кнопка отмены) → optimistic `NONE`, `DELETE /api/v1/friends/[userId]`.
- `INCOMING` → две кнопки «Принять» (`POST …/accept` → `FRIENDS`) / «Отклонить» (`DELETE` → `NONE`).
- `FRIENDS` → «В друзьях» с меню/кнопкой «Удалить» (`DELETE` → `NONE`).
- `SELF` → ничего не рендерить.
Тач-таргеты ≥44px; классы токенов `@vire/ui` (`bg-foreground/…`, без pure-gray). Использовать `Icon`. Никаких новых сетевых хелперов — прямой `fetch` (это многосостоятельный контрол, не простой тоггл).

- [ ] **Step 2: `ShareProfileButton` (client)**

Create `apps/web/components/friends/share-profile-button.tsx` по образцу `components/track-share.tsx`/`playlist-share` поверх `components/popover.tsx`: копия ссылки `${origin}/u/${userId}` + `navigator.share` при наличии. Кнопка «Поделиться профилем».

- [ ] **Step 3: Страница**

Create `apps/web/app/(listener)/u/[userId]/page.tsx` (server component):
- `const session = await auth();` → `viewerId = session?.user?.id ?? null`.
- `const view = await loadFriendProfile(viewerId, params.userId)`; `if (!view) notFound();`
- `export const metadata`/`generateMetadata` → `robots: { index: false, follow: false }` (страницы людей не индексируем).
- Разметка: шапка с аватаром (`next/image`) + именем + `FriendButton` (если `viewerId && viewerId !== view.id`) + `ShareProfileButton`. Секция «Лайки» — только если `view.likesVisible` (иначе подпись «Лайки скрыты»/ничего); строки через `TrackRow`. Секция «Публичные плейлисты» — через `PlaylistCover`/`playlist-card`.
- App-shell: без `min-h-screen`; страница заполняет скролл-область (`min-h-full` при нужде).

- [ ] **Step 4: Гейты**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web check:routes && pnpm --filter @vire/web audit:design`
Expected: PASS (audit:design без новых нарушений)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(listener)/u" apps/web/components/friends
git commit -m "feat(web): страница /u/[userId] + кнопка дружбы + шаринг профиля"
```

---

## Task 8: Страница `/friends`, сайдбар-бейдж, тумблер видимости в `/profile` (UI)

**Files:**
- Create: `apps/web/app/(listener)/friends/page.tsx`
- Create: `apps/web/components/friends/incoming-requests.tsx`
- Modify: `apps/web/components/listener/library-sidebar.tsx`
- Modify: `apps/web/app/(listener)/layout.tsx`
- Modify: страница `/profile` (найти: `apps/web/app/(listener)/profile/…`)

**Interfaces:**
- Consumes: `friendshipService().listFriends/listIncoming`, `countIncoming` из `@vire/db`, `FriendButton`.
- Produces: экран друзей; бейдж заявок в сайдбаре; тумблер `socialVisibility`.

- [ ] **Step 1: `IncomingRequests` (client, optimistic)**

Create `apps/web/components/friends/incoming-requests.tsx`: список `{ id, name, image, requestedAt }`; на строке «Принять»/«Отклонить» (те же эндпоинты, что в `FriendButton`), optimistic удаление строки. Тач-таргеты ≥44px.

- [ ] **Step 2: Страница `/friends`**

Create `apps/web/app/(listener)/friends/page.tsx` (server): `auth()` → если гость, `redirect('/sign-in')`. `const svc = friendshipService();` `listIncoming` + `listFriends`. Рендер: блок «Входящие заявки» (`IncomingRequests`) + блок «Друзья» (карточки-ссылки на `/u/[id]`, аватар+имя, кнопка перехода). Пустые состояния: «Пока нет друзей — поделись ссылкой на профиль». App-shell без `min-h-screen`.

- [ ] **Step 3: Данные бейджа в лейауте**

В `apps/web/app/(listener)/layout.tsx` (прочитать целиком): для залогиненного добавить `countIncoming(userId)` (обернуть в `cache()` в `lib/listener-data.ts` по образцу — `export const countIncomingCached = cache(countIncoming)`), передать число в `LibrarySidebar` новым пропсом `incomingCount`.

- [ ] **Step 4: Пункт «Друзья» в сайдбаре**

В `apps/web/components/listener/library-sidebar.tsx` добавить проп `incomingCount?: number` и пункт-ссылку «Друзья» (`href="/friends"`, `Icon name="users"` — сверить наличие иконки в `components/icon`, иначе взять близкую) в блоке «Медиатека»; если `incomingCount > 0` — бейдж-счётчик. Свернутое состояние (`collapsed`) — иконка + бейдж-точка.

- [ ] **Step 5: Тумблер видимости в `/profile`**

Найти профиль-страницу (`apps/web/app/(listener)/profile/…`), добавить client-фрагмент «Приватность»: переключатель `FRIENDS`/`PRIVATE`, `PATCH /api/v1/user/profile { socialVisibility }`, optimistic + пояснение «Друзья видят твои лайки» / «Лайки скрыты от всех». Начальное значение прочитать через `getUserPublicProfile(userId)` (или расширить существующий серверный фетч профиля полем `socialVisibility`).

- [ ] **Step 6: Гейты**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web lint && pnpm --filter @vire/web check:routes && pnpm --filter @vire/web audit:design`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(listener)" apps/web/components
git commit -m "feat(web): экран /friends, бейдж заявок в сайдбаре, тумблер видимости в профиле"
```

---

## Task 9: Документация, версия, финальные гейты, самокритика

**Files:**
- Create: `docs/features/social-friends.md`
- Modify: `docs/roadmap/stage-2.md` (§11 — отметить первый срез)
- Modify: `package.json`, `apps/web/package.json` (версия 1.24.0)
- Modify: CLAUDE.md «Текущий статус» (одна строка про соц-слой — опционально)

- [ ] **Step 1: Фичедок**

Create `docs/features/social-friends.md` по шаблону `docs/features/README.md`: что делает (дружба, профиль, видимость), где код (таблица путей), env (нет новых), ограничения (нет поиска людей, нет активности/чата — следующие срезы), модель `friendships`, гейт `canSeeLikes`.

- [ ] **Step 2: Roadmap**

В `docs/roadmap/stage-2.md` §11: пометить 11.1/11.2/11.3 как ✅ (первый срез, дата 2026-07-18), оставить 11.4/11.5/поиск/блокировку открытыми; обновить сводку сверху.

- [ ] **Step 3: Версия в двух местах**

В корневом `package.json` и `apps/web/package.json` поднять `version` до `1.24.0`.

- [ ] **Step 4: Самокритика отдельным сабагентом**

Дать независимому Sonnet-сабагенту (свежий контекст) прожарить диф по VireMusic review-чеклисту и gotchas: мобилка (узкий вьюпорт, тач-таргеты), дубли (искал ли готовое перед `FriendButton`/`ShareProfileButton`), утечки/ререндеры в client-компонентах, app-shell (`min-h-screen`), краевые случаи гейта видимости, комментарии. Найденное — починить и перепрожарить.

- [ ] **Step 5: Полный прогон гейтов**

Run:
```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/core typecheck
pnpm --filter @vire/db typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
Expected: всё зелёное. Прогнать миграцию локально (`pnpm --filter @vire/db db:migrate`) на dev-БД и вручную проверить путь: отправить заявку → принять с другого аккаунта → увидеть лайки друга при `FRIENDS`, скрытие при `PRIVATE`.

- [ ] **Step 6: Commit**

```bash
git add docs package.json apps/web/package.json CLAUDE.md
git commit -m "docs+chore(social): фичедок, roadmap §11 первый срез, bump 1.24.0"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** `friendships`+enum (T1) · `social_visibility` (T1) · репо/запросы (T2) · `FriendshipService`+`canSeeLikes` (T3) · роуты `request/accept/delete` + rate-limit (T4) · видимость через `user/profile` (T5) · гейт `/u/[userId]` (T6) · страница профиля + кнопка + шаринг (T7) · `/friends`+сайдбар+тумблер (T8) · фичедок+roadmap+версия (T9). Вне среза (11.4/11.5/поиск/блокировка) — не в плане, соответствует спеке.
- **Плейсхолдеры:** код приведён в каждом шаге, где меняется код; UI-шаги описывают конкретные компоненты/пропсы/эндпоинты (детали разметки — по токенам `@vire/ui`, без «add styles»).
- **Согласованность типов:** `FriendEdge/FriendProfile/IncomingRequest/FriendshipStatus` объявлены в T3 и используются 1:1 в T2/T6; методы сервиса (`request/accept/decline/cancel/unfriend/getStatus/listFriends/listIncoming`) и `canSeeLikes(viewerId, ownerId, ownerVisibility, areFriends)` совпадают между T3/T4/T6; сегмент `[userId]` единообразен в T4/T6/T7/T8.
- **Зависимость порядка:** T3 (порт) перед T2 (реализация) — отмечено в T2 Interfaces.
