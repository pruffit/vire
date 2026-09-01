import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/root-navigator';
import { WEB_BASE_URL } from '../lib/env';
import { setAuthTokens } from '../lib/secure-store';
import { registerForPushNotifications } from '../lib/push';
import { Screen } from '../components/screen';
import { colors } from '../lib/theme';
import { type, fonts } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';

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
      void registerForPushNotifications(deviceId);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.identity}>
        <Text style={styles.wordmark}>VireMusic</Text>
        {/* Подпись переносится: до кита она стояла в одну строку и обрезалась на «музыкальная». */}
        <Text style={styles.tagline}>Независимая музыкальная площадка</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleSignIn}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel="Войти"
      >
        {pending ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonLabel}>Войти</Text>
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
    gap: space.xl,
    padding: 32,
  },
  identity: { alignItems: 'center', gap: space.sm },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.foreground,
  },
  tagline: { ...type.caption, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  button: {
    minHeight: layout.touchTarget,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  buttonLabel: { ...type.button, color: colors.background },
  error: { ...type.caption, color: colors.destructive, textAlign: 'center' },
});
