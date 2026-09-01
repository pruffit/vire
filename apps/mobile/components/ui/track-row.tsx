import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, radii } from '../../lib/design/scales';
import { Icon } from '../../lib/icon';
import { Cover } from './cover';

/**
 * Строка трека — самый частый элемент продукта. Высота 54 и обложка 38 из кита; строка
 * матовая, без стекла: стекло только на плавающих слоях, никогда на плотном контенте.
 */
const ROW_HEIGHT = 54;
const COVER = 38;

export function TrackRow({
  title,
  subtitle,
  coverUrl,
  rank,
  explicit = false,
  playing = false,
  onPress,
  trailing,
}: {
  title: string;
  subtitle: string;
  coverUrl?: string | null;
  /** Номер в чарте или в трек-листе; моноширинный, как вся мета. */
  rank?: number;
  explicit?: boolean;
  playing?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [styles.row, playing && styles.rowActive, pressed && styles.rowPressed]}
    >
      {rank !== undefined && <Text style={styles.rank}>{rank}</Text>}
      <Cover uri={coverUrl} size={COVER} explicit={explicit} />
      <View style={styles.info}>
        <Text style={[type.row, playing && styles.titlePlaying]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {playing && <Icon name="play" size={13} color={colors.foreground} />}
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: space.sm,
    borderRadius: radii.coverSm,
  },
  // Активная строка — подложкой, а не цветом: у платформы нет своего цвета, акцент
  // приходит только из контекста артиста или играющего релиза.
  rowActive: { backgroundColor: colors.card },
  rowPressed: { opacity: 0.7 },
  titlePlaying: { color: colors.foreground },
  rank: {
    ...type.mono,
    minWidth: 18,
    textAlign: 'center',
  },
  info: { flex: 1, gap: 2, minWidth: 0 },
});
