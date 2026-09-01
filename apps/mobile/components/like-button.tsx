import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLikesStore } from '../lib/likes-store';
import { Icon } from '../lib/icon';
import { colors } from '../lib/theme';
import { layout } from '../lib/design/scales';

/**
 * `primary` — место в главном ряду действий (транспорт плеера): полноразмерная тач-зона и
 * белая иконка в неактивном состоянии. Приглушённое сердце рядом с белыми кнопками
 * перемотки читалось бы как отключённое.
 */
type Variant = 'inline' | 'primary';

const ICON_SIZE: Record<Variant, number> = { inline: 18, primary: 24 };

export function LikeButton({ trackId, variant = 'inline' }: { trackId: string; variant?: Variant }) {
  const liked = useLikesStore((s) => s.state[trackId]);
  const load = useLikesStore((s) => s.load);
  const toggle = useLikesStore((s) => s.toggle);

  useEffect(() => {
    load(trackId);
  }, [load, trackId]);

  const idle = variant === 'primary' ? colors.foreground : colors.mutedForeground;

  return (
    <Pressable
      style={[styles.button, variant === 'primary' && styles.primary]}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityState={{ selected: !!liked }}
      accessibilityLabel={liked ? 'Убрать лайк' : 'Лайк'}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        toggle(trackId);
      }}
    >
      <Icon name="heart" size={ICON_SIZE[variant]} color={liked ? colors.primary : idle} filled={!!liked} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  primary: { minWidth: layout.touchTarget, minHeight: layout.touchTarget },
});
