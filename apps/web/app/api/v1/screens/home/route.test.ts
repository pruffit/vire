import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screenSchema } from '@vire/api-contracts';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const USER_ID = '11111111-1111-1111-1111-111111111111';

function req(headers: Record<string, string> = {}) {
  return new Request('https://vire.test/api/v1/screens/home', { headers });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/screens/home', () => {
  it('гостю отдаёт композицию без персональных блоков и проходит контракт', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(screenSchema.safeParse(body).success).toBe(true);
    expect(body.screen).toBe('home');
    const types = body.blocks.map((b: { type: string }) => b.type);
    expect(types).not.toContain('feed');
    expect(types).toContain('hot-tracks');
  });

  it('слушателю добавляет персональные блоки', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);

    const body = await (await GET(req())).json();
    const types = body.blocks.map((b: { type: string }) => b.type);

    expect(types).toContain('feed');
    expect(types).toContain('personal');
    expect(types).toContain('discovery');
  });

  it('не отдаёт типы, которых клиент не умеет рендерить', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);

    const body = await (await GET(req({ 'x-vire-blocks': 'featured-release, hot-tracks' }))).json();

    expect(body.blocks.map((b: { type: string }) => b.type)).toEqual(['featured-release', 'hot-tracks']);
  });

  it('персональная композиция не кэшируется на общих слоях', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID } } as never);
    const res = await GET(req());
    expect(res.headers.get('cache-control')).toContain('private');
  });
});
