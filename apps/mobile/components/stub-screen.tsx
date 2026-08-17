import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

export function StubScreen({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Скоро</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 },
  icon: { fontSize: 40 },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: 15 },
});
