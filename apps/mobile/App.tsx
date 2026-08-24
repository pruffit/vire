import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './navigation/root-navigator';
import { bootstrapE2eeIdentity } from './lib/e2ee/bootstrap';
import { BlurTargetProvider } from './lib/blur-target';

export default function App() {
  useEffect(() => {
    bootstrapE2eeIdentity();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <BlurTargetProvider>
        <RootNavigator />
      </BlurTargetProvider>
    </SafeAreaProvider>
  );
}
