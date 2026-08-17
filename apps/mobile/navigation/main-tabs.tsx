import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { HomeStackNavigator } from './home-stack';
import SearchScreen from '../screens/search-screen';
import LibraryScreen from '../screens/library-screen';
import ProfileScreen from '../screens/profile-screen';
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
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { minHeight: 44 },
        tabBarIcon: ({ focused, color }) => (
          <Icon name={TAB_ICONS[route.name as keyof MainTabsParamList]} size={22} color={focused ? color : colors.mutedForeground} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: 'Главная' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: 'Поиск' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: 'Медиатека' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  );
}
