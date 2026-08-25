import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { HomeStackNavigator } from './home-stack';
import { SearchStackNavigator } from './search-stack';
import { LibraryStackNavigator } from './library-stack';
import { ProfileStackNavigator } from './profile-stack';
import { LiquidGlassButton } from '../components/liquid-glass';
import { Icon, type IconName } from '../lib/icon';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/layout';
import { colors } from '../lib/theme';

export type MainTabsParamList = {
  Home: undefined;
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

const CIRCLE_SIZE = 56;
const IDLE_TINT = [0.08, 0.075, 0.07, 0.1] as const;
const ACTIVE_TINT = [0.5, 0.49, 0.47, 0.12] as const;

// Кит («05 · КОМПОНЕНТЫ», навигация) требует раздельные круглые кнопки без подписи —
// не одну сплошную капсулу с иконкой+текстом, которую строит `tabBarStyle`/`tabBarIcon`
// у стандартного bottom-tabs. Поэтому весь бар — кастомный `tabBar`, стандартные
// `tabBarStyle`/`tabBarLabelStyle`/`tabBarIcon` из screenOptions больше не участвуют.
function CircleTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
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
            active={focused}
            onPress={onPress}
            // Активная — светлая подсвеченная капля, неактивная — тёмное стекло; в обоих
            // случаях это тонировка преломлённого света, а не заливка (шейдер добавляет
            // Френель/блик/аберрацию поверх).
            tint={focused ? ACTIVE_TINT : IDLE_TINT}
          >
            <Icon name={iconName} size={21} color={focused ? colors.background : colors.foreground} />
          </LiquidGlassButton>
        );
      })}
    </View>
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
  row: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
