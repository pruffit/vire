import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { FriendshipStatusDTO } from '@vire/api-contracts';
import { useFriendAction } from '../lib/use-friend-action';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';
import { fonts } from '../lib/design/typography';

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function FriendButton({ userId, initialStatus }: { userId: string; initialStatus: FriendshipStatusDTO }) {
  const { status, pending, request, remove, accept } = useFriendAction(userId, initialStatus);

  if (status === 'SELF') return null;

  if (status === 'NONE') {
    return (
      <Pressable
        style={styles.primary}
        disabled={pending}
        onPress={() => {
          tap();
          void request();
        }}
      >
        <Icon name="user-plus" size={14} color={colors.primaryForeground} />
        <Text style={styles.primaryText}>Добавить</Text>
      </Pressable>
    );
  }

  if (status === 'OUTGOING') {
    return (
      <Pressable
        style={styles.muted}
        disabled={pending}
        onPress={() => {
          tap();
          void remove();
        }}
      >
        <Icon name="x" size={14} color={colors.foreground} />
        <Text style={styles.mutedText}>Заявка отправлена</Text>
      </Pressable>
    );
  }

  if (status === 'INCOMING') {
    return (
      <View style={styles.row}>
        <Pressable
          style={styles.primary}
          disabled={pending}
          onPress={() => {
            tap();
            void accept();
          }}
        >
          <Icon name="check" size={14} color={colors.primaryForeground} />
          <Text style={styles.primaryText}>Принять</Text>
        </Pressable>
        <Pressable
          style={styles.muted}
          disabled={pending}
          onPress={() => {
            tap();
            void remove();
          }}
        >
          <Text style={styles.mutedText}>Отклонить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.muted}
      disabled={pending}
      onPress={() => {
        tap();
        void remove();
      }}
    >
      <Icon name="user-check" size={14} color={colors.foreground} />
      <Text style={styles.mutedText}>В друзьях</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryText: { color: colors.primaryForeground, fontSize: 13, fontFamily: fonts.bold },
  muted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  mutedText: { color: colors.foreground, fontSize: 13, fontFamily: fonts.bold },
});
