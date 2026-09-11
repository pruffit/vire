import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

import { useLikesStore } from '../likes-store';

function resetStore() {
  useLikesStore.setState({ state: {} });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe('useLikesStore.load', () => {
  it('грузит состояние лайка и кладёт в state', async () => {
    request.mockResolvedValue({ ok: true, data: { liked: true } });

    useLikesStore.getState().load('t1');
    await flush();

    expect(request).toHaveBeenCalledWith('/api/v1/tracks/t1/like', expect.objectContaining({ schema: expect.anything() }));
    expect(useLikesStore.getState().state.t1).toBe(true);
  });

  it('трек уже в state — повторный load не бьёт в сеть', async () => {
    useLikesStore.setState({ state: { t1: false } });

    useLikesStore.getState().load('t1');
    await flush();

    expect(request).not.toHaveBeenCalled();
  });

  it('load уже летит для этого трека — повторный вызов не дублирует запрос', async () => {
    let resolve: (v: unknown) => void = () => {};
    request.mockReturnValue(new Promise((r) => { resolve = r; }));

    useLikesStore.getState().load('t1');
    useLikesStore.getState().load('t1');
    await flush();

    expect(request).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: { liked: false } });
  });

  it('сеть упала — state не меняется, без исключений', async () => {
    request.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });

    useLikesStore.getState().load('t1');
    await flush();

    expect(useLikesStore.getState().state.t1).toBeUndefined();
  });
});

describe('useLikesStore.toggle', () => {
  it('трек не загружен в state — no-op', () => {
    useLikesStore.getState().toggle('t1');
    expect(request).not.toHaveBeenCalled();
  });

  it('оптимистично переключает state и шлёт POST при переходе в liked', async () => {
    useLikesStore.setState({ state: { t1: false } });
    request.mockResolvedValue({ ok: true, data: { liked: true } });

    useLikesStore.getState().toggle('t1');

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(request).toHaveBeenCalledWith('/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));

    await flush();
  });

  it('оптимистично переключает state и шлёт DELETE при переходе в unliked', async () => {
    useLikesStore.setState({ state: { t1: true } });
    request.mockResolvedValue({ ok: true, data: { liked: false } });

    useLikesStore.getState().toggle('t1');

    expect(useLikesStore.getState().state.t1).toBe(false);
    expect(request).toHaveBeenCalledWith('/api/v1/tracks/t1/like', expect.objectContaining({ method: 'DELETE' }));

    await flush();
  });

  it('ошибка сети — откатывает state к исходному значению', async () => {
    useLikesStore.setState({ state: { t1: false } });
    request.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });

    useLikesStore.getState().toggle('t1');
    expect(useLikesStore.getState().state.t1).toBe(true);

    await flush();
    expect(useLikesStore.getState().state.t1).toBe(false);
  });

  it('повторный тап на тот же трек до ответа сети — no-op (in-flight guard)', async () => {
    useLikesStore.setState({ state: { t1: false } });
    let resolve: (v: unknown) => void = () => {};
    request.mockReturnValue(new Promise((r) => { resolve = r; }));

    useLikesStore.getState().toggle('t1');
    useLikesStore.getState().toggle('t1');

    expect(request).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: { liked: true } });
    await flush();
  });

  it('после завершения toggle повторный тап снова отрабатывает (guard освобождается)', async () => {
    useLikesStore.setState({ state: { t1: false } });
    request.mockResolvedValue({ ok: true, data: { liked: true } });

    useLikesStore.getState().toggle('t1');
    await flush();

    request.mockResolvedValue({ ok: true, data: { liked: false } });
    useLikesStore.getState().toggle('t1');
    await flush();

    expect(request).toHaveBeenCalledTimes(2);
    expect(useLikesStore.getState().state.t1).toBe(false);
  });
});

describe('useLikesStore.like', () => {
  it('ставит лайк и шлёт POST', async () => {
    useLikesStore.setState({ state: { t1: false } });
    request.mockResolvedValue({ ok: true, data: { liked: true } });

    useLikesStore.getState().like('t1');

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(request).toHaveBeenCalledWith('/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));

    await flush();
  });

  it('уже лайкнут — не бьёт в сеть повторно', () => {
    useLikesStore.setState({ state: { t1: true } });

    useLikesStore.getState().like('t1');

    expect(request).not.toHaveBeenCalled();
  });

  it('трек не загружен (двойной тап без захода на трек) — сначала грузит state, потом ставит лайк', async () => {
    request.mockResolvedValueOnce({ ok: true, data: { liked: false } });
    request.mockResolvedValueOnce({ ok: true, data: { liked: true } });

    useLikesStore.getState().like('t1');
    await flush();

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/tracks/t1/like', expect.objectContaining({ schema: expect.anything() }));
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));
  });

  it('трек не загружен, а на сервере уже лайкнут — догружает и лишний POST не шлёт', async () => {
    request.mockResolvedValueOnce({ ok: true, data: { liked: true } });

    useLikesStore.getState().like('t1');
    await flush();

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('трек не загружен, сеть на догрузке падает — без исключений, лайк не ставится', async () => {
    request.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });

    useLikesStore.getState().like('t1');
    await flush();

    expect(useLikesStore.getState().state.t1).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('useLikesStore — дедуп GET между load и like/toggleRemote', () => {
  it('load уже летит — like на тот же трек подключается к тому же запросу, не шлёт второй', async () => {
    let resolveLoad: (v: unknown) => void = () => {};
    request.mockReturnValueOnce(new Promise((r) => { resolveLoad = r; }));
    request.mockResolvedValueOnce({ ok: true, data: { liked: true } });

    useLikesStore.getState().load('t1');
    useLikesStore.getState().like('t1');

    expect(request).toHaveBeenCalledTimes(1);

    resolveLoad({ ok: true, data: { liked: false } });
    await flush();

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/tracks/t1/like', expect.objectContaining({ schema: expect.anything() }));
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));
    expect(useLikesStore.getState().state.t1).toBe(true);
  });

  it('load уже летит — toggleRemote на тот же трек тоже подключается, а не дублирует GET', async () => {
    let resolveLoad: (v: unknown) => void = () => {};
    request.mockReturnValueOnce(new Promise((r) => { resolveLoad = r; }));
    request.mockResolvedValueOnce({ ok: true, data: { liked: true } });

    useLikesStore.getState().load('t1');
    useLikesStore.getState().toggleRemote('t1');

    expect(request).toHaveBeenCalledTimes(1);

    resolveLoad({ ok: true, data: { liked: false } });
    await flush();

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));
    expect(useLikesStore.getState().state.t1).toBe(true);
  });
});

describe('useLikesStore.toggleRemote', () => {
  it('трек уже в state — ведёт себя как обычный toggle', async () => {
    useLikesStore.setState({ state: { t1: false } });
    request.mockResolvedValue({ ok: true, data: { liked: true } });

    useLikesStore.getState().toggleRemote('t1');

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(request).toHaveBeenCalledWith('/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));

    await flush();
  });

  it('трек не загружен (лайк из шторки без захода на экран трека) — сначала грузит state, потом переключает', async () => {
    request.mockResolvedValueOnce({ ok: true, data: { liked: false } });
    request.mockResolvedValueOnce({ ok: true, data: { liked: true } });

    useLikesStore.getState().toggleRemote('t1');
    await flush();

    expect(useLikesStore.getState().state.t1).toBe(true);
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/tracks/t1/like', expect.objectContaining({ schema: expect.anything() }));
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/tracks/t1/like', expect.objectContaining({ method: 'POST' }));
  });

  it('трек не загружен, сеть на догрузке падает — без исключений, state не меняется', async () => {
    request.mockResolvedValue({ ok: false, error: { status: 0, message: 'Нет соединения' } });

    useLikesStore.getState().toggleRemote('t1');
    await flush();

    expect(useLikesStore.getState().state.t1).toBeUndefined();
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
