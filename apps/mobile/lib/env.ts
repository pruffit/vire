import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { baseUrlFromHostUri, hostUriFromScriptUrl } from './lan-host';

// На физическом телефоне/эмуляторе `localhost` резолвится в само устройство, а не в
// dev-машину — сеть до неё физически недостижима без LAN-адреса. Приоритет источников
// LAN-хоста: явный EXPO_PUBLIC_* → `Constants.expoConfig?.hostUri` (заполняется в классическом
// Expo Go, не проверялось живьём в этой сессии — тестировали только кастомный dev-client) →
// `NativeModules.SourceCode.scriptURL` (URL, с которого RN загрузил бандл). Живая проверка на
// эмуляторе (кастомный dev-client инкремента 5) показала: ОБА источника пусты в этом
// окружении — dev-client использует свой загрузчик, не тот путь, что Expo Go/бандл с диска.
// Там сеть поднята вручную (`adb reverse tcp:3000 tcp:3000` + `EXPO_PUBLIC_*=http://
// localhost:3000`, см. docs/features/mobile-app.md) — если этот фолбэк когда-нибудь окажется
// пустым и для Expo Go, автоопределения для dev-client в принципе может не быть, только явный
// env var. localhost — последний фолбэк для `expo start --web`, где оба источника неприменимы.
const DEV_SERVER_PORT = 3000;
const LOCALHOST_FALLBACK = 'http://localhost:3000';

function resolveBaseUrl(explicit: string | undefined): string {
  if (explicit) return explicit;
  const hostUri = Constants.expoConfig?.hostUri ?? hostUriFromScriptUrl(NativeModules.SourceCode?.scriptURL);
  return baseUrlFromHostUri(hostUri, DEV_SERVER_PORT, LOCALHOST_FALLBACK);
}

export const API_BASE_URL = resolveBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
export const WEB_BASE_URL = resolveBaseUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL);
