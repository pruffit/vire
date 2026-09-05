import { StyleSheet, Text, View } from 'react-native';
import { useChatAvailability } from '../lib/e2ee/chat-availability';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';
import { fonts } from '../lib/design/typography';

/**
 * Экран-заглушка вместо чата, когда на сервере лежит ключ другого устройства.
 *
 * Блокируем только этот случай. `unknown` (не смогли проверить — нет сети) не блокирует:
 * у пользователя без веб-сессии чат при этом исправен, и глушить его было бы ложной
 * тревогой. Почему вообще так — `lib/e2ee/chat-availability.ts`.
 */
export function useChatLocked(): boolean {
  return useChatAvailability((s) => s.status) === 'locked-other-device';
}

export function ChatLockedNotice() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="message-square" size={28} color={colors.mutedForeground} />
      </View>
      <Text style={styles.title}>Чат недоступен на этом устройстве</Text>
      <Text style={styles.body}>
        Переписка зашифрована ключом другого вашего устройства — с телефона её не прочитать.
        Пока перенос ключей между устройствами не поддерживается, чат остаётся там, где вы
        начали переписку.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  title: { color: colors.foreground, fontSize: 18, fontFamily: fonts.bold, textAlign: 'center' },
  body: { color: colors.mutedForeground, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
