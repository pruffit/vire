import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getCaller: vi.fn(),
  revoke: vi.fn(),
  clearDeviceStateCache: vi.fn(),
}));

vi.mock('@/lib/caller', () => ({ getCaller: h.getCaller, clearDeviceStateCache: h.clearDeviceStateCache }));
vi.mock('@/lib/device-auth', () => ({ deviceAuthService: () => ({ revoke: h.revoke }) }));

import { DELETE } from './route';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const DEVICE_ID = '22222222-2222-2222-2222-222222222222';
const SESSION_CALLER = { id: USER_ID, role: 'LISTENER', source: 'session', deviceId: null };

function call(deviceId: string) {
  return DELETE(new Request('https://vire.test'), { params: Promise.resolve({ deviceId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.revoke.mockResolvedValue({ ok: true, value: undefined });
});

describe('DELETE /api/v1/auth/devices/[deviceId]', () => {
  it('401 без актора', async () => {
    h.getCaller.mockResolvedValue(null);
    expect((await call(DEVICE_ID)).status).toBe(401);
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it('400 на не-uuid deviceId', async () => {
    h.getCaller.mockResolvedValue(SESSION_CALLER);
    expect((await call('not-a-uuid')).status).toBe(400);
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it('404, если устройство чужое/не найдено', async () => {
    h.getCaller.mockResolvedValue(SESSION_CALLER);
    h.revoke.mockResolvedValue({ ok: false, error: new Error('not found') });

    expect((await call(DEVICE_ID)).status).toBe(404);
  });

  it('успешный отзыв сбрасывает кэш состояния устройств', async () => {
    h.getCaller.mockResolvedValue(SESSION_CALLER);

    const res = await call(DEVICE_ID);

    expect(res.status).toBe(200);
    expect(h.revoke).toHaveBeenCalledWith({ userId: USER_ID, deviceId: DEVICE_ID });
    expect(h.clearDeviceStateCache).toHaveBeenCalled();
  });
});
