import { describe, it, expect, vi } from 'vitest';
import { FriendshipService, canSeeLikes } from '../../services/friendship';
import { ValidationError, NotFoundError, ForbiddenError } from '../../errors';
import type { IFriendshipRepository, FriendEdge } from '../../repositories/friendship';
import type { INotificationRepository } from '../../repositories/notification';
import type { IBlockRepository } from '../../repositories/block';

function makeRepo(o?: Partial<IFriendshipRepository>): IFriendshipRepository {
  return {
    findEdge: vi.fn().mockResolvedValue(null),
    insertRequest: vi.fn().mockResolvedValue(undefined),
    acceptRequest: vi.fn().mockResolvedValue(undefined),
    deleteEdge: vi.fn().mockResolvedValue(undefined),
    listFriends: vi.fn().mockResolvedValue([]),
    listIncoming: vi.fn().mockResolvedValue([]),
    userExists: vi.fn().mockResolvedValue(true),
    listEdges: vi.fn().mockResolvedValue([]),
    countUnseenIncoming: vi.fn().mockResolvedValue(0),
    markRequestsSeen: vi.fn().mockResolvedValue(undefined),
    ...o,
  };
}
function makeNotifications(o?: Partial<INotificationRepository>): INotificationRepository {
  return {
    insert: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    countUnread: vi.fn().mockResolvedValue(0),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    ...o,
  };
}
function makeBlocks(o?: Partial<IBlockRepository>): IBlockRepository {
  return {
    block: vi.fn().mockResolvedValue(undefined),
    unblock: vi.fn().mockResolvedValue(undefined),
    existsEitherWay: vi.fn().mockResolvedValue(false),
    listBlocked: vi.fn().mockResolvedValue([]),
    ...o,
  };
}
function makeService(o?: {
  repo?: Partial<IFriendshipRepository>;
  notifications?: Partial<INotificationRepository>;
  blocks?: Partial<IBlockRepository>;
}) {
  return new FriendshipService(makeRepo(o?.repo), makeNotifications(o?.notifications), makeBlocks(o?.blocks));
}
const edge = (requesterId: string, addresseeId: string, status: 'PENDING' | 'ACCEPTED'): FriendEdge => ({ requesterId, addresseeId, status });

describe('FriendshipService.request', () => {
  it('отклоняет заявку самому себе', async () => {
    const repo = makeRepo();
    const r = await makeService({ repo }).request('u1', 'u1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
    expect(repo.insertRequest).not.toHaveBeenCalled();
  });

  it('NotFoundError если адресат не существует', async () => {
    const repo = makeRepo({ userExists: vi.fn().mockResolvedValue(false) });
    const r = await makeService({ repo }).request('u1', 'ghost');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
  });

  it('ForbiddenError при блоке в любую сторону', async () => {
    const blocks = makeBlocks({ existsEitherWay: vi.fn().mockResolvedValue(true) });
    const repo = makeRepo();
    const r = await makeService({ repo, blocks }).request('u1', 'u2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ForbiddenError);
    expect(repo.insertRequest).not.toHaveBeenCalled();
  });

  it('создаёт PENDING, возвращает OUTGOING и уведомляет адресата', async () => {
    const repo = makeRepo();
    const notifications = makeNotifications();
    const r = await makeService({ repo, notifications }).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'OUTGOING' });
    expect(repo.insertRequest).toHaveBeenCalledWith('u1', 'u2');
    expect(notifications.insert).toHaveBeenCalledWith('u2', 'FRIEND_REQUEST', 'u1', null);
  });

  it('встречная PENDING (u2→u1) → сразу дружба, уведомление FRIEND_ACCEPT инициатору (u2)', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'PENDING')) });
    const notifications = makeNotifications();
    const r = await makeService({ repo, notifications }).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'FRIENDS' });
    expect(repo.acceptRequest).toHaveBeenCalledWith('u2', 'u1');
    expect(repo.insertRequest).not.toHaveBeenCalled();
    expect(notifications.insert).toHaveBeenCalledWith('u2', 'FRIEND_ACCEPT', 'u1', null);
  });

  it('идемпотентна: своя PENDING → OUTGOING без вставки и без уведомления', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u1', 'u2', 'PENDING')) });
    const notifications = makeNotifications();
    const r = await makeService({ repo, notifications }).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'OUTGOING' });
    expect(repo.insertRequest).not.toHaveBeenCalled();
    expect(notifications.insert).not.toHaveBeenCalled();
  });

  it('идемпотентна: уже друзья → FRIENDS без уведомления', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'ACCEPTED')) });
    const notifications = makeNotifications();
    const r = await makeService({ repo, notifications }).request('u1', 'u2');
    expect(r).toEqual({ ok: true, value: 'FRIENDS' });
    expect(notifications.insert).not.toHaveBeenCalled();
  });
});

describe('FriendshipService.accept', () => {
  it('принимает входящую PENDING и уведомляет инициатора', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'PENDING')) });
    const notifications = makeNotifications();
    const r = await makeService({ repo, notifications }).accept('u1', 'u2');
    expect(r.ok).toBe(true);
    expect(repo.acceptRequest).toHaveBeenCalledWith('u2', 'u1');
    expect(notifications.insert).toHaveBeenCalledWith('u2', 'FRIEND_ACCEPT', 'u1', null);
  });
  it('NotFoundError если входящей заявки нет', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(null) });
    const r = await makeService({ repo }).accept('u1', 'u2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
  });
  it('NotFoundError если PENDING исходящая (u1→u2), а не входящая', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u1', 'u2', 'PENDING')) });
    const r = await makeService({ repo }).accept('u1', 'u2');
    expect(r.ok).toBe(false);
  });
});

describe('FriendshipService.getStatus', () => {
  it('SELF на себе', async () => {
    expect((await makeService().getStatus('u1', 'u1'))).toBe('SELF');
  });
  it('NONE без строки', async () => {
    expect((await makeService().getStatus('u1', 'u2'))).toBe('NONE');
  });
  it('FRIENDS при ACCEPTED', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'ACCEPTED')) });
    expect((await makeService({ repo }).getStatus('u1', 'u2'))).toBe('FRIENDS');
  });
  it('OUTGOING если PENDING исходит от viewer', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u1', 'u2', 'PENDING')) });
    expect((await makeService({ repo }).getStatus('u1', 'u2'))).toBe('OUTGOING');
  });
  it('INCOMING если PENDING адресована viewer', async () => {
    const repo = makeRepo({ findEdge: vi.fn().mockResolvedValue(edge('u2', 'u1', 'PENDING')) });
    expect((await makeService({ repo }).getStatus('u1', 'u2'))).toBe('INCOMING');
  });
});

describe('FriendshipService.getStatuses', () => {
  it('пустой список id → пустая карта, без запроса рёбер', async () => {
    const repo = makeRepo();
    const map = await makeService({ repo }).getStatuses('u1', []);
    expect(map.size).toBe(0);
    expect(repo.listEdges).not.toHaveBeenCalled();
  });

  it('SELF на своём id, без запроса рёбер для него', async () => {
    const repo = makeRepo();
    const map = await makeService({ repo }).getStatuses('u1', ['u1']);
    expect(map.get('u1')).toBe('SELF');
    expect(repo.listEdges).not.toHaveBeenCalled();
  });

  it('один батч-запрос рёбер на весь список, статусы разложены по каждому id', async () => {
    const repo = makeRepo({
      listEdges: vi.fn().mockResolvedValue([
        edge('u2', 'u1', 'ACCEPTED'),
        edge('u1', 'u3', 'PENDING'),
        edge('u4', 'u1', 'PENDING'),
      ]),
    });
    const map = await makeService({ repo }).getStatuses('u1', ['u2', 'u3', 'u4', 'u5']);
    expect(repo.listEdges).toHaveBeenCalledTimes(1);
    expect(repo.listEdges).toHaveBeenCalledWith('u1', ['u2', 'u3', 'u4', 'u5']);
    expect(map.get('u2')).toBe('FRIENDS');
    expect(map.get('u3')).toBe('OUTGOING');
    expect(map.get('u4')).toBe('INCOMING');
    expect(map.get('u5')).toBe('NONE');
  });
});

describe('FriendshipService.countUnseen', () => {
  it('делегирует в репозиторий', async () => {
    const repo = makeRepo({ countUnseenIncoming: vi.fn().mockResolvedValue(3) });
    const n = await makeService({ repo }).countUnseen('u1');
    expect(n).toBe(3);
    expect(repo.countUnseenIncoming).toHaveBeenCalledWith('u1');
  });
});

describe('FriendshipService.markSeen', () => {
  it('делегирует в репозиторий', async () => {
    const repo = makeRepo();
    await makeService({ repo }).markSeen('u1');
    expect(repo.markRequestsSeen).toHaveBeenCalledWith('u1');
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
