import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeStackNavigator } from './home-stack';
import SearchScreen from '../screens/search-screen';
import LibraryScreen from '../screens/library-screen';
import ProfileScreen from '../screens/profile-screen';
import { colors } from '../lib/theme';

export type MainTabsParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
  Profile: undefined;
};

export const TAB_BAR_HEIGHT = 64;

const Tab = createBottomTabNavigator<MainTabsParamList>();

const TAB_ICONS: Record<keyof MainTabsParamList, string> = {
  Home: '🏠',
  Search: '🔍',
  Library: '📚',
  Profile: '👤',
};

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: TAB_BAR_HEIGHT,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { minHeight: 44 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.55 }}>
            {TAB_ICONS[route.name as keyof MainTabsParamList]}
          </Text>
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
