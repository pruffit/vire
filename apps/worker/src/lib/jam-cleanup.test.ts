import { describe, it, expect, vi } from 'vitest';

const redisInstance = {
  on: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
  publish: vi.fn().mockResolvedValue(0),
};

vi.mock('ioredis', () => ({
  default: vi.fn(function MockRedis() {
    return redisInstance;
  }),
}));
vi.mock('../queues/connection.js', () => ({ connection: { url: 'redis://localhost:6379' } }));

const { reapJamRedisState } = await import('./jam-cleanup.js');

describe('reapJamRedisState', () => {
  it('deletes the playback and presence keys and publishes jam:ended', async () => {
    await reapJamRedisState('jam-1');

    expect(redisInstance.del).toHaveBeenCalledWith('jam:jam-1:playback', 'jam:jam-1:presence');
    expect(redisInstance.publish).toHaveBeenCalledWith('rt:jam:jam-1', JSON.stringify({ type: 'jam:ended' }));
  });

  it('degrades silently when Redis is unavailable', async () => {
    redisInstance.del.mockRejectedValueOnce(new Error('redis down'));

    await expect(reapJamRedisState('jam-2')).resolves.toBeUndefined();
  });
});
