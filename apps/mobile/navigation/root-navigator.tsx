import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import SignInScreen from '../screens/sign-in-screen';
import PlayerScreen from '../screens/player-screen';
import { MainScreen } from './main-screen';
import { hasStoredSession, getDeviceId, clearAuthTokens } from '../lib/secure-store';
import { registerForPushNotifications } from '../lib/push';
import { onSessionExpired } from '../lib/session-events';
import { colors } from '../lib/theme';

export type RootStackParamList = {
  SignIn: undefined;
  Main: undefined;
  Player: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Ref, а не хук: выкинуть на экран входа надо из слоя API-клиента, который про навигацию
// не знает и знать не должен (см. lib/session-events.ts).
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Только vire://release/:releaseId (инкремент 8). Работает лишь при уже сохранённой
// сессии — SignIn-стек не участвует в linking, поэтому анонимный холодный старт
// диплинк теряет и просто показывает экран входа (см. docs/features/mobile-app.md).
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['vire://'],
  config: {
    screens: {
      Main: {
        screens: {
          Home: {
            screens: {
              ReleaseDetail: 'release/:releaseId',
            },
          },
        },
      },
    },
  },
};

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    border: colors.border,
    primary: colors.primary,
  },
};

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    // expo-secure-store не имеет веб-реализации (getValueWithKeyAsync бросает) — без catch
    // web-превью зависает на спиннере навсегда. На web/без сессии считаем неавторизованным.
    hasStoredSession()
      .then(async (has) => {
        setInitialRoute(has ? 'Main' : 'SignIn');
        if (!has) return;
        const deviceId = await getDeviceId();
        if (deviceId) void registerForPushNotifications(deviceId);
      })
      .catch(() => setInitialRoute('SignIn'));
  }, []);

  // Refresh отклонён сервером — сессию не восстановить. Токены к этому моменту уже
  // вычищены в api-client; добиваем их ещё раз на случай, если событие пришло из ветки
  // «refreshToken отсутствует», и уводим на вход, а не оставляем экран в ошибке.
  useEffect(
    () =>
      onSessionExpired(() => {
        void clearAuthTokens();
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        } else {
          setInitialRoute('SignIn');
        }
      }),
    [],
  );

  if (initialRoute === null) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
      >
        <ActivityIndicator color={colors.foreground} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
