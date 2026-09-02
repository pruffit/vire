import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { trackLyricsResponseSchema, type TrackLyricsResponse } from '@vire/api-contracts';

type LyricLine = NonNullable<TrackLyricsResponse['lyrics']>[number];
import { apiRequest } from '../../lib/api-client';
import { usePlayerStore, type QueueTrack } from '../../lib/player-store';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space } from '../../lib/design/scales';
import { TrackRow } from '../ui/track-row';

function SectionLoading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.mutedForeground} />
    </View>
  );
}

function SectionEmpty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={type.caption}>{text}</Text>
    </View>
  );
}

/** Что дальше в очереди. Тап — переход к треку без выхода из плеера. */
export function QueueSection() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const context = usePlayerStore((s) => s.context);

  const upcoming = queue.slice(queueIndex + 1);

  if (upcoming.length === 0) {
    return <SectionEmpty text="Это последний трек в очереди" />;
  }

  return (
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
  );
}

/**
 * Текст трека. Строки списком, активная (по таймкоду) подсвечена; тап — seek. Без
 * автоскролла: он дерётся с прокруткой страницы, которой теперь принадлежит этот блок.
 */
export function LyricsSection({ trackId }: { trackId: string }) {
  const positionSec = usePlayerStore((s) => s.positionSec);
  const seek = usePlayerStore((s) => s.seek);
  const [lyrics, setLyrics] = useState<LyricLine[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLyrics(undefined);
    apiRequest(`/api/v1/tracks/${encodeURIComponent(trackId)}/lyrics`, {
      schema: trackLyricsResponseSchema,
    }).then((r) => {
      if (!cancelled) setLyrics(r.ok ? r.data.lyrics : null);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const synced = lyrics?.some((l) => l.t !== null) ?? false;
  const activeIndex = synced
    ? lyrics!.reduce((acc, line, i) => (line.t !== null && line.t <= positionSec ? i : acc), -1)
    : -1;

  if (lyrics === undefined) return <SectionLoading />;
  // Инструментальный трек — норма, а не недоделка артиста: отсутствие текста не событие,
  // о котором стоит сообщать. Секции просто нет.
  if (!lyrics || lyrics.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={type.mono}>ТЕКСТ</Text>
      {lyrics.map((line, i) => (
        <Text
          key={i}
          style={[styles.line, i === activeIndex && styles.lineActive]}
          onPress={line.t !== null ? () => seek(line.t!) : undefined}
        >
          {line.text || ' '}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  empty: { paddingVertical: space.xl, alignItems: 'center' },
  list: { gap: 2 },
  line: {
    ...type.body,
    minHeight: 30,
    lineHeight: 30,
    color: colors.mutedForeground,
  },
  lineActive: { color: colors.foreground },
});
