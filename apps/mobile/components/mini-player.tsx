import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePlayerStore } from '../lib/player-store';
import type { RootStackParamList } from '../navigation/root-navigator';
import { TAB_BAR_HEIGHT } from '../navigation/main-tabs';
import { colors, radius } from '../lib/theme';

export function MiniPlayer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const track = usePlayerStore((s) => s.queue[s.queueIndex]);
  const status = usePlayerStore((s) => s.status);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  if (!track) return null;

  return (
    <Pressable style={styles.bar} onPress={() => navigation.navigate('Player')}>
      {track.coverUrl ? (
        <Image source={{ uri: track.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artistName}
        </Text>
      </View>
      <Pressable style={styles.playButton} onPress={togglePlayPause} hitSlop={12}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.foreground} size="small" />
        ) : (
          <Text style={styles.playIcon}>{status === 'playing' ? '⏸' : '▶'}</Text>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cover: { width: 40, height: 40, borderRadius: radius.sm },
  coverPlaceholder: { backgroundColor: colors.secondary },
  info: { flex: 1, gap: 2 },
  title: { color: colors.cardForeground, fontSize: 14, fontWeight: '700' },
  artist: { color: colors.mutedForeground, fontSize: 12, fontWeight: '500' },
  playButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: colors.foreground, fontSize: 20 },
});
