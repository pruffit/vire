import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  estimateUsage,
  listDownloads,
  removeDownload,
  type DownloadedTrackMeta,
} from '../lib/offline/download-manager';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';
import { formatDuration, formatBytes } from '../lib/format';
import { Screen } from '../components/screen';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

export default function LibraryScreen() {
  const [downloads, setDownloads] = useState<DownloadedTrackMeta[]>([]);
  const [usage, setUsage] = useState(0);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const load = useCallback(async () => {
    const [list, bytes] = await Promise.all([listDownloads(), estimateUsage()]);
    setDownloads(list);
    setUsage(bytes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Скачивание/удаление происходит на экране релиза — подхватываем изменения при
  // каждом возврате на вкладку, не только на первом монтировании.
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
    playQueue(queue, index);
  };

  const remove = async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await removeDownload(trackId);
    await load();
  };

  return (
    <Screen>
      <Text style={styles.title}>Медиатека</Text>

      {downloads.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="download" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Скачанное</Text>
          <Text style={styles.emptySubtitle}>
            Треки, скачанные для офлайн-прослушивания, появятся здесь
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.usage}>
            {downloads.length} {downloads.length === 1 ? 'трек' : 'треков'} · {formatBytes(usage)}
          </Text>
          <FlatList
            contentContainerStyle={styles.listContent}
            data={downloads}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <DownloadRow
                track={item}
                playing={item.id === currentTrackId}
                onPress={() => play(index)}
                onRemove={() => remove(item.id)}
              />
            )}
          />
        </>
      )}
    </Screen>
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
  usage: { color: colors.mutedForeground, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  rowActive: { backgroundColor: colors.secondary },
  cover: { width: 44, height: 44, borderRadius: radius.sm },
  coverPlaceholder: { backgroundColor: colors.secondary },
  info: { flex: 1, gap: 2 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  trackMeta: { color: colors.mutedForeground, fontSize: 12 },
  removeButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
});
