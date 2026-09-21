import { useCallback, useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './navigation/root-navigator';
import { bootstrapE2eeIdentity } from './lib/e2ee/bootstrap';
import { subscribePlayerEffects } from './lib/player-store';
import { BlurTargetProvider } from './lib/blur-target';
import { ScrollEdgeProvider } from './lib/scroll-edge';
import { VireGlassProvider } from 'vireglass/native';
import { usePreferences } from './lib/design/preferences';
import { backdropAllowed } from './lib/design/glass-budget';
import { useKitFonts } from './lib/design/use-fonts';
import { colors } from './lib/theme';
import { GlassLab } from './screens/glass-lab';
import { GlassBench } from './screens/glass-bench';
import { MaterialLab } from './screens/material-lab';

// Стенд VireGlass вместо приложения. Выключен по умолчанию, продовый путь не задевает:
//   EXPO_PUBLIC_GLASS_LAB=1        — зонды доступа к бэкдропу (§9)
//   EXPO_PUBLIC_GLASS_LAB=bench    — сцены замера масштабирования
//   EXPO_PUBLIC_GLASS_LAB=material — стенд материала: тумблеры, слайдеры, пресеты, debug
// Зачем нужен — docs/vireglass/README.md.
const LAB_MODE = process.env.EXPO_PUBLIC_GLASS_LAB;
const GLASS_LAB = LAB_MODE === '1' || LAB_MODE === 'bench' || LAB_MODE === 'material';

// Политика стекла — решение приложения, а не материала: ядро знает, КАК рисовать, а можно ли
// сейчас живой бэкдроп, знает бюджет поверхностей (`glass-budget.ts`).
function GlassPolicy({ children }: { children: ReactNode }) {
  const glassEnabled = usePreferences((s) => s.glassEnabled);
  const reduceMotion = usePreferences((s) => s.reduceMotion);
  const openSheets = usePreferences((s) => s.openSheets);
  const allowed = useCallback(
    (topLayer: boolean) => backdropAllowed({ glassEnabled, openSheets }, topLayer),
    [glassEnabled, openSheets],
  );
  return (
    <VireGlassProvider glassEnabled={glassEnabled} reduceMotion={reduceMotion} backdropAllowed={allowed}>
      {children}
    </VireGlassProvider>
  );
}

function Lab() {
  if (LAB_MODE === 'bench') return <GlassBench />;
  if (LAB_MODE === 'material') return <MaterialLab />;
  return <GlassLab />;
}

export default function App() {
  // Шрифты кита ждём до первого кадра: иначе экран рисуется системным Roboto и вся
  // вёрстка прыгает при подмене. Фон подложки — тот же, что у сплеша, поэтому пауза
  // читается продолжением запуска, а не мельканием.
  const fontsReady = useKitFonts();

  useEffect(() => {
    if (!GLASS_LAB) bootstrapE2eeIdentity();
  }, []);

  // Отчёт о прослушивании при уходе в фон — подписка живёт в эффекте, чтобы фаст-рефреш
  // не плодил слушателей (живой прогон дал из-за этого дубли в play_events).
  useEffect(() => (GLASS_LAB ? undefined : subscribePlayerEffects()), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {fontsReady ? (
          <GlassPolicy>
            <BlurTargetProvider>
              <ScrollEdgeProvider>{GLASS_LAB ? <Lab /> : <RootNavigator />}</ScrollEdgeProvider>
            </BlurTargetProvider>
          </GlassPolicy>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background }} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
