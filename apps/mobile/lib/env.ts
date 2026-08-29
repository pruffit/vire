import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { hostUriFromScriptUrl } from './lan-host';
import { resolveBaseUrl } from './base-url';

// Только проводка: порядок разрешения и его инварианты — в `lib/base-url.ts` (чистый,
// покрыт тестами). Здесь лишь сбор входов из платформы.
//
// LAN-хост берётся из `Constants.expoConfig?.hostUri` (заполняется в классическом Expo Go)
// с фолбэком на `NativeModules.SourceCode.scriptURL` (URL, с которого RN загрузил бандл —
// работает и в кастомном dev-client). Живая проверка на эмуляторе показала, что в
// dev-client оба источника бывают пусты — там сеть поднимается вручную (`adb reverse` +
// явный `EXPO_PUBLIC_*`, см. docs/features/mobile-app.md).
const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string; webBaseUrl?: string } | undefined;

function hostUri(): string | undefined {
  return Constants.expoConfig?.hostUri ?? hostUriFromScriptUrl(NativeModules.SourceCode?.scriptURL);
}

export const API_BASE_URL = resolveBaseUrl({
  explicit: process.env.EXPO_PUBLIC_API_BASE_URL,
  isDev: __DEV__,
  hostUri: hostUri(),
  production: extra?.apiBaseUrl,
});

export const WEB_BASE_URL = resolveBaseUrl({
  explicit: process.env.EXPO_PUBLIC_WEB_BASE_URL,
  isDev: __DEV__,
  hostUri: hostUri(),
  production: extra?.webBaseUrl,
});
