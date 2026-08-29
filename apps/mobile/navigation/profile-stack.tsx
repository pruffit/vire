import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/profile-screen';
import FriendsScreen from '../screens/friends-screen';
import UserProfileScreen from '../screens/user-profile-screen';
import ConversationsScreen from '../screens/conversations-screen';
import ChatThreadScreen from '../screens/chat-thread-screen';
import SettingsScreen from '../screens/settings-screen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Friends: undefined;
  UserProfile: { userId: string };
  Conversations: undefined;
  ChatThread: { conversationId: string; otherUserId: string; otherUserName: string | null };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
