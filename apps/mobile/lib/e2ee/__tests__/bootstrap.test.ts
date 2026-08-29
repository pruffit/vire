import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getCurrentUserId } = vi.hoisted(() => ({ getCurrentUserId: vi.fn() }));
vi.mock('../../secure-store', () => ({ getCurrentUserId }));

const { getOrCreateIdentity } = vi.hoisted(() => ({ getOrCreateIdentity: vi.fn() }));
vi.mock('../identity', () => ({ getOrCreateIdentity }));

const { publishIdentityKey, fetchIdentityKey } = vi.hoisted(() => ({
  publishIdentityKey: vi.fn(),
  fetchIdentityKey: vi.fn(),
}));
vi.mock('../publish-key', () => ({ publishIdentityKey, fetchIdentityKey }));

import { bootstrapE2eeIdentity } from '../bootstrap';
import { useChatAvailability, getChatAvailability } from '../chat-availability';

/** Тот же b64, что вернёт toB64 для pub из 32 байт со значением 7. */
const OURS = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
const THEIRS = Buffer.from(new Uint8Array(32).fill(3)).toString('base64');

function identity() {
  return { pub: new Uint8Array(32).fill(7), priv: new Uint8Array(32).fill(9) };
}

beforeEach(() => {
  vi.clearAllMocks();
  useChatAvailability.setState({ status: 'unknown' });
});

describe('e2ee/bootstrap', () => {
  it('без залогиненного юзера не делает ничего', async () => {
    getCurrentUserId.mockResolvedValue(null);

    await bootstrapE2eeIdentity();

    expect(getOrCreateIdentity).not.toHaveBeenCalled();
    expect(fetchIdentityKey).not.toHaveBeenCalled();
    expect(publishIdentityKey).not.toHaveBeenCalled();
  });

  it('на сервере ключа нет — публикует и открывает чат', async () => {
    getCurrentUserId.mockResolvedValue('user-1');
    getOrCreateIdentity.mockResolvedValue(identity());
    fetchIdentityKey.mockResolvedValue(null);
    publishIdentityKey.mockResolvedValue(true);

    await bootstrapE2eeIdentity();

    expect(publishIdentityKey).toHaveBeenCalledWith(OURS);
    expect(getChatAvailability()).toBe('available');
  });

  it('на сервере наш же ключ — публикует (идемпотентно) и открывает чат', async () => {
    getCurrentUserId.mockResolvedValue('user-1');
    getOrCreateIdentity.mockResolvedValue(identity());
    fetchIdentityKey.mockResolvedValue(OURS);
    publishIdentityKey.mockResolvedValue(true);

    await bootstrapE2eeIdentity();

    expect(publishIdentityKey).toHaveBeenCalledWith(OURS);
    expect(getChatAvailability()).toBe('available');
  });

  // Ключевой инвариант всего предохранителя: до P0 здесь безусловно публиковался
  // мобильный ключ, затирая ключ веб-сессии того же пользователя.
  it('на сервере ЧУЖОЙ ключ — НЕ публикует и блокирует чат на этом устройстве', async () => {
    getCurrentUserId.mockResolvedValue('user-1');
    getOrCreateIdentity.mockResolvedValue(identity());
    fetchIdentityKey.mockResolvedValue(THEIRS);

    await bootstrapE2eeIdentity();

    expect(publishIdentityKey).not.toHaveBeenCalled();
    expect(getChatAvailability()).toBe('locked-other-device');
  });

  it('серверный ключ не прочитался — НЕ публикует: под неизвестностью может быть чужой', async () => {
    getCurrentUserId.mockResolvedValue('user-1');
    getOrCreateIdentity.mockResolvedValue(identity());
    fetchIdentityKey.mockResolvedValue(undefined);

    await bootstrapE2eeIdentity();

    expect(publishIdentityKey).not.toHaveBeenCalled();
    expect(getChatAvailability()).toBe('unknown');
  });

  it('падение зависимости не роняет запуск приложения', async () => {
    getCurrentUserId.mockRejectedValue(new Error('SecureStore unavailable'));

    await expect(bootstrapE2eeIdentity()).resolves.toBeUndefined();
  });
});
