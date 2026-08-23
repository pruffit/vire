// Best-effort push-регистрация: `app.json` пока без `extra.eas.projectId` (EAS-проект не
// заведён, см. docs/superpowers/specs/2026-08-23-mobile-push-notifications-increment-17-design.md).
// Без него `getExpoPushTokenAsync` бросает — это ожидаемо, не баг, тихо деградируем.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { okResponseSchema } from '@vire/api-contracts';
import { apiRequest } from './api-client';

export async function registerForPushNotifications(deviceId: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await apiRequest('/api/v1/mobile/push-token', {
      method: 'POST',
      schema: okResponseSchema,
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', deviceId },
    });
  } catch {
    // нет projectId в неучтённом виде, нет сети, EAS/FCM не настроены — best-effort
  }
}
