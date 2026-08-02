import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOdesliMeta } from './odesli';

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('fetchOdesliMeta', () => {
  it('достаёт исполнителя и название по ссылке любого сервиса', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      entityUniqueId: 'SPOTIFY_SONG::1',
      entitiesByUniqueId: {
        'SPOTIFY_SONG::1': { title: 'Вселенная бесконечна?', artistName: 'Noize MC', thumbnailUrl: 'https://i.scdn.co/image/x' },
      },
    })));

    await expect(fetchOdesliMeta('https://music.yandex.ru/album/1/track/2')).resolves.toEqual({
      title: 'Вселенная бесконечна?',
      artistName: 'Noize MC',
      coverUrl: 'https://i.scdn.co/image/x',
      durationSec: null,
    });
  });

  it('ответ без сущности — null, а не исключение', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ entityUniqueId: 'X', entitiesByUniqueId: {} })));
    await expect(fetchOdesliMeta('https://vk.com/audio1')).resolves.toBeNull();
  });

  it('лимит запросов и сетевые сбои деградируют в null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 429)));
    await expect(fetchOdesliMeta('https://vk.com/audio1')).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(fetchOdesliMeta('https://vk.com/audio1')).resolves.toBeNull();
  });
});
