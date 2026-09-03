import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { TrackContextResponse } from '@vire/api-contracts';
import { colors } from '../../lib/theme';
import { type, fonts } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';
import { formatCount, pluralFollowers } from '../../lib/format';
import { Cover } from '../ui/cover';
import { Icon, type IconName } from '../../lib/icon';
import type { Accent } from '../../lib/design/accent';

const ARTIST_CARD = 208;
const SIMILAR = 76;

type Artist = TrackContextResponse['artist'];
type Similar = TrackContextResponse['similar'][number];

/**
 * Заголовок блока контекста. Одна форма на все блоки, иначе ритм разъезжается.
 *
 * Не моноширинный: у JetBrains Mono кириллица в верхнем регистре с разрядкой выглядит
 * слабо, а разряды здесь держать нечего — моно оставлен таймкодам.
 */
function BlockTitle({ children }: { children: string }) {
  return <Text style={type.sectionTitle}>{children}</Text>;
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
    // Не стекло: под плашкой ровный градиент фона, преломлять там нечего, и прозрачная
    // поверхность на пустом месте читается недоразумением, а не материалом.
    <Pressable
      style={({ pressed }) => [styles.wave, { backgroundColor: accent.wash }, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Слушать поток в духе трека ${trackTitle}`}
    >
      <Text style={styles.waveWord}>ПОТОК</Text>
      <Icon name="chevron-right" size={22} color={accent.fill} />
    </Pressable>
  );
}

/** Карточка автора: фотография во всю ширину, поверх неё имя и явная кнопка перехода. */
export function ArtistCard({ artist, accent, onPress }: { artist: Artist; accent: Accent; onPress: () => void }) {
  return (
    <View style={styles.block}>
      <BlockTitle>Об авторе</BlockTitle>
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
        <LinearGradient colors={ARTIST_SCRIM} locations={ARTIST_SCRIM_STOPS} style={StyleSheet.absoluteFill} />
        <View style={styles.artistFoot}>
          <Text style={type.releaseTitle} numberOfLines={1}>
            {artist.name}
          </Text>
          {/* Ноль подписчиков — не факт о музыканте, а пустая строка. Тогда полезнее
              первая строка описания. */}
          {artist.followerCount > 0 ? (
            <Text style={[type.caption, styles.onArt]}>
              {formatCount(artist.followerCount)} {pluralFollowers(artist.followerCount)}
            </Text>
          ) : artist.bio ? (
            <Text style={[type.caption, styles.onArt]} numberOfLines={2}>
              {artist.bio}
            </Text>
          ) : null}
          {/* Шеврон в углу — не кнопка: на телефоне нужна явная цель, а не догадка. */}
          <View style={[styles.artistGo, { borderColor: accent.fill }]}>
            <Text style={[type.button, styles.artistGoLabel]}>Смотреть артиста</Text>
            <Icon name="chevron-right" size={16} color={colors.foreground} />
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
      <BlockTitle>Похожие артисты</BlockTitle>
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

/**
 * Ряд действий под управлением: текст, плейлист, «поделиться».
 *
 * Стоят здесь, а не в строке названия, намеренно. Строка названия — верх экрана, куда
 * большой палец не достаёт; эти три нажимают часто, поэтому они внизу, крупные и с
 * подписями. Раньше «в плейлист» лежал последней строкой под очередью — до него надо
 * было прокрутить весь контекст.
 */
export function PlayerActions({
  hasLyrics,
  lyricsShown,
  accent,
  onToggleLyrics,
  onPlaylist,
  onShare,
}: {
  hasLyrics: boolean;
  lyricsShown: boolean;
  accent: Accent;
  onToggleLyrics: () => void;
  onPlaylist: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.actions}>
      <ActionButton
        icon="text"
        label="Текст"
        // Инструментал — не поломка: кнопка остаётся на месте и гаснет, иначе ряд
        // перескакивал бы при каждой смене трека.
        disabled={!hasLyrics}
        active={lyricsShown}
        accent={accent}
        onPress={onToggleLyrics}
      />
      <ActionButton icon="list-plus" label="В плейлист" accent={accent} onPress={onPlaylist} />
      <ActionButton icon="share" label="Поделиться" accent={accent} onPress={onShare} />
    </View>
  );
}

/** Подписи нет: три знака на экране плеера читаются без слов, а слова забирали ширину. */
function ActionButton({
  icon,
  label,
  disabled = false,
  active = false,
  accent,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  active?: boolean;
  accent: Accent;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        active && { backgroundColor: accent.fill },
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={22} color={active ? accent.ink : colors.foreground} />
    </Pressable>
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

const ARTIST_SCRIM = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.5)', 'rgba(3,2,1,0.94)'] as const;
const ARTIST_SCRIM_STOPS = [0, 0.42, 1] as const;

const styles = StyleSheet.create({
  block: { gap: space.sm },
  pressed: { opacity: 0.85 },

  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: space.lg,
    borderRadius: radii.card,
  },
  waveWord: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 1,
    color: colors.foreground,
  },

  artistCard: {
    minHeight: ARTIST_CARD,
    borderRadius: radii.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.secondary,
  },
  artistPlaceholder: { backgroundColor: colors.secondary },
  artistFoot: { gap: space.xs, padding: space.md },
  artistGo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 40,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  artistGoLabel: { color: colors.foreground },
  /** Надпись лежит на фотографии, а не на фоне: приглушённый цвет кита на светлом кадре
   *  не читается, скрим один этого не решает. */
  onArt: {
    color: colors.foreground,
    opacity: 0.92,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },

  similarRow: { gap: space.md, paddingRight: space.md },
  similarCard: { width: SIMILAR, gap: space.xs, alignItems: 'center' },
  similarName: { textAlign: 'center' },

  actions: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionDisabled: { opacity: 0.32 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.touchTarget,
  },
  actionLabel: { flex: 1, color: colors.foreground },
});
