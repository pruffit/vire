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
import { releaseDetailResponseSchema, type ReleaseDetailResponse } from '@vire/api-contracts';
import type { HomeStackParamList } from '../navigation/home-stack';
import { apiRequest } from '../lib/api-client';
import { colors, radius } from '../lib/theme';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';
import { formatDuration } from '../lib/format';
import { Screen } from '../components/screen';
import { LikeButton } from '../components/like-button';
import { AddToPlaylistSheet } from '../components/add-to-playlist-sheet';

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
    // apiRequest — релиз может быть черновиком/WIP, виден только владельцу/стаффу.
    const result = await apiRequest(`/api/v1/releases/${releaseId}`, {
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
    <Screen>
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
    </Screen>
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
        <View style={styles.trackTitleRow}>
          <Text style={[styles.trackTitle, disabled && styles.trackDisabled]} numberOfLines={1}>
            {track.title}
          </Text>
          {track.isExplicit && (
            <View style={styles.explicitBadge}>
              <Text style={styles.explicitText}>E</Text>
            </View>
          )}
        </View>
        {disabled && <Text style={styles.trackStatus}>Недоступен</Text>}
      </View>
      <Text style={[styles.trackDuration, disabled && styles.trackDisabled]}>{formatDuration(track.durationSec)}</Text>
      <LikeButton trackId={track.id} />
      <AddToPlaylistSheet trackId={track.id} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  trackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  explicitBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicitText: { color: colors.mutedForeground, fontSize: 9, fontWeight: '800' },
  trackStatus: { color: colors.mutedForeground, fontSize: 12 },
  trackDuration: { color: colors.mutedForeground, fontSize: 13, fontVariant: ['tabular-nums'] },
  trackDisabled: { color: colors.mutedForeground, opacity: 0.5 },
});
