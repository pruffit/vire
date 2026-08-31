import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { HomeStackNavigator, type HomeStackParamList } from './home-stack';
import { SearchStackNavigator } from './search-stack';
import { LibraryStackNavigator } from './library-stack';
import { ProfileStackNavigator } from './profile-stack';
import { LiquidGlassButton } from '../components/liquid-glass';
import { type IconName } from '../lib/icon';
import { useBlurTarget } from '../lib/blur-target';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/layout';
import { SCRIM_COMPENSATION } from '../lib/vireglass/material';

// Home принимает вложенные параметры — фуллскрин-плеер (корневой стек, вне табов)
// открывает «К релизу» через navigation.navigate('Main', { screen: 'Home', params: {...} }).
export type MainTabsParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Search: undefined;
  Library: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

const TAB_ICONS: Record<keyof MainTabsParamList, IconName> = {
  Home: 'home',
  Search: 'search',
  Library: 'list',
  Profile: 'user',
};

const CIRCLE_SIZE = 68;

// Кнопки плавают над контентом, который под них уезжает: без затемняющей подложки строчки
// трека проходят прямо сквозь ряд и стекло читается наклейкой. Скрим — длинный мягкий
// градиент от прозрачного, никакой видимой границы у него нет.
const SCRIM_HEIGHT = 96;
const SCRIM = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.12)', 'rgba(3,2,1,0.32)', 'rgba(3,2,1,0.46)'] as const;
const SCRIM_STOPS = [0, 0.5, 0.8, 1] as const;
// Линза целится в контент экрана напрямую и этого градиента над ним не видит — гасит себя
// на ту же величину сама (`SCRIM_COMPENSATION`) — это компенсация, отдельная от общего
// продуктового `PRODUCT_DIM` у панелей.

// Кит («05 · КОМПОНЕНТЫ», навигация) требует раздельные круглые кнопки без подписи —
// не одну сплошную капсулу с иконкой+текстом, которую строит `tabBarStyle`/`tabBarIcon`
// у стандартного bottom-tabs. Поэтому весь бар — кастомный `tabBar`, стандартные
// `tabBarStyle`/`tabBarLabelStyle`/`tabBarIcon` из screenOptions больше не участвуют.
function CircleTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Живой фон линзы — контент сфокусированного экрана; преломление считается покадрово.
  const blurTarget = useBlurTarget();

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={SCRIM}
        locations={SCRIM_STOPS}
        style={[styles.scrim, { height: TAB_BAR_CONTENT_HEIGHT + insets.bottom + SCRIM_HEIGHT }]}
      />
      <View
        style={[
          styles.row,
          { height: TAB_BAR_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom, bottom: 6 },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const iconName = TAB_ICONS[route.name as keyof MainTabsParamList];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(route.name);
            }
          };

          return (
            <LiquidGlassButton
              key={route.key}
              size={CIRCLE_SIZE}
              icon={iconName}
              active={focused}
              blurTarget={blurTarget}
              dim={SCRIM_COMPENSATION}
              onPress={onPress}
            />
          );
        })}
      </View>
    </>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CircleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Навигатор больше не резервирует место под таб-бар сам (кастомный `tabBar` рисуется
        // поверх контента, не в потоке) — каждый экран под MainTabs оставляет нижний отступ
        // через useContentBottomPadding() (lib/layout.ts), см. «Инкремент 19/20» ниже.
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: 'Главная' }} />
      <Tab.Screen name="Search" component={SearchStackNavigator} options={{ title: 'Поиск' }} />
      <Tab.Screen name="Library" component={LibraryStackNavigator} options={{ title: 'Медиатека' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
