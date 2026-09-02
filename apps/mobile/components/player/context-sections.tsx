import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trackContextResponseSchema, type TrackContextResponse } from '@vire/api-contracts';
import { apiRequest } from '../../lib/api-client';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';
import { Cover } from '../ui/cover';
import { Icon } from '../../lib/icon';
import type { RootStackParamList } from '../../navigation/root-navigator';

const AVATAR = 56;
const SIMILAR = 72;

/**
 * Артист трека и похожие. У трека в очереди есть только имя артиста, поэтому и то и другое
 * приходит одним запросом контекста — иначе из плеера до артиста не добраться вовсе.
 */
export function ContextSections({ trackId }: { trackId: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [context, setContext] = useState<TrackContextResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContext(null);
    apiRequest(`/api/v1/tracks/${encodeURIComponent(trackId)}/context`, {
      schema: trackContextResponseSchema,
    }).then((r) => {
      if (!cancelled) setContext(r.ok ? r.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  // Плеер — модалка над табами, поэтому артист открывается через вложенную навигацию,
  // как это делает переход к релизу в track-action-sheet.tsx.
  const openArtist = (slug: string) => {
    navigation.navigate('Main', {
      screen: 'Home',
      params: { screen: 'ArtistDetail', params: { slug } },
    });
  };

  if (!context) return null;

  const { artist, similar } = context;

  return (
    <>
      <View style={styles.section}>
        <Text style={type.mono}>ОБ АВТОРЕ</Text>
        <Pressable
          style={styles.artistRow}
          onPress={() => openArtist(artist.slug)}
          accessibilityRole="button"
          accessibilityLabel={`Открыть артиста ${artist.name}`}
        >
          <Cover uri={artist.avatarUrl} size={AVATAR} radius={radii.full} />
          <View style={styles.artistText}>
            <Text style={type.sectionTitle} numberOfLines={1}>
              {artist.name}
            </Text>
            {artist.bio ? (
              <Text style={type.caption} numberOfLines={3}>
                {artist.bio}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      {similar.length > 0 && (
        <View style={styles.section}>
          <Text style={type.mono}>ПОХОЖИЕ АРТИСТЫ</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.similarRow}
          >
            {similar.map((a) => (
              <Pressable
                key={a.slug}
                style={styles.similarCard}
                onPress={() => openArtist(a.slug)}
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
      )}
    </>
  );
}

/** Строка-действие в шторке. */
export function SheetAction({
  icon,
  label,
  onPress,
}: {
  icon: 'plus' | 'share' | 'list';
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

const styles = StyleSheet.create({
  section: { gap: space.sm },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  artistText: { flex: 1, gap: 2, minWidth: 0 },
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
