import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import type { PlaylistSummaryDTO } from '@vire/api-contracts';
import type { LibraryStackParamList } from '../navigation/library-stack';
import {
  estimateUsage,
  listDownloads,
  removeDownload,
  type DownloadedTrackMeta,
} from '../lib/offline/download-manager';
import { fetchPlaylists } from '../lib/playlists';
import { useContentBottomPadding } from '../lib/layout';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';
import { formatDuration, formatBytes } from '../lib/format';
import { Screen } from '../components/screen';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

export default function LibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList, 'LibraryHome'>>();
  const bottomPadding = useContentBottomPadding();
  const [downloads, setDownloads] = useState<DownloadedTrackMeta[]>([]);
  const [usage, setUsage] = useState(0);
  const [playlists, setPlaylists] = useState<PlaylistSummaryDTO[]>([]);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const load = useCallback(async () => {
    const [list, bytes, playlistsResult] = await Promise.all([
      listDownloads(),
      estimateUsage(),
      fetchPlaylists(),
    ]);
    setDownloads(list);
    setUsage(bytes);
    if (playlistsResult.ok) setPlaylists(playlistsResult.data.playlists);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Скачивание/удаление происходит на экране релиза, плейлисты меняются с разных экранов —
  // подхватываем изменения при каждом возврате на вкладку, не только на первом монтировании.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const play = (index: number) => {
    const queue: QueueTrack[] = downloads.map((d) => ({
      id: d.id,
      title: d.title,
      artistName: d.artistName,
      coverUrl: d.coverUrl,
      durationSec: d.durationSec,
    }));
    playQueue(queue, index, { source: 'liked' });
  };

  const remove = async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await removeDownload(trackId);
    await load();
  };

  const openPlaylist = (playlist: PlaylistSummaryDTO) =>
    navigation.navigate('PlaylistDetail', {
      playlistId: playlist.id,
      title: playlist.title,
      coverUrl: playlist.coverUrl,
    });

  return (
    <Screen>
      <FlatList
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
        data={downloads}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Медиатека</Text>

            {playlists.length > 0 && (
              <View style={styles.playlistsSection}>
                <Text style={styles.sectionTitle}>Плейлисты</Text>
                <FlatList
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  data={playlists}
                  keyExtractor={(p) => p.id}
                  contentContainerStyle={styles.playlistsRow}
                  renderItem={({ item }) => (
                    <PlaylistCard playlist={item} onPress={() => openPlaylist(item)} />
                  )}
                />
              </View>
            )}

            {downloads.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Скачанное</Text>
                <Text style={styles.usage}>
                  {downloads.length} {downloads.length === 1 ? 'трек' : 'треков'} · {formatBytes(usage)}
                </Text>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          playlists.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="download" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Пока пусто</Text>
              <Text style={styles.emptySubtitle}>
                Плейлисты и треки, скачанные для офлайн-прослушивания, появятся здесь
              </Text>
            </View>
          ) : (
            <View style={styles.emptyDownloadsOnly}>
              <Text style={styles.emptySubtitle}>Скачанных треков пока нет</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <DownloadRow
            track={item}
            playing={item.id === currentTrackId}
            onPress={() => play(index)}
            onRemove={() => remove(item.id)}
          />
        )}
      />
    </Screen>
  );
}

function PlaylistCard({ playlist, onPress }: { playlist: PlaylistSummaryDTO; onPress: () => void }) {
  return (
    <Pressable style={styles.playlistCard} onPress={onPress}>
      {playlist.coverUrl ? (
        <Image source={{ uri: playlist.coverUrl }} style={styles.playlistCover} />
      ) : (
        <View style={[styles.playlistCover, styles.coverPlaceholder]} />
      )}
      <Text style={styles.playlistTitle} numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text style={styles.playlistMeta} numberOfLines={1}>
        {playlist.trackCount} {playlist.trackCount === 1 ? 'трек' : 'треков'}
      </Text>
    </Pressable>
  );
}

function DownloadRow({
  track,
  playing,
  onPress,
  onRemove,
}: {
  track: DownloadedTrackMeta;
  playing: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable style={[styles.row, playing && styles.rowActive]} onPress={onPress}>
      {track.coverUrl ? (
        <Image source={{ uri: track.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.trackMeta} numberOfLines={1}>
          {track.artistName} · {formatDuration(track.durationSec)} · {formatBytes(track.bytes)}
        </Text>
      </View>
      <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={12}>
        <Icon name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.foreground, fontSize: 20, fontWeight: '800', paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  sectionTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  usage: { color: colors.mutedForeground, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  playlistsSection: { gap: 4 },
  playlistsRow: { paddingHorizontal: 16, gap: 12 },
  playlistCard: { width: 120 },
  playlistCover: { width: 120, height: 120, borderRadius: radius.lg },
  playlistTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', marginTop: 8 },
  playlistMeta: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32, paddingTop: 96 },
  emptyDownloadsOnly: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  emptyTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
  listContent: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: radius.md,
  },
  rowActive: { backgroundColor: colors.secondary },
  cover: { width: 44, height: 44, borderRadius: radius.sm },
  coverPlaceholder: { backgroundColor: colors.secondary },
  info: { flex: 1, gap: 2, minWidth: 0 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  trackMeta: { color: colors.mutedForeground, fontSize: 12 },
  removeButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
});
