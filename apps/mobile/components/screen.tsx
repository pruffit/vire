import { useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { colors } from '../lib/theme';
import { BlurTargetScope, useRegisterBlurTarget } from '../lib/blur-target';

// Единая точка safe-area для всех экранов — верхний инсет (статус-бар) закрывал контент
// на каждом экране по отдельности, потому что headerShown:false везде (свой UI, не
// нативный хедер) и react-navigation не подставляет отступ сам. Низ таб-бара — отдельно,
// lib/layout.ts::useTabBarHeight (не все экраны сидят над таб-баром).
//
// Заодно — единая точка регистрации blurTarget (lib/blur-target.tsx): каждый экран,
// использующий `<Screen>`, автоматически становится целью блюра для таб-бара/мини-плеера,
// пока он в фокусе. `home-screen.tsx` не использует `Screen` и регистрируется отдельно.
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  useRegisterBlurTarget(blurTargetRef);

  // paddingTop safe-area — последним в массиве: если чужой style задаёт padding
  // шорткатом (перекрывает paddingTop), инсет всё равно должен победить.
  return (
    <BlurTargetView style={[styles.container, style, { paddingTop: insets.top }]} ref={blurTargetRef}>
      <BlurTargetScope target={blurTargetRef}>{children}</BlurTargetScope>
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
