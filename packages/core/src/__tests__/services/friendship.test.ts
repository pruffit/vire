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
