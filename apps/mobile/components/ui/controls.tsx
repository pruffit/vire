import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';

/**
 * Кнопки и секции кита.
 *
 * Закон кита без исключений: **иконка = круг, текст = пилюля**. Иконка с подписью в одной
 * кнопке не сочетается нигде. Круглые иконочные кнопки на стекле — это `LiquidGlassButton`
 * (`components/liquid-glass.tsx`); здесь — их матовые собратья для плотного контента.
 */

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={type.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function PillButton({
  label,
  onPress,
  variant = 'solid',
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'quiet';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        variant === 'solid' ? styles.pillSolid : styles.pillQuiet,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[type.button, variant === 'solid' && styles.pillSolidLabel]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Чип фильтра. Всегда нейтрален — даже внутри профиля артиста: чипы категориальные, а не
 * персональные, и красить их темой артиста означало бы приписывать ему чужие жанры.
 */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Скелетон в форме будущего контента — честнее спиннера: показывает, что именно грузится. */
export function Skeleton({ width, height, radius = radii.coverSm }: { width?: number | `${number}%`; height: number; radius?: number }) {
  return <View style={[styles.skeleton, { width: width ?? '100%', height, borderRadius: radius }]} />;
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  pill: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radii.full,
  },
  pillSolid: { backgroundColor: colors.foreground },
  pillSolidLabel: { color: colors.background },
  pillQuiet: { backgroundColor: colors.secondary },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  chip: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
  },
  chipSelected: { backgroundColor: colors.foreground },
  chipLabel: { ...type.row, color: colors.mutedForeground },
  chipLabelSelected: { color: colors.background },
  skeleton: { backgroundColor: colors.secondary, opacity: 0.6 },
});
