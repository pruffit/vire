import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { PlaylistDetailResponse } from '@vire/api-contracts';
import type { LibraryStackParamList } from '../navigation/library-stack';
import { fetchPlaylistDetail } from '../lib/playlists';
import { colors, radius } from '../lib/theme';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';
import { formatDuration } from '../lib/format';
import { Screen } from '../components/screen';
import { useContentBottomPadding } from '../lib/layout';
import { LikeButton } from '../components/like-button';
import { AddToPlaylistSheet } from '../components/add-to-playlist-sheet';
import { DownloadButton } from '../components/download-button';

type LoadState = 'loading' | 'error' | 'ready';
type PlaylistTrackItem = PlaylistDetailResponse['playlist']['tracks'][number];

// Тот же приём полноразмерного размытого фона шапки, что в release-screen.tsx.
const HEADER_SCRIM = ['rgba(3,2,1,0.35)', 'rgba(3,2,1,0.55)', '#030201'] as const;

// Узкая типизация по route.params — тот же приём, что в screens/release-screen.tsx
// (экран не читает `navigation`, не завязан на конкретный список роутов стека).
export default function PlaylistScreen({
  route,
}: {
  route: { params: LibraryStackParamList['PlaylistDetail'] };
}) {
  const { playlistId } = route.params;
  const bottomPadding = useContentBottomPadding();
  const [playlist, setPlaylist] = useState<PlaylistDetailResponse['playlist'] | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const title = playlist?.title ?? route.params.title ?? 'Плейлист';
  const coverUrl = playlist?.coverUrl ?? route.params.coverUrl ?? null;
  const tracks = playlist?.tracks ?? [];

  const load = useCallback(async () => {
    const result = await fetchPlaylistDetail(playlistId);
    if (!result.ok) return false;
    setPlaylist(result.data.playlist);
    return true;
  }, [playlistId]);

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
      artistName: t.artistName,
      coverUrl: t.coverUrl,
      durationSec: t.durationSec,
    }));
    playQueue(queue, index);
  };

  return (
    <Screen>
      <View style={styles.header}>
        {coverUrl && (
          <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} blurRadius={60} contentFit="cover" />
        )}
        <LinearGradient colors={HEADER_SCRIM} style={StyleSheet.absoluteFill} />
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {tracks.length > 0 && (
          <Text style={styles.count}>
            {tracks.length} {tracks.length === 1 ? 'трек' : 'треков'}
          </Text>
        )}
      </View>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить плейлист</Text>
          <Pressable style={styles.retryButton} onPress={initialLoad}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && tracks.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>В плейлисте пока нет треков</Text>
        </View>
      )}

      {state === 'ready' && tracks.length > 0 && (
        <FlatList
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
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

function TrackRow({
  track,
  playing,
  onPress,
}: {
  track: PlaylistTrackItem;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.trackRow, playing && styles.trackRowActive]} onPress={onPress}>
      {track.coverUrl ? (
        <Image source={{ uri: track.coverUrl }} style={styles.trackCover} />
      ) : (
        <View style={[styles.trackCover, styles.coverPlaceholder]} />
      )}
      <View style={styles.trackInfo}>
        <View style={styles.trackTitleRow}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {track.title}
          </Text>
          {track.isExplicit && (
            <View style={styles.explicitBadge}>
              <Text style={styles.explicitText}>E</Text>
            </View>
          )}
        </View>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artistName}
        </Text>
      </View>
      <Text style={styles.trackDuration}>{formatDuration(track.durationSec)}</Text>
      <LikeButton trackId={track.id} />
      <AddToPlaylistSheet trackId={track.id} />
      <DownloadButton
        meta={{ id: track.id, title: track.title, artistName: track.artistName, coverUrl: track.coverUrl, durationSec: track.durationSec }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, alignItems: 'center', gap: 6, overflow: 'hidden' },
  cover: { width: 160, height: 160, borderRadius: radius.lg, marginBottom: 8 },
  coverPlaceholder: { backgroundColor: colors.secondary },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  count: { color: colors.mutedForeground, fontSize: 13, fontWeight: '500' },
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
  listContent: { paddingHorizontal: 16 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  trackRowActive: { backgroundColor: colors.secondary },
  trackCover: { width: 40, height: 40, borderRadius: radius.sm },
  trackInfo: { flex: 1, gap: 2, minWidth: 0 },
  trackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  trackArtist: { color: colors.mutedForeground, fontSize: 12.5, fontWeight: '500' },
  explicitBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicitText: { color: colors.mutedForeground, fontSize: 9, fontWeight: '800' },
  trackDuration: { color: colors.mutedForeground, fontSize: 13, fontVariant: ['tabular-nums'] },
});
