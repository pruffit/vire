import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle, type View as RNView } from 'react-native';
import type { RefObject } from 'react';
import * as Haptics from 'expo-haptics';
import { GlassPanel } from '../ui/glass-panel';
import { LikeButton } from '../like-button';
import { Icon } from '../../lib/icon';
import { colors } from '../../lib/theme';
import { layout, radii } from '../../lib/design/scales';
import { PLAYER_TRANSPORT_HEIGHT } from '../../lib/layout';
import { PRODUCT_DIM } from '../../lib/vireglass/material';

const PLAY_SIZE = 56;
const ICON_SIZE = 24;

/**
 * Плавающая стеклянная капсула фуллскрин-плеера: лайк и «поделиться» — в главном ряду
 * (поддержка артиста важнее утилит режима), play крупнее остальных.
 */
export function Transport({
  trackId,
  playing,
  loading,
  hasNext,
  hasPrev,
  blurTarget,
  onPrev,
  onNext,
  onTogglePlay,
  onShare,
  style,
}: {
  trackId: string;
  playing: boolean;
  loading: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  blurTarget: RefObject<RNView | null>;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onShare: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tap = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };

  return (
    <GlassPanel
      radius={PLAYER_TRANSPORT_HEIGHT / 2}
      blurTarget={blurTarget}
      dim={PRODUCT_DIM}
      style={[styles.panel, style]}
      contentStyle={styles.row}
    >
      <LikeButton trackId={trackId} variant="primary" />
      <Pressable
        onPress={tap(onPrev)}
        disabled={!hasPrev}
        hitSlop={8}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Предыдущий трек"
      >
        <Icon name="skip-back" size={ICON_SIZE} color={hasPrev ? colors.foreground : colors.mutedForeground} />
      </Pressable>
      <Pressable
        onPress={tap(onTogglePlay)}
        style={styles.playButton}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Пауза' : 'Играть'}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={26} color={colors.background} />
        )}
      </Pressable>
      <Pressable
        onPress={tap(onNext)}
        disabled={!hasNext}
        hitSlop={8}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Следующий трек"
      >
        <Icon name="skip-forward" size={ICON_SIZE} color={hasNext ? colors.foreground : colors.mutedForeground} />
      </Pressable>
      <Pressable onPress={tap(onShare)} hitSlop={8} style={styles.button} accessibilityRole="button" accessibilityLabel="Поделиться">
        <Icon name="share" size={20} color={colors.foreground} />
      </Pressable>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  panel: { height: PLAYER_TRANSPORT_HEIGHT },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
  },
  button: { width: layout.touchTarget, height: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foreground,
  },
});
