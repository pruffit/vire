import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/screen';
import { useContentBottomPadding } from '../lib/layout';
import { useScrollEdge } from '../lib/scroll-edge';
import { usePreferences } from '../lib/design/preferences';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';
import { isCrashReportingEnabled } from '../lib/crash-reporting';

/**
 * Оформление и диагностика.
 *
 * Тумблер стекла — не украшательство, а **аварийный выход**: конверт производительности
 * VireGlass измерен на одном флагмане, поведение на слабом железе неизвестно. Выключение
 * снимает бэкдроп во всём приложении разом и делает панели непрозрачными.
 */
export default function SettingsScreen() {
  const bottomPadding = useContentBottomPadding();
  const scrollEdge = useScrollEdge();
  const glassEnabled = usePreferences((s) => s.glassEnabled);
  const reduceMotion = usePreferences((s) => s.reduceMotion);
  const setGlassEnabled = usePreferences((s) => s.setGlassEnabled);
  const setReduceMotion = usePreferences((s) => s.setReduceMotion);

  return (
    <Screen>
      <ScrollView {...scrollEdge} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        <Text style={type.screenTitle}>Настройки</Text>

        <View style={styles.group}>
          <ToggleRow
            title="Стеклянный интерфейс"
            hint="Панели преломляют фон. Выключите, если приложение подтормаживает — они станут непрозрачными."
            value={glassEnabled}
            onChange={setGlassEnabled}
          />
          <ToggleRow
            title="Приглушить движение"
            hint="Убирает анимации переходов и нажатий."
            value={reduceMotion}
            onChange={setReduceMotion}
          />
        </View>

        <Text style={styles.footnote}>
          {isCrashReportingEnabled()
            ? 'Отчёты о сбоях включены — они помогают чинить падения быстрее.'
            : 'Отчёты о сбоях выключены.'}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    onChange(!value);
  };

  return (
    <Pressable
      style={styles.row}
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      accessibilityHint={hint}
    >
      <View style={styles.rowText}>
        <Text style={type.row}>{title}</Text>
        <Text style={type.caption}>{hint}</Text>
      </View>
      {/* Свитч не перехватывает нажатие: вся строка — одна тач-зона, так попасть проще. */}
      <View pointerEvents="none">
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.secondary, true: colors.foreground }}
          thumbColor={value ? colors.background : colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: space.lg,
    gap: space.xl,
  },
  group: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: layout.touchTarget + 16,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  rowText: { flex: 1, gap: 3 },
  footnote: { ...type.caption, paddingHorizontal: space.md },
});
