import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/auth';
import { getCaller } from './caller';

const mockedAuth = vi.mocked(auth);
const USER_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => vi.clearAllMocks());

describe('getCaller', () => {
  it('нет сессии → null', async () => {
    mockedAuth.mockResolvedValue(null as never);
    await expect(getCaller()).resolves.toBeNull();
  });

  it('сессия без id → null (в актора без идентификатора нельзя превращать)', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'LISTENER' } } as never);
    await expect(getCaller()).resolves.toBeNull();
  });

  it('сессия → актор с ролью и пометкой источника', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: USER_ID, role: 'ADMIN', name: 'Даня', email: 'a@b.c', image: null },
    } as never);

    await expect(getCaller()).resolves.toEqual({
      id: USER_ID,
      role: 'ADMIN',
      name: 'Даня',
      email: 'a@b.c',
      image: null,
      source: 'session',
    });
  });

  it('отсутствующие поля профиля нормализуются в null, а не undefined', async () => {
    mockedAuth.mockResolvedValue({ user: { id: USER_ID, role: 'LISTENER' } } as never);
    const caller = await getCaller();
    expect(caller).toMatchObject({ name: null, email: null, image: null });
  });
});
