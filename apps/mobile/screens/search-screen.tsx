import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SearchResponse } from '@vire/api-contracts';
import type { SearchStackParamList } from '../navigation/search-stack';
import { search } from '../lib/search';
import { WEB_BASE_URL } from '../lib/env';
import { useContentBottomPadding } from '../lib/layout';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';
import { Screen } from '../components/screen';
import { Glass } from '../components/glass';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

// @vire/api-contracts экспортирует только собранный SearchResponse, не типы отдельных
// хитов — выводим их так же, как ReleaseDetailResponse['tracks'][number] в release-screen.tsx.
type SearchArtistDTO = SearchResponse['artists'][number];
type SearchReleaseDTO = SearchResponse['releases'][number];
type SearchTrackDTO = SearchResponse['tracks'][number];

const SEARCH_DEBOUNCE_MS = 300;
const EMPTY_RESULT: SearchResponse = { artists: [], releases: [], tracks: [] };

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList, 'SearchHome'>>();
  const bottomPadding = useContentBottomPadding();
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResponse>(EMPTY_RESULT);
  const [searching, setSearching] = useState(false);
  const searchedOnce = useRef(false);
  const requestToken = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResult(EMPTY_RESULT);
      setSearching(false);
      return;
    }

    const token = ++requestToken.current;
    setSearching(true);
    const timer = setTimeout(() => {
      search(trimmed, 12).then((res) => {
        if (requestToken.current !== token) return; // устаревший ответ — запрос уже перекрыт новым
        searchedOnce.current = true;
        setResult(res.ok ? res.data : EMPTY_RESULT);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const hasQuery = query.trim().length > 0;
  const hasResults = result.artists.length > 0 || result.releases.length > 0 || result.tracks.length > 0;

  const openArtist = (artist: SearchArtistDTO) => {
    WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/artists/${artist.slug}`);
  };

  const openRelease = (release: SearchReleaseDTO) =>
    navigation.navigate('ReleaseDetail', {
      releaseId: release.id,
      title: release.title,
      artistName: release.artistName,
      coverUrl: release.coverUrl,
    });

  const playTrack = (index: number) => {
    const queue: QueueTrack[] = result.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      coverUrl: t.coverUrl,
      durationSec: null,
    }));
    playQueue(queue, index, { source: 'search' });
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.heading}>Поиск</Text>

      <Glass style={styles.searchBox} radius={radius.md}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Артисты, релизы, треки"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {hasQuery && (
          <Pressable onPress={() => setQuery('')} hitSlop={12}>
            <Icon name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </Glass>

      {!hasQuery && (
        <View style={[styles.centered, { paddingBottom: bottomPadding }]}>
          <Icon name="search" size={40} color={colors.mutedForeground} />
          <Text style={styles.hintText}>Ищите артистов, релизы и треки</Text>
        </View>
      )}

      {hasQuery && searching && !searchedOnce.current && (
        <View style={[styles.centered, { paddingBottom: bottomPadding }]}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {hasQuery && searchedOnce.current && !searching && !hasResults && (
        <View style={[styles.centered, { paddingBottom: bottomPadding }]}>
          <Icon name="search" size={40} color={colors.mutedForeground} />
          <Text style={styles.hintText}>Ничего не найдено</Text>
        </View>
      )}

      {hasQuery && hasResults && (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}>
          {result.artists.length > 0 && (
            <Section title="Артисты">
              {result.artists.map((artist) => (
                <ArtistRow key={artist.id} artist={artist} onPress={() => openArtist(artist)} />
              ))}
            </Section>
          )}

          {result.releases.length > 0 && (
            <Section title="Релизы">
              {result.releases.map((release) => (
                <ReleaseRow key={release.id} release={release} onPress={() => openRelease(release)} />
              ))}
            </Section>
          )}

          {result.tracks.length > 0 && (
            <Section title="Треки">
              {result.tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  playing={track.id === currentTrackId}
                  onPress={() => playTrack(index)}
                />
              ))}
            </Section>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Cover({ uri, style }: { uri: string | null; style: object }) {
  return uri ? (
    <Image source={{ uri }} style={style} />
  ) : (
    <View style={[style, styles.coverPlaceholder]} />
  );
}

function ArtistRow({ artist, onPress }: { artist: SearchArtistDTO; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Cover uri={artist.avatarUrl ?? artist.firstReleaseCoverUrl} style={styles.avatar} />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {artist.name}
      </Text>
      {artist.verified && <Icon name="check" size={14} color={colors.primary} />}
    </Pressable>
  );
}

function ReleaseRow({ release, onPress }: { release: SearchReleaseDTO; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Cover uri={release.coverUrl} style={styles.cover} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {release.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {release.artistName}
        </Text>
      </View>
    </Pressable>
  );
}

function TrackRow({
  track,
  playing,
  onPress,
}: {
  track: SearchTrackDTO;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.row, playing && styles.rowActive]} onPress={onPress}>
      <Cover uri={track.coverUrl} style={styles.cover} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {track.artistName}
        </Text>
      </View>
      {playing && <Icon name="play" size={14} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  heading: { color: colors.foreground, fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: colors.foreground, fontSize: 15, paddingVertical: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hintText: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
  listContent: { gap: 20 },
  section: { gap: 8 },
  sectionTitle: { color: colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  sectionBody: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 10,
  },
  rowActive: { backgroundColor: colors.secondary },
  rowInfo: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { flex: 1, color: colors.cardForeground, fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: colors.mutedForeground, fontSize: 13, fontWeight: '500' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  cover: { width: 44, height: 44, borderRadius: radius.sm },
  coverPlaceholder: { backgroundColor: colors.secondary },
});
