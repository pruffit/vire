import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendFriendRequest, removeFriendEdge, acceptFriendRequest } = vi.hoisted(() => ({
  sendFriendRequest: vi.fn(),
  removeFriendEdge: vi.fn(),
  acceptFriendRequest: vi.fn(),
}));
vi.mock('../friends', () => ({ sendFriendRequest, removeFriendEdge, acceptFriendRequest }));

import { createFriendActionStore } from '../use-friend-action';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createFriendActionStore: NONE -> request()', () => {
  it('оптимистично переключает в OUTGOING и шлёт запрос', async () => {
    sendFriendRequest.mockResolvedValue({ ok: true, data: { status: 'OUTGOING' } });
    const store = createFriendActionStore('u1', 'NONE');

    const promise = store.getState().request();

    expect(store.getState().status).toBe('OUTGOING');
    expect(store.getState().pending).toBe(true);
    await promise;

    expect(store.getState().status).toBe('OUTGOING');
    expect(store.getState().pending).toBe(false);
    expect(sendFriendRequest).toHaveBeenCalledWith('u1');
  });

  it('ошибка сети — откатывает в NONE', async () => {
    sendFriendRequest.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });
    const store = createFriendActionStore('u1', 'NONE');

    await store.getState().request();

    expect(store.getState().status).toBe('NONE');
    expect(store.getState().pending).toBe(false);
  });
});

describe('createFriendActionStore: OUTGOING -> remove()', () => {
  it('оптимистично переключает в NONE и шлёт DELETE', async () => {
    removeFriendEdge.mockResolvedValue({ ok: true, data: { ok: true } });
    const store = createFriendActionStore('u1', 'OUTGOING');

    const promise = store.getState().remove();
    expect(store.getState().status).toBe('NONE');
    await promise;

    expect(store.getState().status).toBe('NONE');
    expect(removeFriendEdge).toHaveBeenCalledWith('u1');
  });

  it('ошибка сети — откатывает в OUTGOING', async () => {
    removeFriendEdge.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });
    const store = createFriendActionStore('u1', 'OUTGOING');

    await store.getState().remove();

    expect(store.getState().status).toBe('OUTGOING');
    expect(store.getState().pending).toBe(false);
  });
});

describe('createFriendActionStore: INCOMING -> accept()', () => {
  it('оптимистично переключает в FRIENDS и шлёт POST accept', async () => {
    acceptFriendRequest.mockResolvedValue({ ok: true, data: { ok: true } });
    const store = createFriendActionStore('u1', 'INCOMING');

    const promise = store.getState().accept();
    expect(store.getState().status).toBe('FRIENDS');
    await promise;

    expect(store.getState().status).toBe('FRIENDS');
    expect(acceptFriendRequest).toHaveBeenCalledWith('u1');
  });

  it('ошибка сети — откатывает в INCOMING', async () => {
    acceptFriendRequest.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });
    const store = createFriendActionStore('u1', 'INCOMING');

    await store.getState().accept();

    expect(store.getState().status).toBe('INCOMING');
  });
});

describe('createFriendActionStore: INCOMING -> remove() (decline)', () => {
  it('оптимистично переключает в NONE и шлёт DELETE', async () => {
    removeFriendEdge.mockResolvedValue({ ok: true, data: { ok: true } });
    const store = createFriendActionStore('u1', 'INCOMING');

    await store.getState().remove();

    expect(store.getState().status).toBe('NONE');
    expect(removeFriendEdge).toHaveBeenCalledWith('u1');
  });

  it('ошибка сети — откатывает в INCOMING', async () => {
    removeFriendEdge.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });
    const store = createFriendActionStore('u1', 'INCOMING');

    await store.getState().remove();

    expect(store.getState().status).toBe('INCOMING');
  });
});

describe('createFriendActionStore: FRIENDS -> remove() (unfriend)', () => {
  it('оптимистично переключает в NONE и шлёт DELETE', async () => {
    removeFriendEdge.mockResolvedValue({ ok: true, data: { ok: true } });
    const store = createFriendActionStore('u1', 'FRIENDS');

    await store.getState().remove();

    expect(store.getState().status).toBe('NONE');
    expect(removeFriendEdge).toHaveBeenCalledWith('u1');
  });

  it('ошибка сети — откатывает в FRIENDS', async () => {
    removeFriendEdge.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });
    const store = createFriendActionStore('u1', 'FRIENDS');

    await store.getState().remove();

    expect(store.getState().status).toBe('FRIENDS');
  });
});

describe('createFriendActionStore: SELF', () => {
  it('исходный статус SELF сохраняется без вызовов сети', () => {
    const store = createFriendActionStore('u1', 'SELF');

    expect(store.getState().status).toBe('SELF');
    expect(sendFriendRequest).not.toHaveBeenCalled();
  });
});
