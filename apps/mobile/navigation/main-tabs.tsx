import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { HomeStackNavigator } from './home-stack';
import { SearchStackNavigator } from './search-stack';
import { LibraryStackNavigator } from './library-stack';
import { ProfileStackNavigator } from './profile-stack';
import { Glass } from '../components/glass';
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

export function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        // position:'absolute' — таб-бар теперь реально плавает над контентом (блюр
        // просвечивает содержимое экрана под ним, не просто чёрный фон). Навигатор
        // больше НЕ резервирует под него место сам — каждый экран под MainTabs обязан
        // сам оставлять нижний отступ через useContentBottomPadding() (lib/layout.ts),
        // иначе контент прячется за таб-баром/мини-плеером — тот же класс бага, что чинили
        // в «Инкременте 18», теперь распространённый на все списки под таб-навигатором;
        // см. «Инкремент 19/20» в этом файле, где перечислены все обновлённые экраны.
        // position:'absolute' без явных left/right/bottom не плавает: bottom-tabs
        // растягивает бар на всю ширину флаш к краю, marginHorizontal/marginBottom
        // на такой раскладке молча игнорируются (подтверждено uiautomator-дампом —
        // bounds на весь экран, [0,y][1080,2400], несмотря на маргины в стилях).
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 6,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          borderRadius: 22,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarBackground: () => <Glass style={StyleSheet.absoluteFill} radius={22} edge shadow />,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { minHeight: 44 },
        tabBarIcon: ({ focused, color }) => (
          <Icon name={TAB_ICONS[route.name as keyof MainTabsParamList]} size={22} color={focused ? color : colors.mutedForeground} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: 'Главная' }} />
      <Tab.Screen name="Search" component={SearchStackNavigator} options={{ title: 'Поиск' }} />
      <Tab.Screen name="Library" component={LibraryStackNavigator} options={{ title: 'Медиатека' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  );
}
