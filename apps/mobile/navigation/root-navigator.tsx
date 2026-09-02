import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
  type LinkingOptions,
  type NavigatorScreenParams,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import PlayerScreen from '../screens/player-screen';
import { MainScreen } from './main-screen';
import type { MainTabsParamList } from './main-tabs';
import { getDeviceId, clearAuthTokens } from '../lib/secure-store';
import { registerForPushNotifications } from '../lib/push';
import { onSessionExpired } from '../lib/session-events';
import { colors } from '../lib/theme';

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabsParamList>;
  Player: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Только vire://release/:releaseId (инкремент 8).
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

/**
 * Экрана входа нет: приложение открывается сразу в Main. Запрос авторизации вернётся
 * отдельно и в другой форме — гейт на старте её только откладывал.
 */
export function RootNavigator() {
  useEffect(() => {
    void getDeviceId().then((deviceId) => {
      if (deviceId) void registerForPushNotifications(deviceId);
    });
  }, []);

  // Сессию не восстановить — чистим токены. Уводить некуда: приложение работает и
  // анонимно, а запрос входа придёт из того места, которому он реально нужен.
  useEffect(() => onSessionExpired(() => void clearAuthTokens()), []);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
