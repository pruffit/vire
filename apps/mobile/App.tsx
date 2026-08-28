import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './navigation/root-navigator';
import { bootstrapE2eeIdentity } from './lib/e2ee/bootstrap';
import { BlurTargetProvider } from './lib/blur-target';
import { GlassLab } from './screens/glass-lab';
import { GlassBench } from './screens/glass-bench';

// Стенд VireGlass вместо приложения. Выключен по умолчанию, продовый путь не задевает:
//   EXPO_PUBLIC_GLASS_LAB=1     — зонды доступа к бэкдропу (§9)
//   EXPO_PUBLIC_GLASS_LAB=bench — сцены замера масштабирования
// Зачем нужен — docs/vireglass/README.md.
const LAB_MODE = process.env.EXPO_PUBLIC_GLASS_LAB;
const GLASS_LAB = LAB_MODE === '1' || LAB_MODE === 'bench';

export default function App() {
  useEffect(() => {
    if (!GLASS_LAB) bootstrapE2eeIdentity();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <BlurTargetProvider>
          {LAB_MODE === 'bench' ? <GlassBench /> : GLASS_LAB ? <GlassLab /> : <RootNavigator />}
        </BlurTargetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
