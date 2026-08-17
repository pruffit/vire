import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

// Единая точка safe-area для всех экранов — верхний инсет (статус-бар) закрывал контент
// на каждом экране по отдельности, потому что headerShown:false везде (свой UI, не
// нативный хедер) и react-navigation не подставляет отступ сам. Низ таб-бара — отдельно,
// lib/layout.ts::useTabBarHeight (не все экраны сидят над таб-баром).
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  // paddingTop safe-area — последним в массиве: если чужой style задаёт padding
  // шорткатом (перекрывает paddingTop), инсет всё равно должен победить.
  return <View style={[styles.container, style, { paddingTop: insets.top }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
