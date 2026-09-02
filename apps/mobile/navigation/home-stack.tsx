import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home-screen';
import ReleaseScreen from '../screens/release-screen';
import ArtistScreen from '../screens/artist-screen';

export type HomeStackParamList = {
  HomeList: undefined;
  ReleaseDetail: { releaseId: string; title?: string; artistName?: string; coverUrl?: string | null };
  ArtistDetail: { slug: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeList" component={HomeScreen} />
      <Stack.Screen name="ReleaseDetail" component={ReleaseScreen} />
      <Stack.Screen name="ArtistDetail" component={ArtistScreen} />
    </Stack.Navigator>
  );
}
