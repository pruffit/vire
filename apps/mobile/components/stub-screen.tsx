import { StyleSheet, Text } from 'react-native';
import { Icon, type IconName } from '../lib/icon';
import { Screen } from './screen';
import { colors } from '../lib/theme';

export function StubScreen({ icon, title }: { icon: IconName; title: string }) {
  return (
    <Screen style={styles.container}>
      <Icon name={icon} size={40} color={colors.mutedForeground} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Скоро</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: 15 },
});
