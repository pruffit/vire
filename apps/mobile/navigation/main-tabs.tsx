import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { HomeStackNavigator, type HomeStackParamList } from './home-stack';
import { SearchStackNavigator } from './search-stack';
import { LibraryStackNavigator } from './library-stack';
import { ProfileStackNavigator } from './profile-stack';
import { LiquidGlassButton } from '../components/liquid-glass';
import { GlassGroup, useGlassGroup } from '../lib/vireglass/glass-group';
import { type IconName } from '../lib/icon';
import { useBlurTarget } from '../lib/blur-target';
import { useFurniture } from '../lib/layout';
import { useFurnitureInk } from '../lib/scroll-edge';
import { mockScale, useMockMaterial } from '../lib/design/mock';
import { materialForInk, VIREGLASS_CONTROL_MATERIAL } from '../lib/vireglass/material';

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

/** Поле ряда в макете: кнопки стоят по краям поля экрана. */
const MOCK_ROW_INSET = 20;

/** Навигация — органы управления, и значки на них — краска приложения. Активное состояние
 *  собирает из этого материала само ядро (`activeMaterial` в components/liquid-glass.tsx). */
const CONTROL_MATERIAL = materialForInk(VIREGLASS_CONTROL_MATERIAL, true);

// Кит («05 · КОМПОНЕНТЫ», навигация) требует раздельные круглые кнопки без подписи —
// не одну сплошную капсулу с иконкой+текстом, которую строит `tabBarStyle`/`tabBarIcon`
// у стандартного bottom-tabs. Поэтому весь бар — кастомный `tabBar`, стандартные
// `tabBarStyle`/`tabBarLabelStyle`/`tabBarIcon` из screenOptions больше не участвуют.
//
// Притенение низа рисует сам экран (`components/furniture-scrim.tsx`): оно обязано попасть
// в захват линзы, а этот ряд лежит НАД захватом.
// Стиль краевого эффекта идёт за полярностью ближайшего стекла (эталон §10), а полярность
// блока живёт в группе и наружу не выходит. Забрать её можно только изнутри.
function FurnitureInk() {
  useFurnitureInk(useGlassGroup()?.ink);
  return null;
}

function CircleTabBar({ state, navigation }: BottomTabBarProps) {
  const { nav, navBottom } = useFurniture();
  const { width } = useWindowDimensions();
  const inset = Math.round(MOCK_ROW_INSET * mockScale(width));
  const material = useMockMaterial(CONTROL_MATERIAL);
  // Живой фон линзы — контент сфокусированного экрана; преломление считается покадрово.
  const blurTarget = useBlurTarget();

  return (
    // Таб-бар адаптируется БЛОКОМ: под каждой кнопкой свой кусок фона, и по своему
    // замеру одна уходит в тень, а соседняя остаётся прозрачной.
    <GlassGroup>
      <FurnitureInk />
      <View style={[styles.row, { bottom: navBottom, left: inset, right: inset, height: nav }]}>
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
              size={nav}
              icon={iconName}
              active={focused}
              blurTarget={blurTarget}
              material={material}
              onPress={onPress}
            />
          );
        })}
      </View>
    </GlassGroup>
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
  // Капля тяги уходит за пределы ряда — обрезать её нечем и незачем.
  row: {
    overflow: 'visible',
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
