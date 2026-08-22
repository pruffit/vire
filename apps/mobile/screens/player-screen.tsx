import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { nextQueueIndex } from '@vire/core/playback/queue';
import { usePlayerStore } from '../lib/player-store';
import { formatDuration } from '../lib/format';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

export default function PlayerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const status = usePlayerStore((s) => s.status);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const track = queue[queueIndex];

  useEffect(() => {
    if (!track) navigation.goBack();
  }, [track, navigation]);

  if (!track) return null;

  const hasNext = nextQueueIndex(queueIndex, queue.length, repeat) !== null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: 24 + insets.bottom }]}>
      <Pressable style={styles.closeButton} onPress={() => navigation.goBack()} hitSlop={12}>
        <Icon name="chevron-down" size={22} color={colors.mutedForeground} />
      </Pressable>

      {track.coverUrl ? (
        <Image source={{ uri: track.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}

      <Text style={styles.title} numberOfLines={2}>
        {track.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {track.artistName}
      </Text>
      {status === 'error' && <Text style={styles.errorText}>Не удалось воспроизвести — нажмите play ещё раз</Text>}

      <PositionSlider position={positionSec} duration={durationSec} onSeek={seek} />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatDuration(positionSec)}</Text>
        <Text style={styles.timeText}>{formatDuration(durationSec)}</Text>
      </View>

      <View style={styles.transportRow}>
        <Pressable
          style={styles.transportButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            toggleShuffle();
          }}
          hitSlop={12}
        >
          <Icon name="shuffle" size={20} color={shuffle ? colors.primary : colors.mutedForeground} />
        </Pressable>
        <Pressable style={styles.transportButton} onPress={prev} disabled={queueIndex <= 0} hitSlop={12}>
          <Icon name="skip-back" size={26} color={queueIndex <= 0 ? colors.mutedForeground : colors.foreground} />
        </Pressable>
        <Pressable
          style={styles.playButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            togglePlayPause();
          }}
          hitSlop={12}
        >
          {status === 'loading' ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Icon name={status === 'playing' ? 'pause' : 'play'} size={26} color={colors.primaryForeground} />
          )}
        </Pressable>
        <Pressable style={styles.transportButton} onPress={next} disabled={!hasNext} hitSlop={12}>
          <Icon name="skip-forward" size={26} color={!hasNext ? colors.mutedForeground : colors.foreground} />
        </Pressable>
        <Pressable
          style={styles.transportButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            cycleRepeat();
          }}
          hitSlop={12}
        >
          <Icon name="repeat" size={20} color={repeat !== 'off' ? colors.primary : colors.mutedForeground} />
          {repeat === 'one' && (
            <View style={styles.repeatBadge}>
              <Text style={styles.repeatBadgeText}>1</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function PositionSlider({
  position,
  duration,
  onSeek,
}: {
  position: number;
  duration: number;
  onSeek: (sec: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragSec, setDragSec] = useState<number | null>(null);
  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const clampFromTouch = (x: number) => {
    if (widthRef.current <= 0 || durationRef.current <= 0) return 0;
    const ratio = Math.min(Math.max(x / widthRef.current, 0), 1);
    return ratio * durationRef.current;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durationRef.current > 0,
      onMoveShouldSetPanResponder: () => durationRef.current > 0,
      onPanResponderGrant: (e) => setDragSec(clampFromTouch(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setDragSec(clampFromTouch(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        const sec = clampFromTouch(e.nativeEvent.locationX);
        onSeek(sec);
        setDragSec(null);
      },
    }),
  ).current;

  const shownSec = dragSec ?? position;
  const ratio = duration > 0 ? Math.min(shownSec / duration, 1) : 0;

  return (
    <View
      style={styles.track}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}
    >
      <View style={styles.trackBase} />
      <View style={[styles.trackFill, { width: width * ratio }]} />
      <View style={[styles.thumb, { left: Math.max(0, width * ratio - 7) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  closeButton: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', aspectRatio: 1, borderRadius: radius.xl, marginTop: 8 },
  coverPlaceholder: { backgroundColor: colors.secondary },
  title: { color: colors.foreground, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 24 },
  artist: { color: colors.mutedForeground, fontSize: 16, fontWeight: '500', textAlign: 'center' },
  errorText: { color: colors.destructive, fontSize: 13, textAlign: 'center', marginTop: 4 },
  track: { width: '100%', height: 24, justifyContent: 'center', marginTop: 32 },
  trackBase: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.secondary },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  timeText: { color: colors.mutedForeground, fontSize: 12, fontVariant: ['tabular-nums'] },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 'auto',
  },
  transportButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  repeatBadge: {
    position: 'absolute',
    top: 0,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadgeText: { color: colors.primaryForeground, fontSize: 9, fontWeight: '800', lineHeight: 11 },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
