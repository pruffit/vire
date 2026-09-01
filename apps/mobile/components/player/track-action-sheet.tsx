import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AddToPlaylistSheet } from '../add-to-playlist-sheet';
import { Icon, type IconName } from '../../lib/icon';
import { colors } from '../../lib/theme';
import { type } from '../../lib/design/typography';
import { space, layout, radii } from '../../lib/design/scales';
import { WEB_BASE_URL } from '../../lib/env';
import type { RootStackParamList } from '../../navigation/root-navigator';

/** Лист действий по долгому нажатию на обложку: поделиться · в плейлист · к релизу. */
export function TrackActionSheet({
  open,
  onClose,
  trackId,
  title,
  artistName,
  releaseId,
}: {
  open: boolean;
  onClose: () => void;
  trackId: string;
  title: string;
  artistName: string;
  releaseId: string | null;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const share = () => {
    Share.share({ message: `${title} — ${artistName}`, url: `${WEB_BASE_URL}/` }).catch(() => {});
  };

  const openRelease = () => {
    if (!releaseId) return;
    navigation.navigate('Main', { screen: 'Home', params: { screen: 'ReleaseDetail', params: { releaseId } } });
  };

  return (
    <>
      <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <ActionRow icon="share" label="Поделиться" onPress={run(share)} />
          <ActionRow icon="plus" label="В плейлист" onPress={run(() => setPlaylistOpen(true))} />
          {releaseId && <ActionRow icon="list" label="К релизу" onPress={run(openRelease)} />}
        </View>
      </Modal>
      <AddToPlaylistSheet trackId={trackId} open={playlistOpen} onOpenChange={setPlaylistOpen} hideTrigger />
    </>
  );
}

function ActionRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={20} color={colors.foreground} />
      <Text style={type.body}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3,2,1,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.touchTarget },
});
