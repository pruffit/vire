import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space } from '../../lib/design/scales';

/**
 * Разделитель секций фуллскрин-плеера: волосяная линейка с моно-меткой на самой линии,
 * один приём для ТЕКСТ/ТРЕК/ДАЛЬШЕ вместо подписи-eyebrow над заголовком.
 */
export function SectionDivider({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  label: { ...type.mono, textTransform: 'uppercase' },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
});
