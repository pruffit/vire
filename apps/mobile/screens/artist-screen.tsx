import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { artistPageResponseSchema, type ArtistPageResponse } from '@vire/api-contracts';
import type { HomeStackParamList } from '../navigation/home-stack';
import { apiRequest } from '../lib/api-client';
import { colors, radius } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';
import { Screen } from '../components/screen';
import { Cover } from '../components/ui/cover';
import { useContentBottomPadding } from '../lib/layout';
import { useScrollEdge } from '../lib/scroll-edge';

type LoadState = 'loading' | 'error' | 'ready';
type Artist = ArtistPageResponse['artist'];
type Release = ArtistPageResponse['releases'][number];

const HEADER_SCRIM = ['rgba(3,2,1,0.35)', 'rgba(3,2,1,0.55)', '#030201'] as const;
const AVATAR = 96;
const CARD = 148;

/**
 * Страница артиста. Узкий тип по `route.params` — тот же приём, что в `release-screen.tsx`:
 * экран регистрируется сразу в двух стеках, и `NativeStackNavigationProp<ParamList>` от
 * разных списков роутов конфликтовал бы.
 */
export default function ArtistScreen({ route }: { route: { params: HomeStackParamList['ArtistDetail'] } }) {
  const { slug } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const bottomPadding = useContentBottomPadding();
  const scrollEdge = useScrollEdge();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiRequest(`/api/v1/artists/${encodeURIComponent(slug)}/page`, {
      schema: artistPageResponseSchema,
    });
    if (!result.ok) return false;
    setArtist(result.data.artist);
    setReleases(result.data.releases);
    setFollowerCount(result.data.followerCount);
    return true;
  }, [slug]);

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

  const openRelease = (release: Release) => {
    navigation.navigate('ReleaseDetail', {
      releaseId: release.id,
      title: release.title,
      artistName: artist?.name,
      coverUrl: release.coverUrl,
    });
  };

  return (
    <Screen>
      <View style={styles.header}>
        {artist?.headerUrl && (
          <Image source={{ uri: artist.headerUrl }} style={StyleSheet.absoluteFill} blurRadius={60} contentFit="cover" />
        )}
        <LinearGradient colors={HEADER_SCRIM} style={StyleSheet.absoluteFill} />
        <Cover uri={artist?.avatarUrl ?? null} size={AVATAR} radius={radii.full} />
        <Text style={styles.name} numberOfLines={2}>
          {artist?.name ?? ''}
        </Text>
        {followerCount > 0 && <Text style={type.caption}>{followerCount} подписчиков</Text>}
      </View>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить артиста</Text>
          <Pressable style={styles.retryButton} onPress={initialLoad} accessibilityRole="button">
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && (
        <FlatList
          {...scrollEdge}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          data={releases}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          ListHeaderComponent={
            artist?.bio ? (
              <Text style={[type.body, styles.bio]}>{artist.bio}</Text>
            ) : null
          }
          ListEmptyComponent={<Text style={[type.caption, styles.empty]}>У артиста пока нет релизов</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => openRelease(item)}
              accessibilityRole="button"
              accessibilityLabel={`Релиз ${item.title}`}
            >
              <Cover uri={item.coverUrl} size={CARD} radius={radius.md} />
              <Text style={type.row} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: layout.screenPadding,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    overflow: 'hidden',
  },
  name: { ...type.screenTitle, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  messageText: { ...type.body, color: colors.mutedForeground },
  retryButton: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { ...type.row, color: colors.foreground },
  listContent: { paddingHorizontal: layout.screenPadding, gap: space.md },
  column: { gap: space.md },
  card: { flex: 1, gap: space.xs, maxWidth: CARD },
  bio: { color: colors.mutedForeground, paddingBottom: space.md },
  empty: { paddingVertical: space.xl, textAlign: 'center' },
});
