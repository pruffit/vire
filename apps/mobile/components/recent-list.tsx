import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HomeChartTrackDTO } from '@vire/api-contracts';
import { Cover } from './ui/cover';
import { fonts } from '../lib/design/typography';
import { useMock } from '../lib/design/mock';
import { formatDuration } from '../lib/format';

/**
 * «НЕДАВНЕЕ» — первый блок главной. Раскладка перенесена из макета (`apps/web/rnd-src`):
 * это тот самый контент, под которым проверялось поведение стекла, и расходиться экрану
 * с макетом нельзя. Числа — пропорции, пересчитываются под ширину экрана.
 */
const MOCK_SCREEN_MARGIN = 20;
const MOCK_ROW = 56;
const MOCK_COVER = 38;
const MOCK_COVER_RADIUS = 11;
const MOCK_TEXT_GAP = 12;
const MOCK_LABEL = 11;
const MOCK_LABEL_GAP = 14;
const MOCK_TITLE = 13;
const MOCK_ARTIST = 11;

const LABEL_COLOR = '#7c8598';
const TITLE_COLOR = '#e9ecf3';
const ARTIST_COLOR = '#8892a4';
const LENGTH_COLOR = '#6b7484';

export function RecentList({
  tracks,
  onPlay,
}: {
  tracks: readonly HomeChartTrackDTO[];
  onPlay: (index: number) => void;
}) {
  const ms = useMock();
  if (tracks.length === 0) return null;

  const margin = ms(MOCK_SCREEN_MARGIN);
  const label = ms(MOCK_LABEL);
  const title = ms(MOCK_TITLE);
  const artist = ms(MOCK_ARTIST);

  return (
    <View>
      <Text
        style={[
          styles.label,
          { marginHorizontal: margin, marginBottom: ms(MOCK_LABEL_GAP), fontSize: label, lineHeight: Math.round(label * 1.3) },
        ]}
      >
        НЕДАВНЕЕ
      </Text>
      {tracks.map((track, index) => (
        <Pressable
          key={track.id}
          style={[styles.row, { height: ms(MOCK_ROW), paddingHorizontal: margin, gap: ms(MOCK_TEXT_GAP) }]}
          onPress={() => onPlay(index)}
          accessibilityRole="button"
          accessibilityLabel={`${track.title}, ${track.artistName}`}
        >
          <Cover uri={track.coverUrl} size={ms(MOCK_COVER)} radius={ms(MOCK_COVER_RADIUS)} />
          <View style={styles.info}>
            <Text
              style={[styles.title, { fontSize: title, lineHeight: Math.round(title * 1.24) }]}
              numberOfLines={1}
            >
              {track.title}
            </Text>
            <Text
              style={[styles.artist, { fontSize: artist, lineHeight: Math.round(artist * 1.27) }]}
              numberOfLines={1}
            >
              {track.artistName}
            </Text>
          </View>
          {track.durationSec !== null && (
            <Text style={[styles.length, { fontSize: artist }]}>{formatDuration(track.durationSec)}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, color: LABEL_COLOR },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, color: TITLE_COLOR },
  artist: { fontFamily: fonts.regular, color: ARTIST_COLOR },
  length: { fontFamily: fonts.regular, color: LENGTH_COLOR },
});
