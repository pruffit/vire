import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { usePlayerStore } from '../lib/player-store';
import type { RootStackParamList } from '../navigation/root-navigator';
import { useTabBarHeight, MINI_PLAYER_HEIGHT } from '../lib/layout';
import { Glass } from './glass';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

export function MiniPlayer() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const track = usePlayerStore((s) => s.queue[s.queueIndex]);
  const status = usePlayerStore((s) => s.status);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const tabBarHeight = useTabBarHeight();

  if (!track) return null;

  return (
    <Pressable style={[styles.wrap, { bottom: tabBarHeight + 10 }]} onPress={() => navigation.navigate('Player')}>
      <Glass style={styles.bar} radius={18}>
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
        <Pressable
          style={styles.playButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            togglePlayPause();
          }}
          hitSlop={12}
        >
          {status === 'loading' ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Icon name={status === 'playing' ? 'pause' : 'play'} size={20} color={colors.foreground} />
          )}
        </Pressable>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, height: MINI_PLAYER_HEIGHT },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  cover: { width: 40, height: 40, borderRadius: radius.sm },
  coverPlaceholder: { backgroundColor: colors.secondary },
  info: { flex: 1, gap: 2 },
  title: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  artist: { color: colors.mutedForeground, fontSize: 12, fontWeight: '500' },
  playButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
