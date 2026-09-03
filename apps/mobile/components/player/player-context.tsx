import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { TrackContextResponse } from '@vire/api-contracts';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';
import { formatCount, pluralFollowers } from '../../lib/format';
import { Cover } from '../ui/cover';
import { Icon, type IconName } from '../../lib/icon';
import type { Accent } from '../../lib/design/accent';

const ARTIST_CARD = 168;
const SIMILAR = 76;
const WAVE_GLYPH = 40;

type Artist = TrackContextResponse['artist'];
type Similar = TrackContextResponse['similar'][number];

/** Заголовок блока контекста. Одна форма на все блоки, иначе ритм разъезжается. */
function BlockTitle({ children }: { children: string }) {
  return <Text style={type.mono}>{children}</Text>;
}

/**
 * «Волна по треку» — продолжить похожим, не выходя из плеера.
 *
 * Первый блок под управлением: после того как трек зацепил, это самый частый импульс —
 * раньше, чем «кто автор» и «что дальше».
 */
export function WaveBanner({
  trackTitle,
  accent,
  onPress,
}: {
  trackTitle: string;
  accent: Accent;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.wave, { borderColor: accent.fill }, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Волна по треку ${trackTitle}`}
    >
      <View style={[styles.waveGlyph, { backgroundColor: accent.fill }]}>
        <Icon name="play" size={20} color={accent.ink} />
      </View>
      <View style={styles.waveText}>
        <Text style={type.sectionTitle}>Волна по треку</Text>
        <Text style={type.caption} numberOfLines={1}>
          Похожее на «{trackTitle}»
        </Text>
      </View>
    </Pressable>
  );
}

/** Карточка автора: фотография во всю ширину, имя и подписчики поверх неё. */
export function ArtistCard({ artist, onPress }: { artist: Artist; onPress: () => void }) {
  return (
    <View style={styles.block}>
      <BlockTitle>ОБ АВТОРЕ</BlockTitle>
      <Pressable
        style={({ pressed }) => [styles.artistCard, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Открыть артиста ${artist.name}`}
      >
        {artist.avatarUrl ? (
          <Image source={{ uri: artist.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.artistPlaceholder]} />
        )}
        <LinearGradient colors={ARTIST_SCRIM} style={StyleSheet.absoluteFill} />
        <View style={styles.artistFoot}>
          <View style={styles.artistText}>
            <Text style={type.releaseTitle} numberOfLines={1}>
              {artist.name}
            </Text>
            {/* Ноль подписчиков — не факт о музыканте, а пустая строка. Тогда полезнее
                первая строка описания. */}
            {artist.followerCount > 0 ? (
              <Text style={type.caption}>
                {formatCount(artist.followerCount)} {pluralFollowers(artist.followerCount)}
              </Text>
            ) : artist.bio ? (
              <Text style={type.caption} numberOfLines={1}>
                {artist.bio}
              </Text>
            ) : null}
          </View>
          <View style={styles.chevron}>
            <Icon name="chevron-down" size={18} color={colors.foreground} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export function SimilarArtists({
  items,
  onPress,
}: {
  items: Similar[];
  onPress: (slug: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <BlockTitle>ПОХОЖИЕ АРТИСТЫ</BlockTitle>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.similarRow}
      >
        {items.map((a) => (
          <Pressable
            key={a.slug}
            style={styles.similarCard}
            onPress={() => onPress(a.slug)}
            accessibilityRole="button"
            accessibilityLabel={`Открыть артиста ${a.name}`}
          >
            <Cover uri={a.avatarUrl} size={SIMILAR} radius={radii.full} />
            <Text style={[type.caption, styles.similarName]} numberOfLines={2}>
              {a.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Строка-утилита: редкие действия, поэтому последними и без выделения. */
export function ContextAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={20} color={colors.foreground} />
      <Text style={[type.row, styles.actionLabel]}>{label}</Text>
    </Pressable>
  );
}

const ARTIST_SCRIM = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.35)', 'rgba(3,2,1,0.88)'] as const;

const styles = StyleSheet.create({
  block: { gap: space.sm },
  pressed: { opacity: 0.85 },

  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 68,
    paddingHorizontal: space.md,
    borderRadius: radii.card,
    borderWidth: 1,
    backgroundColor: colors.secondary,
  },
  waveGlyph: {
    width: WAVE_GLYPH,
    height: WAVE_GLYPH,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveText: { flex: 1, gap: 2, minWidth: 0 },

  artistCard: {
    height: ARTIST_CARD,
    borderRadius: radii.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.secondary,
  },
  artistPlaceholder: { backgroundColor: colors.secondary },
  artistFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md },
  artistText: { flex: 1, gap: 2, minWidth: 0 },
  /** Единственный шеврон набора смотрит вниз — поворачиваем его в «дальше». */
  chevron: { transform: [{ rotate: '-90deg' }] },

  similarRow: { gap: space.md, paddingRight: space.md },
  similarCard: { width: SIMILAR, gap: space.xs, alignItems: 'center' },
  similarName: { textAlign: 'center' },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.touchTarget,
  },
  actionLabel: { flex: 1, color: colors.foreground },
});
