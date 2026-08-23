import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { decodeAccessTokenUserId } from './access-token';

const KEYS = {
  accessToken: 'vire_access_token',
  refreshToken: 'vire_refresh_token',
  deviceId: 'vire_device_id',
} as const;

export type SecureStoreKey = keyof typeof KEYS;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
}

// expo-secure-store не реализован на web (getValueWithKeyAsync отсутствует) — fallback на
// localStorage только для web-превью (Expo Go/нативные сборки используют Keychain/Keystore).
export function getStored(key: SecureStoreKey): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.localStorage?.getItem(KEYS[key]) ?? null);
  return SecureStore.getItemAsync(KEYS[key]);
}

export function setStored(key: SecureStoreKey, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEYS[key], value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(KEYS[key], value);
}

export function deleteStored(key: SecureStoreKey): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(KEYS[key]);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(KEYS[key]);
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    setStored('accessToken', tokens.accessToken),
    setStored('refreshToken', tokens.refreshToken),
    setStored('deviceId', tokens.deviceId),
  ]);
}

export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    deleteStored('accessToken'),
    deleteStored('refreshToken'),
    deleteStored('deviceId'),
  ]);
}

export async function hasStoredSession(): Promise<boolean> {
  const [accessToken, refreshToken] = await Promise.all([
    getStored('accessToken'),
    getStored('refreshToken'),
  ]);
  return Boolean(accessToken || refreshToken);
}

export async function getCurrentUserId(): Promise<string | null> {
  const accessToken = await getStored('accessToken');
  return accessToken ? decodeAccessTokenUserId(accessToken) : null;
}
