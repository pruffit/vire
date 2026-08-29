import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { trackLyricsResponseSchema, type TrackLyricsResponse } from '@vire/api-contracts';

type LyricLine = NonNullable<TrackLyricsResponse['lyrics']>[number];
import { apiRequest } from '../../lib/api-client';
import { usePlayerStore, type QueueTrack } from '../../lib/player-store';
import { formatDuration } from '../../lib/format';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, radii } from '../../lib/design/scales';
import { TrackRow } from '../ui/track-row';
import { LoadingState, EmptyState } from '../ui/states';

/** Что дальше в очереди. Тап — переход к треку без выхода из плеера. */
export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const context = usePlayerStore((s) => s.context);

  const upcoming = queue.slice(queueIndex + 1);

  if (upcoming.length === 0) {
    return <EmptyState title="Дальше пусто" hint="Это последний трек в очереди." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {upcoming.map((t: QueueTrack, i) => (
        <TrackRow
          key={`${t.id}-${i}`}
          title={t.title}
          subtitle={t.artistName}
          coverUrl={t.coverUrl}
          onPress={() => playQueue(queue, queueIndex + 1 + i, context ?? { source: 'direct' })}
        />
      ))}
    </ScrollView>
  );
}

/**
 * Текст трека. Синхронизированный подсвечивает текущую строку и доскролливает к ней;
 * без таймкодов показывается статично — оба варианта приходят одним контрактом.
 */
export function LyricsPanel({ trackId }: { trackId: string }) {
  const positionSec = usePlayerStore((s) => s.positionSec);
  const seek = usePlayerStore((s) => s.seek);
  const [lyrics, setLyrics] = useState<LyricLine[] | null | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

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

  useEffect(() => {
    if (activeIndex < 0) return;
    // Держим активную строку в верхней трети — так видно, что будет дальше.
    scrollRef.current?.scrollTo({ y: Math.max(0, activeIndex * LINE_HEIGHT - LINE_HEIGHT * 2), animated: true });
  }, [activeIndex]);

  if (lyrics === undefined) return <LoadingState />;
  if (!lyrics || lyrics.length === 0) {
    return <EmptyState title="Текста нет" hint="Артист ещё не добавил слова к этому треку." />;
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.lyrics} showsVerticalScrollIndicator={false}>
      {lyrics.map((line, i) => (
        <Text
          key={i}
          style={[styles.line, i === activeIndex && styles.lineActive]}
          onPress={line.t !== null ? () => seek(line.t!) : undefined}
        >
          {line.text || ' '}
        </Text>
      ))}
    </ScrollView>
  );
}

const LINE_HEIGHT = 30;

/** Мета трека: то, ради чего на вебе есть отдельная страница трека. */
export function TrackPanel({ track }: { track: QueueTrack }) {
  const durationSec = usePlayerStore((s) => s.durationSec);
  const context = usePlayerStore((s) => s.context);

  return (
    <ScrollView contentContainerStyle={styles.meta} showsVerticalScrollIndicator={false}>
      <MetaRow label="ТРЕК" value={track.title} />
      <MetaRow label="АРТИСТ" value={track.artistName} />
      {durationSec > 0 && (
        <MetaRow label="ДЛИТЕЛЬНОСТЬ" value={formatDuration(durationSec)} />
      )}
      {context && <MetaRow label="ИСТОЧНИК" value={SOURCE_LABEL[context.source] ?? context.source} />}
    </ScrollView>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  home: 'Главная',
  release: 'Релиз',
  playlist: 'Плейлист',
  artist: 'Артист',
  search: 'Поиск',
  liked: 'Любимые',
  wave: 'Волна',
  feed: 'Лента',
  direct: 'Напрямую',
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={type.mono}>{label}</Text>
      <Text style={[type.row, styles.metaValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: 2 },
  lyrics: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  line: {
    ...type.body,
    minHeight: LINE_HEIGHT,
    lineHeight: LINE_HEIGHT,
    color: colors.mutedForeground,
  },
  lineActive: { color: colors.foreground },
  meta: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  metaRow: {
    gap: 4,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  metaValue: { color: colors.foreground },
});
