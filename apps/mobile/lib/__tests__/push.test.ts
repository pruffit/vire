import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest }));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const constants = vi.hoisted(() => ({
  expoConfig: null as { extra?: { eas?: { projectId?: string } } } | null,
  easConfig: null as { projectId?: string } | null,
}));
vi.mock('expo-constants', () => ({ default: constants }));

const notifications = vi.hoisted(() => ({
  setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));
vi.mock('expo-notifications', () => notifications);

import { registerForPushNotifications } from '../push';

beforeEach(() => {
  vi.clearAllMocks();
  constants.expoConfig = null;
  constants.easConfig = null;
  notifications.setNotificationChannelAsync.mockResolvedValue(undefined);
});

describe('registerForPushNotifications', () => {
  it('нет projectId в конфиге — apiRequest не вызывается, не бросает', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(registerForPushNotifications('device-1')).resolves.toBeUndefined();

    expect(apiRequest).not.toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('разрешение не выдано — apiRequest не вызывается, не бросает', async () => {
    constants.expoConfig = { extra: { eas: { projectId: 'proj-1' } } };
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(registerForPushNotifications('device-1')).resolves.toBeUndefined();

    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('getExpoPushTokenAsync бросает — не пробрасывает исключение', async () => {
    constants.expoConfig = { extra: { eas: { projectId: 'proj-1' } } };
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('no projectId'));

    await expect(registerForPushNotifications('device-1')).resolves.toBeUndefined();

    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('всё успешно — apiRequest вызван с правильным путём/методом/телом', async () => {
    constants.expoConfig = { extra: { eas: { projectId: 'proj-1' } } };
    notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' });
    apiRequest.mockResolvedValue({ ok: true, data: { ok: true } });

    await registerForPushNotifications('device-1');

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: 3 }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/mobile/push-token',
      expect.objectContaining({
        method: 'POST',
        body: { token: 'ExponentPushToken[xxx]', platform: 'android', deviceId: 'device-1' },
      }),
    );
  });
});
