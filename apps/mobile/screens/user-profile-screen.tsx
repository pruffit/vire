import { useCallback, useEffect, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import type { UserProfileResponse } from '@vire/api-contracts';
import type { ProfileStackParamList } from '../navigation/profile-stack';
import { fetchUserProfile, likedTracksToQueue, blockUser, unblockUser } from '../lib/friends';
import { usePlayerStore } from '../lib/player-store';
import { formatDuration } from '../lib/format';
import { Screen } from '../components/screen';
import { FriendButton } from '../components/friend-button';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

type LoadState = 'loading' | 'error' | 'ready';
type LikedTrack = UserProfileResponse['likes'][number];
type PlaylistSummary = UserProfileResponse['playlists'][number];

export default function UserProfileScreen({ route }: NativeStackScreenProps<ProfileStackParamList, 'UserProfile'>) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const currentTrackId = usePlayerStore((s) => s.queue[s.queueIndex]?.id ?? null);

  const load = useCallback(async () => {
    const result = await fetchUserProfile(userId);
    if (!result.ok) return false;
    setProfile(result.data);
    return true;
  }, [userId]);

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

  const play = (index: number) => {
    if (!profile) return;
    playQueue(likedTracksToQueue(profile.likes), index);
  };

  const doBlock = useCallback(async () => {
    setBlockPending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const result = await blockUser(userId);
    if (result.ok) await load();
    setBlockPending(false);
  }, [userId, load]);

  const doUnblock = useCallback(async () => {
    setBlockPending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const result = await unblockUser(userId);
    if (result.ok) await load();
    setBlockPending(false);
  }, [userId, load]);

  return (
    <Screen>
      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить профиль</Text>
          <Pressable style={styles.retryButton} onPress={initialLoad}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && profile && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
        >
          <View style={styles.header}>
            {profile.image ? (
              <Image source={{ uri: profile.image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{(profile.name ?? '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {profile.name ?? 'Слушатель'}
            </Text>

            {profile.blocked && profile.iBlockedThem && (
              <Pressable style={styles.unblockButton} disabled={blockPending} onPress={doUnblock}>
                <Icon name="user-x" size={14} color={colors.foreground} />
                <Text style={styles.unblockText}>Разблокировать</Text>
              </Pressable>
            )}

            {profile.blocked && !profile.iBlockedThem && <Text style={styles.blockedText}>Действия недоступны</Text>}

            {!profile.blocked && (
              <>
                <FriendButton userId={profile.id} initialStatus={profile.status} />
                <Pressable style={styles.blockLink} disabled={blockPending} onPress={doBlock} hitSlop={8}>
                  <Text style={styles.blockLinkText}>Заблокировать</Text>
                </Pressable>
              </>
            )}
          </View>

          <Section title="Понравившиеся треки">
            {!profile.likesVisible ? (
              <Text style={styles.emptyText}>Лайки скрыты</Text>
            ) : profile.likes.length === 0 ? (
              <Text style={styles.emptyText}>Пока пусто</Text>
            ) : (
              profile.likes.map((track, index) => (
                <LikedTrackRow
                  key={track.id}
                  track={track}
                  playing={track.id === currentTrackId}
                  onPress={() => play(index)}
                />
              ))
            )}
          </Section>

          <Section title="Публичные плейлисты">
            {profile.playlists.length === 0 ? (
              <Text style={styles.emptyText}>Пока пусто</Text>
            ) : (
              profile.playlists.map((playlist) => <PlaylistRow key={playlist.id} playlist={playlist} />)
            )}
          </Section>
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

function LikedTrackRow({ track, playing, onPress }: { track: LikedTrack; playing: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.trackRow, playing && styles.trackRowActive]} onPress={onPress}>
      <View style={styles.trackInfo}>
        <View style={styles.trackTitleRow}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {track.title}
          </Text>
          {track.isExplicit && (
            <View style={styles.explicitBadge}>
              <Text style={styles.explicitText}>E</Text>
            </View>
          )}
        </View>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artistName}
        </Text>
      </View>
      <Text style={styles.trackDuration}>{formatDuration(track.durationSec)}</Text>
    </Pressable>
  );
}

function PlaylistRow({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <View style={styles.row}>
      {playlist.coverUrl ? (
        <Image source={{ uri: playlist.coverUrl }} style={styles.playlistCover} />
      ) : (
        <View style={[styles.playlistCover, styles.playlistCoverPlaceholder]} />
      )}
      <Text style={styles.rowTitle} numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text style={styles.rowCount}>{playlist.trackCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 32 },
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
  listContent: { paddingHorizontal: 16, paddingBottom: 96, gap: 20 },
  header: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.mutedForeground, fontSize: 24, fontWeight: '700' },
  name: { color: colors.foreground, fontSize: 20, fontWeight: '800' },
  blockedText: { color: colors.mutedForeground, fontSize: 13, marginTop: 4 },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  unblockText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  blockLink: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 8 },
  blockLinkText: { color: colors.mutedForeground, fontSize: 12 },
  section: { gap: 8 },
  sectionTitle: { color: colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  sectionBody: { gap: 2 },
  emptyText: { color: colors.mutedForeground, fontSize: 14, paddingVertical: 8 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  trackRowActive: { backgroundColor: colors.secondary },
  trackInfo: { flex: 1, gap: 2 },
  trackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  trackArtist: { color: colors.mutedForeground, fontSize: 13 },
  explicitBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicitText: { color: colors.mutedForeground, fontSize: 9, fontWeight: '800' },
  trackDuration: { color: colors.mutedForeground, fontSize: 13, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
  },
  playlistCover: { width: 40, height: 40, borderRadius: radius.sm },
  playlistCoverPlaceholder: { backgroundColor: colors.secondary },
  rowTitle: { flex: 1, color: colors.cardForeground, fontSize: 15, fontWeight: '600' },
  rowCount: { color: colors.mutedForeground, fontSize: 12 },
});
