import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/root-navigator';
import { WEB_BASE_URL } from '../lib/env';
import { setAuthTokens } from '../lib/secure-store';
import { Screen } from '../components/screen';
import { colors, radius } from '../lib/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

function resolvePlatformParam(): 'ios' | 'android' | 'other' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'other';
}

function buildBridgeUrl(redirectUri: string): string {
  const platform = resolvePlatformParam();
  const name = Constants.deviceName ?? 'Мобильное устройство';
  return `${WEB_BASE_URL}/mobile-auth-bridge?platform=${encodeURIComponent(platform)}&name=${encodeURIComponent(name)}&redirectUri=${encodeURIComponent(redirectUri)}`;
}

export default function SignInScreen({ navigation }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setPending(true);
    setError(null);
    try {
      // Linking.createURL — не хардкод: в Expo Go это exp://<host>:8081/--/auth-callback
      // (единственный адрес, который сама Expo Go умеет перехватить и вернуть в проект),
      // в собранном приложении — vire://auth-callback (схема из app.json). Хардкод vire://
      // ломал вход в Expo Go целиком — редирект после логина просто некуда было ловить.
      const redirectUri = Linking.createURL('auth-callback');
      const result = await WebBrowser.openAuthSessionAsync(buildBridgeUrl(redirectUri), redirectUri);

      if (result.type !== 'success' || !result.url) {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          setError('Не удалось войти. Попробуйте снова.');
        }
        return;
      }

      const { queryParams } = Linking.parse(result.url);
      const accessToken = queryParams?.accessToken;
      const refreshToken = queryParams?.refreshToken;
      const deviceId = queryParams?.deviceId;

      if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || typeof deviceId !== 'string') {
        setError('Не удалось войти. Попробуйте снова.');
        return;
      }

      await setAuthTokens({ accessToken, refreshToken, deviceId });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.logo}>VireMusic</Text>
      <Text style={styles.subtitle}>Независимая музыкальная площадка</Text>
      <Pressable style={styles.button} onPress={handleSignIn} disabled={pending}>
        {pending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.buttonText}>Войти</Text>
        )}
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 20,
    padding: 32,
  },
  logo: { color: colors.foreground, fontSize: 32, fontWeight: '800' },
  subtitle: { color: colors.mutedForeground, fontSize: 15, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.lg,
    minHeight: 44,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: '700' },
  error: { color: colors.destructive, textAlign: 'center' },
});
