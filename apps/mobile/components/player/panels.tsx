import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { trackLyricsResponseSchema, type TrackLyricsResponse } from '@vire/api-contracts';

type LyricLine = NonNullable<TrackLyricsResponse['lyrics']>[number];
import { apiRequest } from '../../lib/api-client';
import { usePlayerStore, type QueueTrack } from '../../lib/player-store';
import { formatDuration } from '../../lib/format';
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
  if (!lyrics || lyrics.length === 0) {
    return <SectionEmpty text="Артист ещё не добавил слова к этому треку" />;
  }

  return (
    <View>
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

/**
 * Мета трека: то, ради чего на вебе есть отдельная страница трека. Название и артист
 * сюда не дублируются — они стоят заголовком двумя экранами выше.
 */
export function TrackSection() {
  const durationSec = usePlayerStore((s) => s.durationSec);
  const context = usePlayerStore((s) => s.context);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const queueIndex = usePlayerStore((s) => s.queueIndex);

  const rows: { label: string; value: string }[] = [];
  if (durationSec > 0) rows.push({ label: 'ДЛИТЕЛЬНОСТЬ', value: formatDuration(durationSec) });
  if (context) rows.push({ label: 'ИСТОЧНИК', value: SOURCE_LABEL[context.source] ?? context.source });
  if (queueLength > 1) rows.push({ label: 'В ОЧЕРЕДИ', value: `${queueIndex + 1} / ${queueLength}` });

  if (rows.length === 0) return <SectionEmpty text="Данных о треке пока нет" />;

  return (
    <View>
      {rows.map((row, i) => (
        <MetaRow key={row.label} label={row.label} value={row.value} last={i === rows.length - 1} />
      ))}
    </View>
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

function MetaRow({ label, value, last }: { label: string; value: string; last: boolean }) {
  return (
    <View style={[styles.metaRow, !last && styles.metaRowDivider]}>
      <Text style={type.mono}>{label}</Text>
      <Text style={[type.row, styles.metaValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: space.xl, alignItems: 'center' },
  list: { gap: 2 },
  line: {
    ...type.body,
    minHeight: 30,
    lineHeight: 30,
    color: colors.mutedForeground,
  },
  lineActive: { color: colors.foreground },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  metaRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  metaValue: { color: colors.foreground },
});
