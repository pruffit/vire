import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassPanel } from './glass-panel';
import { VIREGLASS_SHEET_MATERIAL } from '../../lib/vireglass/material';
import { Icon } from '../../lib/icon';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';


/**
 * Лист поверх экрана — БЕЗ `Modal`: у Modal своё окно, и системный диалог поверх продукта
 * выглядит чужим.
 *
 * Живого фона у листа НЕТ намеренно. Лист обязан отделять себя от экрана, а не показывать
 * его: с преломлением сквозь него читались кнопки транспорта и прогресс, и вёрстка выглядела
 * сломанной. Ни затемнение, ни матовость этого не лечат — плоский скрим поверх резкой
 * картинки её не прячет. Материал здесь работает кромкой и бликом, а тело даёт плотность.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  if (!open) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.dock}>
        <GlassPanel
          radius={radii.sheet}
          material={VIREGLASS_SHEET_MATERIAL}
          adaptive={false}
          style={styles.panel}
          contentStyle={[styles.body, { paddingBottom: insets.bottom + space.lg }]}
        >
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={type.releaseTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Icon name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </GlassPanel>
      </View>
    </View>
  );
}

/** Строка действия в листе: знак, название, необязательная подпись. */
export function SheetRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowGlyph}>
        <Icon name={icon} size={20} color={colors.foreground} />
      </View>
      <View style={styles.rowText}>
        <Text style={type.row} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={type.caption} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const GLYPH = 44;

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  // Панель уходит под нижнюю кромку на радиус: SDF знает один радиус на все углы, и без
  // выпуска нижние скругления висели бы в воздухе.
  dock: { position: 'absolute', left: 0, right: 0, bottom: -radii.sheet, maxHeight: '82%' },
  panel: { flex: 1 },
  body: { flex: 1, paddingHorizontal: layout.screenPadding, paddingTop: space.sm, gap: space.xs },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: layout.touchTarget, height: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
  pressed: { opacity: 0.7 },
  rowGlyph: {
    width: GLYPH,
    height: GLYPH,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
});
