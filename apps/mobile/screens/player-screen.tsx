import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { nextQueueIndex } from '@vire/core/playback/queue';
import { usePlayerStore } from '../lib/player-store';
import { usePreferences } from '../lib/design/preferences';
import { WEB_BASE_URL } from '../lib/env';
import { formatDuration } from '../lib/format';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';
import { Icon } from '../lib/icon';
import { Cover } from '../components/ui/cover';
import { GlassPanel } from '../components/ui/glass-panel';
import { LikeButton } from '../components/like-button';
import { Waveform } from '../components/player/waveform';
import { QueuePanel, LyricsPanel, TrackPanel } from '../components/player/panels';

type Panel = 'queue' | 'lyrics' | 'track';

const PANELS: { key: Panel; label: string }[] = [
  { key: 'queue', label: 'Очередь' },
  { key: 'lyrics', label: 'Текст' },
  { key: 'track', label: 'Трек' },
];

/**
 * Основная поверхность текущего трека.
 *
 * Совмещает то, что на вебе разнесено между плеером и страницей трека: панель «Трек»
 * заменяет отдельный экран (`MOBILE_PRODUCT_ARCHITECTURE.md` §5.3). На телефоне уходить
 * от воспроизведения, чтобы почитать о том, что играет, — веб-логика.
 */
export default function PlayerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const status = usePlayerStore((s) => s.status);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const waveformPeaks = usePlayerStore((s) => s.waveformPeaks);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const [panel, setPanel] = useState<Panel>('queue');
  const track = queue[queueIndex];

  // Плеер перекрывает таб-бар и мини-плеер целиком: их стеклу под ним преломлять нечего,
  // а бюджет поверхностей иначе выходит за измеренную зелёную зону (4+1+2 = 7).
  const pushSheet = usePreferences((s) => s.pushSheet);
  const popSheet = usePreferences((s) => s.popSheet);
  useEffect(() => {
    pushSheet();
    return popSheet;
  }, [pushSheet, popSheet]);

  if (!track) return null;

  const hasNext = nextQueueIndex(queueIndex, queue.length, repeat) !== null;
  const playing = status === 'playing';
  const artSize = Math.min(width - space.xl * 2, 360);

  const tap = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };

  const share = () => {
    Share.share({
      message: `${track.title} — ${track.artistName}`,
      url: `${WEB_BASE_URL}/`,
    }).catch(() => {});
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom }]}>
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Свернуть плеер">
          <Icon name="chevron-down" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.topActions}>
          <LikeButton trackId={track.id} />
          <Pressable onPress={share} hitSlop={12} accessibilityRole="button" accessibilityLabel="Поделиться">
            <Icon name="share" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.art}>
        <Cover uri={track.coverUrl} size={artSize} radius={radii.card} />
      </View>

      <View style={styles.titles}>
        <Text style={type.releaseTitle} numberOfLines={2}>
          {track.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {track.artistName}
        </Text>
      </View>

      <View style={styles.scrubber}>
        <Waveform peaks={waveformPeaks} positionSec={positionSec} durationSec={durationSec} onSeek={seek} />
        <View style={styles.times}>
          <Text style={type.mono}>{formatDuration(positionSec)}</Text>
          <Text style={type.mono}>{formatDuration(durationSec)}</Text>
        </View>
      </View>

      {status === 'error' && <Text style={styles.error}>Не удалось воспроизвести — нажмите play ещё раз</Text>}

      <GlassPanel radius={radii.glass} style={styles.transport} contentStyle={styles.transportRow}>
        <Pressable onPress={tap(toggleShuffle)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Перемешать">
          <Icon name="shuffle" size={19} color={shuffle ? colors.foreground : colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={tap(prev)} disabled={queueIndex <= 0} hitSlop={10} accessibilityRole="button" accessibilityLabel="Предыдущий">
          <Icon name="skip-back" size={25} color={queueIndex <= 0 ? colors.mutedForeground : colors.foreground} />
        </Pressable>
        <Pressable style={styles.playButton} onPress={tap(togglePlayPause)} accessibilityRole="button" accessibilityLabel={playing ? 'Пауза' : 'Играть'}>
          {status === 'loading' ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={24} color={colors.background} />
          )}
        </Pressable>
        <Pressable onPress={tap(next)} disabled={!hasNext} hitSlop={10} accessibilityRole="button" accessibilityLabel="Следующий">
          <Icon name="skip-forward" size={25} color={hasNext ? colors.foreground : colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={tap(cycleRepeat)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Повтор">
          <Icon name="repeat" size={19} color={repeat !== 'off' ? colors.foreground : colors.mutedForeground} />
          {repeat === 'one' && <View style={styles.repeatDot} />}
        </Pressable>
      </GlassPanel>

      <View style={styles.tabs}>
        {PANELS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPanel(p.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: panel === p.key }}
          >
            <Text style={[styles.tabLabel, panel === p.key && styles.tabLabelActive]}>{p.label}</Text>
            {panel === p.key && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <View style={styles.panelBody}>
        {panel === 'queue' && <QueuePanel />}
        {panel === 'lyrics' && <LyricsPanel trackId={track.id} />}
        {panel === 'track' && <TrackPanel track={track} />}
      </View>
    </View>
  );
}

// Обложка — источник света экрана: мягкое затемнение сверху вниз, чтобы транспорт и
// панели читались, а картинка не выглядела вырезанной.
const SCRIM = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.55)', 'rgba(3,2,1,0.92)'] as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: layout.screenPadding },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: layout.touchTarget },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  art: { alignItems: 'center', paddingVertical: space.md },
  titles: { gap: 4, paddingBottom: space.md },
  scrubber: { gap: space.xs },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { ...type.caption, color: colors.destructive, paddingTop: space.sm },
  transport: { marginTop: space.md, height: 64 },
  transportRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: space.lg,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foreground,
  },
  repeatDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
  },
  tabs: { flexDirection: 'row', gap: space.xl, paddingTop: space.lg, paddingHorizontal: space.xs },
  tab: { paddingVertical: space.sm, gap: 6 },
  tabLabel: { ...type.sectionTitle, color: colors.mutedForeground },
  tabLabelActive: { color: colors.foreground },
  tabUnderline: { height: 2, borderRadius: radii.full, backgroundColor: colors.foreground },
  panelBody: { flex: 1, minHeight: 0, paddingTop: space.sm },
});
