import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibraryScreen from '../screens/library-screen';
import PlaylistScreen from '../screens/playlist-screen';

export type LibraryStackParamList = {
  LibraryHome: undefined;
  PlaylistDetail: { playlistId: string; title?: string; coverUrl?: string | null };
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export function LibraryStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LibraryHome" component={LibraryScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistScreen} />
    </Stack.Navigator>
  );
}
