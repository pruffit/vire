import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLikesStore } from '../lib/likes-store';
import { Icon } from '../lib/icon';
import { colors } from '../lib/theme';

export function LikeButton({ trackId }: { trackId: string }) {
  const liked = useLikesStore((s) => s.state[trackId]);
  const load = useLikesStore((s) => s.load);
  const toggle = useLikesStore((s) => s.toggle);

  useEffect(() => {
    load(trackId);
  }, [load, trackId]);

  return (
    <Pressable
      style={styles.button}
      hitSlop={12}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        toggle(trackId);
      }}
    >
      <Icon name="heart" size={18} color={liked ? colors.primary : colors.mutedForeground} filled={!!liked} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
});
