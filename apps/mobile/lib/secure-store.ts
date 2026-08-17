import * as SecureStore from 'expo-secure-store';

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

export function getStored(key: SecureStoreKey): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS[key]);
}

export function setStored(key: SecureStoreKey, value: string): Promise<void> {
  return SecureStore.setItemAsync(KEYS[key], value);
}

export function deleteStored(key: SecureStoreKey): Promise<void> {
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
