import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { downloadTrack, removeDownload, getDownloadedTrack, type DownloadTrackInput } from '../lib/offline/download-manager';
import { Icon } from '../lib/icon';
import { colors } from '../lib/theme';

type DownloadState = 'idle' | 'downloading' | 'done';

export function DownloadButton({ meta }: { meta: DownloadTrackInput }) {
  const [state, setState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDownloadedTrack(meta.id).then((entry) => {
      if (!cancelled && entry) setState('done');
    });
    return () => {
      cancelled = true;
    };
  }, [meta.id]);

  const onPress = useCallback(async () => {
    if (state === 'downloading') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (state === 'done') {
      await removeDownload(meta.id);
      setState('idle');
      return;
    }

    setState('downloading');
    setProgress(0);
    try {
      await downloadTrack(meta, (done, total) => setProgress(total > 0 ? done / total : 0));
      setState('done');
    } catch (err) {
      console.error('[offline] скачивание не удалось', meta.id, err);
      setState('idle');
    }
  }, [state, meta]);

  return (
    <Pressable style={styles.button} onPress={onPress} hitSlop={12}>
      {state === 'downloading' ? (
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
      ) : (
        <Icon
          name={state === 'done' ? 'check' : 'download'}
          size={18}
          color={state === 'done' ? colors.foreground : colors.mutedForeground}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  progressText: { color: colors.mutedForeground, fontSize: 10, fontWeight: '700' },
});
