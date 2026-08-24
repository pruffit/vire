import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SearchScreen from '../screens/search-screen';
import ReleaseScreen from '../screens/release-screen';
import type { HomeStackParamList } from './home-stack';

// 'ReleaseDetail' — тот же screen-компонент, что и в home-stack.tsx (переиспользуем ReleaseScreen,
// он типизирован узко по route.params, см. коммент в screens/release-screen.tsx).
export type SearchStackParamList = {
  SearchHome: undefined;
  ReleaseDetail: HomeStackParamList['ReleaseDetail'];
};

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchHome" component={SearchScreen} />
      <Stack.Screen name="ReleaseDetail" component={ReleaseScreen} />
    </Stack.Navigator>
  );
}
