import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { request } from '@vire/api-client';
import { releaseDetailResponseSchema, type ReleaseDetailResponse } from '@vire/api-contracts';
import type { HomeStackParamList } from '../navigation/home-stack';
import { API_BASE_URL } from '../lib/env';
import { colors, radius } from '../lib/theme';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';
import { formatDuration } from '../lib/format';

type LoadState = 'loading' | 'error' | 'ready';
type TrackItem = ReleaseDetailResponse['tracks'][number];

export default function ReleaseScreen({ route }: NativeStackScreenProps<HomeStackParamList, 'ReleaseDetail'>) {
  const { releaseId, title, artistName, coverUrl } = route.params;
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const load = useCallback(async () => {
    const result = await request(`${API_BASE_URL}/api/v1/releases/${releaseId}`, {
      schema: releaseDetailResponseSchema,
    });
    if (!result.ok) return false;
    setTracks(result.data.tracks);
    return true;
  }, [releaseId]);

  const initialLoad = useCallback(async () => {
    setState('loading');
    setState((await load()) ? 'ready' : 'error');
  }, [load]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await load();
    setRefreshing(false);
  }, [load]);

  const play = (index: number) => {
    const queue: QueueTrack[] = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName,
      coverUrl,
      durationSec: t.durationSec,
    }));
    playQueue(queue, index);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {artistName}
        </Text>
      </View>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить трек-лист</Text>
          <Pressable style={styles.retryButton} onPress={initialLoad}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TrackRow track={item} playing={item.id === currentTrackId} onPress={() => play(index)} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
          }
        />
      )}
    </View>
  );
}

function TrackRow({ track, playing, onPress }: { track: TrackItem; playing: boolean; onPress: () => void }) {
  const disabled = track.status !== 'READY';
  return (
    <Pressable
      style={[styles.trackRow, playing && styles.trackRowActive]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.trackNumber, disabled && styles.trackDisabled]}>{track.trackNumber}</Text>
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, disabled && styles.trackDisabled]} numberOfLines={1}>
          {track.title}
          {track.isExplicit ? ' 🅴' : ''}
        </Text>
        {disabled && <Text style={styles.trackStatus}>Недоступен</Text>}
      </View>
      <Text style={[styles.trackDuration, disabled && styles.trackDisabled]}>{formatDuration(track.durationSec)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, alignItems: 'center', gap: 6 },
  cover: { width: 180, height: 180, borderRadius: radius.lg, marginBottom: 8 },
  coverPlaceholder: { backgroundColor: colors.secondary },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  artist: { color: colors.mutedForeground, fontSize: 15, fontWeight: '500', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  messageText: { color: colors.mutedForeground, fontSize: 15, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { color: colors.foreground, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 96 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  trackRowActive: { backgroundColor: colors.secondary },
  trackNumber: { color: colors.mutedForeground, fontSize: 14, minWidth: 20, textAlign: 'center' },
  trackInfo: { flex: 1, gap: 2 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  trackStatus: { color: colors.mutedForeground, fontSize: 12 },
  trackDuration: { color: colors.mutedForeground, fontSize: 13, fontVariant: ['tabular-nums'] },
  trackDisabled: { color: colors.mutedForeground, opacity: 0.5 },
});
