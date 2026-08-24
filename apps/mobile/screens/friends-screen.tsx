import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import type { FriendDTO, FriendSearchHitDTO, IncomingRequestDTO } from '@vire/api-contracts';
import type { ProfileStackParamList } from '../navigation/profile-stack';
import { fetchFriends, searchUsers } from '../lib/friends';
import { FriendButton } from '../components/friend-button';
import { Screen } from '../components/screen';
import { Glass } from '../components/glass';
import { useContentBottomPadding } from '../lib/layout';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

type LoadState = 'loading' | 'error' | 'ready';

export default function FriendsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, 'Friends'>>();
  const bottomPadding = useContentBottomPadding();
  const [friends, setFriends] = useState<FriendDTO[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequestDTO[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendSearchHitDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const searchToken = useRef(0);

  const load = useCallback(async () => {
    const result = await fetchFriends();
    if (!result.ok) return false;
    setFriends(result.data.friends);
    setIncoming(result.data.incoming);
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

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    const token = ++searchToken.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchUsers(trimmed).then((result) => {
        if (searchToken.current !== token) return;
        setResults(result.ok ? result.data.results : []);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const showSearchPanel = query.trim().length >= SEARCH_MIN_LENGTH;

  return (
    <Screen style={styles.container}>
      <Text style={styles.heading}>Друзья</Text>

      <Glass style={styles.searchBox} radius={radius.md}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Найти людей"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </Glass>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить друзей</Text>
          <Pressable style={styles.retryButton} onPress={initialLoad}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
        >
          {showSearchPanel && (
            <Section title="Результаты поиска">
              {searching && results.length === 0 ? (
                <Text style={styles.emptyText}>Ищем…</Text>
              ) : results.length === 0 ? (
                <Text style={styles.emptyText}>Никого не нашли</Text>
              ) : (
                results.map((hit) => (
                  <PersonRow key={hit.id} name={hit.name} image={hit.image} onPress={() => navigation.navigate('UserProfile', { userId: hit.id })}>
                    <FriendButton userId={hit.id} initialStatus={hit.status} />
                  </PersonRow>
                ))
              )}
            </Section>
          )}

          {incoming.length > 0 && (
            <Section title={`Заявки в друзья (${incoming.length})`}>
              {incoming.map((r) => (
                <PersonRow key={r.id} name={r.name} image={r.image} onPress={() => navigation.navigate('UserProfile', { userId: r.id })}>
                  <FriendButton userId={r.id} initialStatus="INCOMING" />
                </PersonRow>
              ))}
            </Section>
          )}

          <Section title="Друзья">
            {friends.length === 0 ? (
              <Text style={styles.emptyText}>Пока никого нет</Text>
            ) : (
              friends.map((f) => (
                <PersonRow key={f.id} name={f.name} image={f.image} onPress={() => navigation.navigate('UserProfile', { userId: f.id })}>
                  <FriendButton userId={f.id} initialStatus="FRIENDS" />
                </PersonRow>
              ))
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

function PersonRow({
  name,
  image,
  onPress,
  children,
}: {
  name: string | null;
  image: string | null;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{(name ?? '?')[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.rowName} numberOfLines={1}>
        {name ?? 'Слушатель'}
      </Text>
      {children}
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
  listContent: { gap: 20 },
  section: { gap: 8 },
  sectionTitle: { color: colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  sectionBody: { gap: 2 },
  emptyText: { color: colors.mutedForeground, fontSize: 14, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.mutedForeground, fontSize: 15, fontWeight: '700' },
  rowName: { flex: 1, color: colors.cardForeground, fontSize: 15, fontWeight: '600' },
});
