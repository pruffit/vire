import { describe, it, expect, vi } from 'vitest';

function createFailingMulti() {
  const self = {
    zadd: vi.fn(() => self),
    zremrangebyscore: vi.fn(() => self),
    expire: vi.fn(() => self),
    zrange: vi.fn(() => self),
    exec: vi.fn().mockRejectedValue(new Error('redis down')),
  };
  return self;
}

const redisInstance = {
  on: vi.fn(),
  get: vi.fn().mockRejectedValue(new Error('redis down')),
  set: vi.fn().mockRejectedValue(new Error('redis down')),
  incr: vi.fn().mockRejectedValue(new Error('redis down')),
  expire: vi.fn().mockRejectedValue(new Error('redis down')),
  del: vi.fn().mockRejectedValue(new Error('redis down')),
  zrem: vi.fn().mockRejectedValue(new Error('redis down')),
  multi: vi.fn(() => createFailingMulti()),
};

vi.mock('ioredis', () => ({
  default: vi.fn(function MockRedis() {
    return redisInstance;
  }),
}));

const { RedisJamStateStore } = await import('./jam-state');

const state = { trackId: 't1', startedAtMs: 1000, paused: false, pausedPositionMs: 0, version: 1 };

describe('RedisJamStateStore — деградация при недоступном Redis', () => {
  const store = new RedisJamStateStore();

  it('getPlayback возвращает null', async () => {
    expect(await store.getPlayback('jam1')).toBeNull();
  });

  it('setPlayback не бросает', async () => {
    await expect(store.setPlayback('jam1', state)).resolves.toBeUndefined();
  });

  it('heartbeat не бросает', async () => {
    await expect(store.heartbeat('jam1', 'p1')).resolves.toBeUndefined();
  });

  it('listPresent возвращает []', async () => {
    expect(await store.listPresent('jam1')).toEqual([]);
  });

  it('bumpAddCounter возвращает 0 (не блокирует добавление)', async () => {
    expect(await store.bumpAddCounter('jam1', 'p1')).toBe(0);
  });

  it('clear не бросает', async () => {
    await expect(store.clear('jam1')).resolves.toBeUndefined();
  });

  it('dropPresence не бросает', async () => {
    await expect(store.dropPresence('jam1', 'p1')).resolves.toBeUndefined();
  });
});

describe('RedisJamStateStore — рабочий Redis', () => {
  const store = new RedisJamStateStore();

  it('getPlayback парсит сохранённый JSON', async () => {
    redisInstance.get.mockResolvedValueOnce(JSON.stringify(state));
    expect(await store.getPlayback('jam1')).toEqual(state);
  });

  it('bumpAddCounter выставляет TTL только на первом инкременте', async () => {
    redisInstance.incr.mockResolvedValueOnce(1);
    redisInstance.expire.mockResolvedValueOnce('OK');
    const n = await store.bumpAddCounter('jam1', 'p1');
    expect(n).toBe(1);
    expect(redisInstance.expire).toHaveBeenCalledWith('jam:jam1:adds:p1', 60);

    redisInstance.incr.mockResolvedValueOnce(2);
    redisInstance.expire.mockClear();
    const n2 = await store.bumpAddCounter('jam1', 'p1');
    expect(n2).toBe(2);
    expect(redisInstance.expire).not.toHaveBeenCalled();
  });

  it('dropPresence удаляет участника из ZSET присутствия', async () => {
    redisInstance.zrem.mockResolvedValueOnce(1);
    await store.dropPresence('jam1', 'p1');
    expect(redisInstance.zrem).toHaveBeenCalledWith('jam:jam1:presence', 'p1');
  });
});
