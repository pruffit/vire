import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendExpoPush } from './expo-push.js';

const PAYLOAD = { title: 'Заголовок', body: 'Тело', url: 'https://vire.test/x', tag: 'tag-1' };

beforeEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown) {
  return { json: async () => ({ data }) } as Response;
}

describe('sendExpoPush', () => {
  it('пустой список токенов → [] без сетевого вызова', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendExpoPush([], PAYLOAD);
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('успешная отправка без мёртвых токенов', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ status: 'ok' }, { status: 'ok' }]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendExpoPush(['t1', 't2'], PAYLOAD);
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init.method).toBe('POST');
    const sentBody = JSON.parse(init.body);
    expect(sentBody).toEqual([
      { to: 't1', title: PAYLOAD.title, body: PAYLOAD.body, data: { url: PAYLOAD.url, tag: PAYLOAD.tag } },
      { to: 't2', title: PAYLOAD.title, body: PAYLOAD.body, data: { url: PAYLOAD.url, tag: PAYLOAD.tag } },
    ]);
  });

  it('токен с DeviceNotRegistered → возвращается как мёртвый', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      { status: 'ok' },
      { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendExpoPush(['alive', 'dead'], PAYLOAD);
    expect(result).toEqual(['dead']);
  });

  it('другие ошибки тикета не считаются мёртвыми', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      { status: 'error', message: 'rate limited', details: { error: 'MessageRateExceeded' } },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendExpoPush(['t1'], PAYLOAD);
    expect(result).toEqual([]);
  });

  it('чанкинг: >100 токенов → 2 отдельных fetch-вызова', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      const sent = JSON.parse(init.body) as unknown[];
      return jsonResponse(sent.map(() => ({ status: 'ok' })));
    });
    vi.stubGlobal('fetch', fetchMock);
    const tokens = Array.from({ length: 150 }, (_, i) => `t${i}`);
    const result = await sendExpoPush(tokens, PAYLOAD);
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sizes = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).length).sort((a, b) => b - a);
    expect(sizes).toEqual([100, 50]);
  });

  it('сетевая ошибка чанка не бросает и не помечает токены мёртвыми', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendExpoPush(['t1', 't2'], PAYLOAD)).resolves.toEqual([]);
  });
});
