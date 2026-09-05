import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchPeerKey, fetchMessages, sendMessage, sendTyping, markConversationRead } from '../lib/chat';
import { useChatRealtime, type ChatRealtimeEvent } from '../lib/chat-realtime';
import { shouldSendTypingPing, isReadByPeer, TYPING_INDICATOR_TIMEOUT_MS } from '../lib/chat-typing';
import { getCurrentUserId } from '../lib/secure-store';
import { getOrCreateIdentity } from '../lib/e2ee/identity';
import { deriveCK, encryptMessage, decryptMessage, fromB64 } from '../lib/e2ee/sodium-compat';
import { Screen } from '../components/screen';
import { ChatLockedNotice, useChatLocked } from '../components/chat-locked-notice';
import { Glass } from '../components/glass';
import { useContentBottomPadding } from '../lib/layout';
import { colors, radius } from '../lib/theme';
import { fonts } from '../lib/design/typography';

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
    event.type === 'message' &&
    typeof event.conversationId === 'string' &&
    !!message &&
    typeof message.id === 'string' &&
    typeof message.senderId === 'string' &&
    typeof message.body === 'string' &&
    typeof message.nonce === 'string'
  );
}

function isChatTypingEvent(event: ChatRealtimeEvent): event is ChatRealtimeEvent & { conversationId: string; userId: string } {
  return event.type === 'chat:typing' && typeof event.conversationId === 'string' && typeof event.userId === 'string';
}

// readAt публикуется адресно только другому участнику (packages/core/.../chat.ts) — userId в payload не несётся.
function isChatReadEvent(event: ChatRealtimeEvent): event is ChatRealtimeEvent & { conversationId: string; readAt: string } {
  return event.type === 'chat:read' && typeof event.conversationId === 'string' && typeof event.readAt === 'string';
}

export default function ChatThreadScreen({ route }: NativeStackScreenProps<ProfileStackParamList, 'ChatThread'>) {
  const { conversationId, otherUserId, otherUserName } = route.params;
  const composerBottomMargin = useContentBottomPadding();
  const locked = useChatLocked();

  const [state, setState] = useState<LoadState>('loading');
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);

  const myUserIdRef = useRef<string | null>(null);
  const ckRef = useRef<Uint8Array | null>(null);
  const listRef = useRef<FlatList<ThreadMessage>>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Best-effort — отметка прочтения не блокирует рендер и не проверяется на ошибку.
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId]);

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  const clearPeerTyping = useCallback(() => {
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = undefined;
    setPeerTyping(false);
  }, []);

  const onRealtimeMessage = useCallback(
    (event: ChatRealtimeEvent) => {
      if (isChatMessageEvent(event)) {
        if (event.conversationId !== conversationId) return;
        if (event.message.senderId === otherUserId) clearPeerTyping();

        const ck = ckRef.current;
        if (!ck) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, decryptDTO(event.message, ck)];
        });
        return;
      }

      if (isChatTypingEvent(event)) {
        if (event.conversationId !== conversationId || event.userId !== otherUserId) return;
        setPeerTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(clearPeerTyping, TYPING_INDICATOR_TIMEOUT_MS);
        return;
      }

      if (isChatReadEvent(event)) {
        if (event.conversationId !== conversationId) return;
        setPeerReadAt(event.readAt);
      }
    },
    [conversationId, otherUserId, clearPeerTyping],
  );

  useChatRealtime(onRealtimeMessage);

  useEffect(() => {
    if (messages.length > 0) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (!text.trim()) return;
      const now = Date.now();
      if (!shouldSendTypingPing(lastTypingSentRef.current, now)) return;
      lastTypingSentRef.current = now;
      void sendTyping(conversationId);
    },
    [conversationId],
  );

  // Différencie «пара повреждённых сообщений» от «на этом устройстве другой ключ —
  // вся история нечитаема» (типично после переустановки: SecureStore/identity
  // сбрасывается, см. lib/e2ee/identity.ts "single-device only"). Одна фраза вместо
  // N одинаковых бабблов «Не удалось расшифровать» — тот же сигнал, но не читается
  // как «фича сломана».
  const allMessagesUndecryptable = messages.length > 0 && messages.every((m) => m.plaintext === null);

  const lastOwnMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.senderId === myUserIdRef.current) return messages[i]!;
    }
    return null;
  }, [messages]);

  const ownStatusLabel = lastOwnMessage
    ? isReadByPeer(lastOwnMessage.createdAt, peerReadAt)
      ? 'Прочитано'
      : 'Отправлено'
    : null;

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

  if (locked) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.headerName} numberOfLines={1}>{otherUserName ?? 'Собеседник'}</Text>
        </View>
        <ChatLockedNotice />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerName} numberOfLines={1}>
          {otherUserName ?? 'Собеседник'}
        </Text>
        {peerTyping && <Text style={styles.typingCaption}>печатает…</Text>}
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
          {allMessagesUndecryptable && (
            <View style={styles.keyMismatchBanner}>
              <Text style={styles.keyMismatchText}>
                Ключ шифрования на этом устройстве не совпадает с историей переписки — прежние
                сообщения недоступны. Новые сообщения будут читаться нормально.
              </Text>
            </View>
          )}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                own={item.senderId === myUserIdRef.current}
                statusLabel={item.id === lastOwnMessage?.id ? ownStatusLabel : null}
              />
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          <Glass style={[styles.composer, { marginBottom: composerBottomMargin }]} radius={22}>
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
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
          </Glass>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function Bubble({
  message,
  own,
  statusLabel,
}: {
  message: ThreadMessage;
  own: boolean;
  statusLabel?: string | null;
}) {
  return (
    <View style={[styles.bubbleRow, own && styles.bubbleRowOwn]}>
      <View style={styles.bubbleColumn}>
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
        {statusLabel && <Text style={styles.statusCaption}>{statusLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerName: { color: colors.foreground, fontSize: 18, fontFamily: fonts.extrabold },
  typingCaption: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
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
  retryText: { color: colors.foreground, fontFamily: fonts.bold },
  listContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  keyMismatchBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  keyMismatchText: { color: colors.mutedForeground, fontSize: 12.5, lineHeight: 18 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleColumn: { maxWidth: '80%' },
  statusCaption: { alignSelf: 'flex-end', color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
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
    marginHorizontal: 12,
    // marginBottom задаётся динамически (useContentBottomPadding) — резерв под
    // плавающий таб-бар/мини-плеер, composer сидит в обычном потоке под FlatList,
    // а не absolute, поэтому сам должен себя отодвинуть от низа экрана.
    padding: 6,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: colors.foreground,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  sendButtonText: { color: colors.primaryForeground, fontSize: 20, fontFamily: fonts.extrabold },
});
