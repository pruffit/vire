import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';
import { Icon, type IconName } from '../../lib/icon';

/**
 * Сквозные состояния экранов.
 *
 * До кита каждый экран писал их сам: состояние ошибки с кнопкой «Повторить» было
 * скопировано в 8 файлов, центрированный контейнер — в 9, `ActivityIndicator` — в 12.
 * Расхождения между копиями и были главным источником визуальной несобранности.
 */

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function LoadingState() {
  return (
    <Centered>
      <ActivityIndicator color={colors.foreground} size="large" />
    </Centered>
  );
}

export function ErrorState({
  title = 'Не удалось загрузить',
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <Centered>
      <Text style={styles.title}>{title}</Text>
      {onRetry && (
        <Pressable style={styles.action} onPress={onRetry} accessibilityRole="button">
          <Text style={type.button}>Повторить</Text>
        </Pressable>
      )}
    </Centered>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Centered>
      {icon && (
        <View style={styles.iconWrap}>
          <Icon name={icon} size={26} color={colors.mutedForeground} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {action && (
        <Pressable style={styles.action} onPress={action.onPress} accessibilityRole="button">
          <Text style={type.button}>{action.label}</Text>
        </Pressable>
      )}
    </Centered>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  title: { ...type.sectionTitle, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  hint: { ...type.caption, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  action: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
  },
});
