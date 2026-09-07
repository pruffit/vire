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
 *
 * `title` — рядом с заголовком трека на экране плеера: размер задаёт экран через `size`,
 * потому что там он идёт по масштабу макета, а не в чистых dp; тач-зона добирается
 * hitSlop (кит запрещает раздувать под неё сам значок).
 */
type Variant = 'inline' | 'primary' | 'title';

const ICON_SIZE: Record<Variant, number> = { inline: 18, primary: 24, title: 21 };
const HIT_SLOP: Record<Variant, number> = { inline: 12, primary: 12, title: 14 };

export function LikeButton({
  trackId,
  variant = 'inline',
  size,
}: {
  trackId: string;
  variant?: Variant;
  size?: number;
}) {
  const liked = useLikesStore((s) => s.state[trackId]);
  const load = useLikesStore((s) => s.load);
  const toggle = useLikesStore((s) => s.toggle);

  useEffect(() => {
    load(trackId);
  }, [load, trackId]);

  const idle = variant === 'inline' ? colors.mutedForeground : colors.foreground;
  const iconSize = size ?? ICON_SIZE[variant];

  return (
    <Pressable
      style={[
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'title' && { minWidth: iconSize, minHeight: iconSize },
      ]}
      hitSlop={HIT_SLOP[variant]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!liked }}
      accessibilityLabel={liked ? 'Убрать лайк' : 'Лайк'}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        toggle(trackId);
      }}
    >
      <Icon name="heart" size={iconSize} color={liked ? colors.primary : idle} filled={!!liked} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  primary: { minWidth: layout.touchTarget, minHeight: layout.touchTarget },
});
