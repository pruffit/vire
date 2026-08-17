import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  freshReleasesResponseSchema,
  hotTracksResponseSchema,
  screenSchema,
  type HomeChartTrackDTO,
  type ReleaseCardDTO,
} from '@vire/api-contracts';
import type { HomeStackParamList } from '../navigation/home-stack';
import { apiRequest } from '../lib/api-client';
import { colors, radius } from '../lib/theme';
import { endpointOf } from '../lib/sdui';
import { Icon } from '../lib/icon';
import { usePlayerStore, type QueueTrack } from '../lib/player-store';

type LoadState = 'loading' | 'error' | 'ready';

// Экран умеет рендерить только эти два типа блоков — сервер отфильтрует композицию
// под них (docs/sdui.md §5), остальные блоки главной (персонализация, лента, друзья)
// мобилке пока не нужны.
const SUPPORTED_BLOCKS = 'fresh-releases,hot-tracks';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'HomeList'>>();
  const insets = useSafeAreaInsets();
  const [freshReleases, setFreshReleases] = useState<ReleaseCardDTO[]>([]);
  const [hotTracks, setHotTracks] = useState<HomeChartTrackDTO[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const load = useCallback(async () => {
    const screenResult = await apiRequest('/api/v1/screens/home', {
      schema: screenSchema,
      headers: { 'X-Vire-Blocks': SUPPORTED_BLOCKS },
    });
    if (!screenResult.ok) return false;

    const freshEndpoint = endpointOf(screenResult.data.blocks, 'fresh-releases');
    const hotEndpoint = endpointOf(screenResult.data.blocks, 'hot-tracks');

    const [freshResult, hotResult] = await Promise.all([
      freshEndpoint ? apiRequest(freshEndpoint, { schema: freshReleasesResponseSchema }) : Promise.resolve(null),
      hotEndpoint ? apiRequest(hotEndpoint, { schema: hotTracksResponseSchema }) : Promise.resolve(null),
    ]);

    // Оба источника блока отвалились — честная ошибка. Один из двух — показываем то, что есть.
    if (!freshResult?.ok && !hotResult?.ok) return false;

    setFreshReleases(freshResult?.ok ? freshResult.data.items : []);
    setHotTracks(hotResult?.ok ? hotResult.data.items : []);
    return true;
  }, []);

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

  const openRelease = (release: ReleaseCardDTO) =>
    navigation.navigate('ReleaseDetail', {
      releaseId: release.id,
      title: release.title,
      artistName: release.artistName,
      coverUrl: release.coverUrl,
    });

  const playHotTrack = (track: HomeChartTrackDTO) => {
    const queueTrack: QueueTrack = {
      id: track.id,
      title: track.title,
      artistName: track.artistName,
      coverUrl: track.coverUrl,
      durationSec: null,
    };
    playQueue([queueTrack], 0);
  };

  if (state === 'loading') {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.messageText}>Не удалось загрузить главную</Text>
        <Pressable style={styles.retryButton} onPress={initialLoad}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  if (freshReleases.length === 0 && hotTracks.length === 0) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.messageText}>Пока нечего показать</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
      }
    >
      {freshReleases.length > 0 && (
        <Section title="Новые релизы">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            {freshReleases.map((release) => (
              <ReleaseCard key={release.id} release={release} onPress={() => openRelease(release)} />
            ))}
          </ScrollView>
        </Section>
      )}

      {hotTracks.length > 0 && (
        <Section title="В топе">
          <View style={styles.trackList}>
            {hotTracks.map((track, index) => (
              <HotTrackRow
                key={track.id}
                rank={index + 1}
                track={track}
                playing={track.id === currentTrackId}
                onPress={() => playHotTrack(track)}
              />
            ))}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ReleaseCard({ release, onPress }: { release: ReleaseCardDTO; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[styles.card, pressed && styles.cardPressed]}
    >
      {release.coverUrl ? (
        <Image source={{ uri: release.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      {release.hasExplicit && (
        <View style={styles.explicitBadge}>
          <Text style={styles.explicitText}>E</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {release.title}
        </Text>
        <Text style={styles.cardArtist} numberOfLines={1}>
          {release.artistName}
        </Text>
      </View>
    </Pressable>
  );
}

function HotTrackRow({
  rank,
  track,
  playing,
  onPress,
}: {
  rank: number;
  track: HomeChartTrackDTO;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.trackRow, playing && styles.trackRowActive]} onPress={onPress}>
      <Text style={styles.trackRank}>{rank}</Text>
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
            <View style={styles.trackExplicitBadge}>
              <Text style={styles.trackExplicitText}>E</Text>
            </View>
          )}
        </View>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artistName}
        </Text>
      </View>
      {playing && <Icon name="play" size={14} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: 16, gap: 28 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 12,
    padding: 24,
  },
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
  section: { gap: 12 },
  sectionTitle: { color: colors.foreground, fontSize: 20, fontWeight: '800', paddingHorizontal: 16 },
  row: { paddingHorizontal: 16, gap: 12 },
  card: { width: 148, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  cover: { width: '100%', aspectRatio: 1 },
  coverPlaceholder: { backgroundColor: colors.secondary },
  cardInfo: { padding: 10, gap: 4 },
  cardTitle: { color: colors.cardForeground, fontSize: 14, fontWeight: '700' },
  cardArtist: { color: colors.mutedForeground, fontSize: 12, fontWeight: '500' },
  explicitBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicitText: { color: colors.foreground, fontSize: 10, fontWeight: '800' },
  trackList: { paddingHorizontal: 16, gap: 4 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  trackRowActive: { backgroundColor: colors.secondary },
  trackRank: { color: colors.mutedForeground, fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  trackCover: { width: 44, height: 44, borderRadius: radius.sm },
  trackInfo: { flex: 1, gap: 2 },
  trackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  trackExplicitBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackExplicitText: { color: colors.mutedForeground, fontSize: 9, fontWeight: '800' },
  trackArtist: { color: colors.mutedForeground, fontSize: 13, fontWeight: '500' },
});
