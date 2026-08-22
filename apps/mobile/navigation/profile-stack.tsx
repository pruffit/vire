import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/profile-screen';
import FriendsScreen from '../screens/friends-screen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Friends: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
    </Stack.Navigator>
  );
}
