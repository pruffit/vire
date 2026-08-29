import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import type { ChatConversationDTO } from '@vire/api-contracts';
import type { ProfileStackParamList } from '../navigation/profile-stack';
import { fetchConversations } from '../lib/chat';
import { resolveConversationPreview } from '../lib/chat-preview';
import { getCurrentUserId } from '../lib/secure-store';
import { getOrCreateIdentity, type Identity } from '../lib/e2ee/identity';
import { deriveCK, decryptMessage, fromB64 } from '../lib/e2ee/sodium-compat';
import { Screen } from '../components/screen';
import { ChatLockedNotice, useChatLocked } from '../components/chat-locked-notice';
import { useContentBottomPadding } from '../lib/layout';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

type LoadState = 'loading' | 'error' | 'ready';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatConversationTimestamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (isSameDay(d, now)) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

export default function ConversationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, 'Conversations'>>();
  const bottomPadding = useContentBottomPadding();
  const locked = useChatLocked();
  const [state, setState] = useState<LoadState>('loading');
  const [conversations, setConversations] = useState<ChatConversationDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Идентичность грузится один раз (SecureStore) и переиспользуется для всех строк —
  // деривация CK на строку, не запрос ключа на строку (otherIkPub уже в DTO).
  const identityRef = useRef<Identity | null>(null);

  const load = useCallback(async () => {
    const myUserId = await getCurrentUserId();
    if (!myUserId) return false;
    if (!identityRef.current) {
      identityRef.current = await getOrCreateIdentity(myUserId);
    }
    const result = await fetchConversations();
    if (!result.ok) return false;
    setConversations(result.data.conversations);
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

  const resolvePreview = useCallback((c: ChatConversationDTO): string => {
    const identity = identityRef.current;
    return resolveConversationPreview(c, (body, nonce, otherIkPub) => {
      if (!identity) return null;
      const ck = deriveCK(identity.priv, fromB64(otherIkPub), identity.pub);
      return decryptMessage(body, nonce, ck);
    });
  }, []);

  if (locked) {
    return (
      <Screen style={styles.container}>
        <Text style={styles.heading}>Сообщения</Text>
        <ChatLockedNotice />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={styles.heading}>Сообщения</Text>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить диалоги</Text>
          <Pressable style={styles.retryButton} onPress={initialLoad}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' && conversations.length === 0 && (
        <View style={styles.centered}>
          <Icon name="message-square" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Пока нет диалогов</Text>
          <Text style={styles.emptySubtitle}>Напишите другу с его профиля — переписка появится здесь</Text>
        </View>
      )}

      {state === 'ready' && conversations.length > 0 && (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              preview={resolvePreview(item)}
              onPress={() =>
                navigation.navigate('ChatThread', {
                  conversationId: item.id,
                  otherUserId: item.otherUserId,
                  otherUserName: item.otherUserName,
                })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function ConversationRow({
  conversation: c,
  preview,
  onPress,
}: {
  conversation: ChatConversationDTO;
  preview: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {c.otherUserImage ? (
        <Image source={{ uri: c.otherUserImage }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{(c.otherUserName ?? '?')[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, c.unread && styles.textUnread]} numberOfLines={1}>
            {c.otherUserName ?? 'Собеседник'}
          </Text>
          {c.lastMessageAt && <Text style={styles.timestamp}>{formatConversationTimestamp(c.lastMessageAt)}</Text>}
        </View>
        <Text style={[styles.preview, c.unread && styles.textUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {c.unread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  heading: { color: colors.foreground, fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  messageText: { color: colors.mutedForeground, fontSize: 15, textAlign: 'center' },
  emptyTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 4 },
  emptySubtitle: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { color: colors.foreground, fontWeight: '700' },
  listContent: { gap: 2 },
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
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, color: colors.mutedForeground, fontSize: 15, fontWeight: '600' },
  timestamp: { flexShrink: 0, color: colors.mutedForeground, fontSize: 12 },
  preview: { color: colors.mutedForeground, fontSize: 13 },
  textUnread: { color: colors.foreground, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
