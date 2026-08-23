import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatMessageDTO } from '@vire/api-contracts';
import type { ProfileStackParamList } from '../navigation/profile-stack';
import { fetchPeerKey, fetchMessages, sendMessage } from '../lib/chat';
import { useChatRealtime, type ChatRealtimeEvent } from '../lib/chat-realtime';
import { getCurrentUserId } from '../lib/secure-store';
import { getOrCreateIdentity } from '../lib/e2ee/identity';
import { deriveCK, encryptMessage, decryptMessage, fromB64 } from '../lib/e2ee/sodium-compat';
import { Screen } from '../components/screen';
import { colors, radius } from '../lib/theme';

type LoadState = 'loading' | 'error' | 'blocked' | 'ready';

interface ThreadMessage {
  id: string;
  senderId: string;
  // null — шифротекст пришёл, но не расшифровался (не наш CK/повреждён).
  plaintext: string | null;
  createdAt: string;
}

function decryptDTO(dto: ChatMessageDTO, ck: Uint8Array): ThreadMessage {
  return {
    id: dto.id,
    senderId: dto.senderId,
    plaintext: decryptMessage(dto.body, dto.nonce, ck),
    createdAt: dto.createdAt,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatClockTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isChatMessageEvent(
  event: ChatRealtimeEvent,
): event is ChatRealtimeEvent & { conversationId: string; message: ChatMessageDTO } {
  const message = event.message as ChatMessageDTO | undefined;
  return (
    typeof event.conversationId === 'string' &&
    !!message &&
    typeof message.id === 'string' &&
    typeof message.senderId === 'string' &&
    typeof message.body === 'string' &&
    typeof message.nonce === 'string'
  );
}

export default function ChatThreadScreen({ route }: NativeStackScreenProps<ProfileStackParamList, 'ChatThread'>) {
  const { conversationId, otherUserId, otherUserName } = route.params;

  const [state, setState] = useState<LoadState>('loading');
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const myUserIdRef = useRef<string | null>(null);
  const ckRef = useRef<Uint8Array | null>(null);
  const listRef = useRef<FlatList<ThreadMessage>>(null);

  const load = useCallback(async () => {
    setState('loading');

    const myUserId = await getCurrentUserId();
    if (!myUserId) {
      setState('error');
      return;
    }
    myUserIdRef.current = myUserId;

    const peerKey = await fetchPeerKey(otherUserId);
    if (!peerKey.ok) {
      setState('error');
      return;
    }
    if (!peerKey.data.ikPub) {
      setState('blocked');
      return;
    }

    const identity = await getOrCreateIdentity(myUserId);
    const ck = deriveCK(identity.priv, fromB64(peerKey.data.ikPub), identity.pub);
    ckRef.current = ck;

    const history = await fetchMessages(conversationId);
    if (!history.ok) {
      setState('error');
      return;
    }
    setMessages(history.data.messages.map((dto) => decryptDTO(dto, ck)));
    setState('ready');
  }, [conversationId, otherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRealtimeMessage = useCallback(
    (event: ChatRealtimeEvent) => {
      if (!isChatMessageEvent(event) || event.conversationId !== conversationId) return;
      const ck = ckRef.current;
      if (!ck) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === event.message.id)) return prev;
        return [...prev, decryptDTO(event.message, ck)];
      });
    },
    [conversationId],
  );

  useChatRealtime(onRealtimeMessage);

  useEffect(() => {
    if (messages.length > 0) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    const ck = ckRef.current;
    const myUserId = myUserIdRef.current;
    if (!text || !ck || !myUserId || sending) return;

    setSending(true);
    const { ciphertext, nonce } = encryptMessage(text, ck);
    const result = await sendMessage(otherUserId, ciphertext, nonce);
    setSending(false);
    if (!result.ok) return;

    setDraft('');
    setMessages((prev) => {
      if (prev.some((m) => m.id === result.data.message.id)) return prev;
      return [...prev, { id: result.data.message.id, senderId: myUserId, plaintext: text, createdAt: result.data.message.createdAt }];
    });
  }, [draft, otherUserId, sending]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerName} numberOfLines={1}>
          {otherUserName ?? 'Собеседник'}
        </Text>
      </View>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить переписку</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'blocked' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>У собеседника пока нет ключа шифрования — писать нельзя</Text>
        </View>
      )}

      {state === 'ready' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <Bubble message={item} own={item.senderId === myUserIdRef.current} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Сообщение…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              multiline
            />
            <Pressable
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
              disabled={!draft.trim() || sending}
              onPress={onSend}
            >
              <Text style={styles.sendButtonText}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function Bubble({ message, own }: { message: ThreadMessage; own: boolean }) {
  return (
    <View style={[styles.bubbleRow, own && styles.bubbleRowOwn]}>
      <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text
          style={[
            styles.bubbleText,
            own ? styles.bubbleTextOwn : styles.bubbleTextOther,
            message.plaintext === null && styles.bubbleTextFailed,
          ]}
        >
          {message.plaintext ?? 'Не удалось расшифровать'}
        </Text>
        <Text style={styles.bubbleTime}>{formatClockTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerName: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
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
  listContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleOther: { backgroundColor: colors.card },
  bubbleOwn: { backgroundColor: colors.primary },
  bubbleText: { fontSize: 15 },
  bubbleTextOther: { color: colors.cardForeground },
  bubbleTextOwn: { color: colors.primaryForeground },
  bubbleTextFailed: { fontStyle: 'italic', color: colors.mutedForeground },
  bubbleTime: { color: colors.mutedForeground, fontSize: 10, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: colors.primaryForeground, fontSize: 20, fontWeight: '800' },
});
