import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AddToPlaylistSheet } from '../add-to-playlist-sheet';
import { BottomSheet, SheetRow } from '../ui/bottom-sheet';
import type { RootStackParamList } from '../../navigation/root-navigator';

/**
 * Лист действий по треку — открывают `⋯` в шапке плеера и долгое нажатие на обложку.
 *
 * На `BottomSheet`, не на системном `Modal`: у Modal своё окно, и системный диалог поверх
 * продукта выглядит чужим — этот лист был последним местом в плеере, где Modal оставался.
 * «Поделиться» открывает существующий `ShareSheet` в родителе, а не дублирует его здесь.
 */
export function TrackActionSheet({
  open,
  onClose,
  trackId,
  title,
  releaseId,
  artistSlug,
  hasLyrics,
  onShowLyrics,
  onShare,
  onOpenArtist,
}: {
  open: boolean;
  onClose: () => void;
  trackId: string;
  title: string;
  releaseId: string | null;
  artistSlug: string | null;
  hasLyrics: boolean;
  onShowLyrics: () => void;
  onShare: () => void;
  onOpenArtist: (slug: string) => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const openRelease = () => {
    if (!releaseId) return;
    navigation.navigate('Main', { screen: 'Home', params: { screen: 'ReleaseDetail', params: { releaseId } } });
  };

  return (
    <>
      <BottomSheet open={open} title={title} onClose={onClose}>
        {hasLyrics && <SheetRow icon="text" label="Текст" onPress={run(onShowLyrics)} />}
        <SheetRow icon="list-plus" label="В плейлист" onPress={run(() => setPlaylistOpen(true))} />
        <SheetRow icon="share" label="Поделиться" onPress={run(onShare)} />
        {releaseId && <SheetRow icon="list" label="К релизу" onPress={run(openRelease)} />}
        {artistSlug && (
          <SheetRow icon="user" label="Открыть артиста" onPress={run(() => onOpenArtist(artistSlug))} />
        )}
      </BottomSheet>
      <AddToPlaylistSheet
        trackId={trackId}
        open={playlistOpen}
        onOpenChange={setPlaylistOpen}
        inline
        hideTrigger
      />
    </>
  );
}
