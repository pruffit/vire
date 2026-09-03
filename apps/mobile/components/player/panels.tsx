import { StyleSheet, Text, View } from 'react-native';
import { usePlayerStore, type QueueTrack } from '../../lib/player-store';
import { type } from '../../lib/design/typography';
import { space } from '../../lib/design/scales';
import { TrackRow } from '../ui/track-row';

/**
 * Что дальше в очереди. Тап — переход к треку без выхода из плеера.
 *
 * Блок несёт собственный заголовок: пустая очередь — не состояние, о котором стоит
 * сообщать. Строка «это последний трек» занимала место и оставляла под собой мёртвую зону.
 */
export function QueueSection() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const context = usePlayerStore((s) => s.context);

  const upcoming = queue.slice(queueIndex + 1);
  if (upcoming.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={type.mono}>ДАЛЬШЕ</Text>
      <View style={styles.list}>
        {upcoming.map((t: QueueTrack, i) => (
          <TrackRow
            key={`${t.id}-${i}`}
            title={t.title}
            subtitle={t.artistName}
            coverUrl={t.coverUrl}
            onPress={() => playQueue(queue, queueIndex + 1 + i, context ?? { source: 'direct' })}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  list: { gap: 2 },
});
