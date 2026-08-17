import Constants from 'expo-constants';
import { baseUrlFromHostUri } from './lan-host';

// На физическом телефоне через Expo Go `localhost` резолвится в сам телефон, а не в
// dev-машину — сеть до неё физически недостижима без LAN-адреса. `Constants.expoConfig
// ?.hostUri` — адрес, на котором Metro раздаёт бандл телефону (`192.168.x.x:8081`); в
// dev-режиме Next почти наверняка поднят на той же машине на порту 3000. Приоритет:
// явный EXPO_PUBLIC_* → выведенный LAN-хост → localhost (последний фолбэк — для
// `expo start --web`, где hostUri неприменим).
const DEV_SERVER_PORT = 3000;
const LOCALHOST_FALLBACK = 'http://localhost:3000';

function resolveBaseUrl(explicit: string | undefined): string {
  if (explicit) return explicit;
  return baseUrlFromHostUri(Constants.expoConfig?.hostUri, DEV_SERVER_PORT, LOCALHOST_FALLBACK);
}

export const API_BASE_URL = resolveBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
export const WEB_BASE_URL = resolveBaseUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL);
