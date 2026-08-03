import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchAudius, resolveAudiusUrl, audiusStreamUrl } from './audius';

afterEach(() => vi.unstubAllGlobals());

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const track = {
  id: 'QxVQW',
  title: 'Tasty (Extended Dub Mix)',
  duration: 391,
  permalink: '/boysnoize/tasty',
  user: { name: 'Boys Noize', handle: 'boysnoize' },
  artwork: { '480x480': 'https://node.example/art.jpg' },
  is_streamable: true,
};

describe('searchAudius', () => {
  it('превращает ответ в играбельные позиции', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [track] })));

    await expect(searchAudius('boys noize', 5)).resolves.toEqual([{
      source: 'AUDIUS',
      externalId: 'QxVQW',
      externalUrl: 'https://audius.co/boysnoize/tasty',
      title: 'Tasty (Extended Dub Mix)',
      artistName: 'Boys Noize',
      coverUrl: 'https://node.example/art.jpg',
      durationSec: 391,
    }]);
  });

  it('непроигрываемые и битые позиции отсеиваются', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      data: [{ ...track, is_streamable: false }, { id: 'x' }, track],
    })));

    const refs = await searchAudius('q', 5);
    expect(refs).toHaveLength(1);
  });

  it('сбой сети деградирует в пустой список', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(searchAudius('q', 5)).resolves.toEqual([]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 500)));
    await expect(searchAudius('q', 5)).resolves.toEqual([]);
  });
});

describe('resolveAudiusUrl', () => {
  it('ссылка на трек резолвится в позицию', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [track] })));
    await expect(resolveAudiusUrl('https://audius.co/boysnoize/tasty')).resolves.toMatchObject({ source: 'AUDIUS', externalId: 'QxVQW' });
  });

  it('не трек — null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [] })));
    await expect(resolveAudiusUrl('https://audius.co/boysnoize')).resolves.toBeNull();
  });
});

describe('audiusStreamUrl', () => {
  it('поток идёт через официальный шлюз с app_name', () => {
    expect(audiusStreamUrl('QxVQW')).toBe('https://discoveryprovider.audius.co/v1/tracks/QxVQW/stream?app_name=vire');
  });
});
