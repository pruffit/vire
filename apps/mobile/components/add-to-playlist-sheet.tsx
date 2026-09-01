import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { PlaylistSummaryDTO } from '@vire/api-contracts';
import {
  fetchPlaylistsForTrack,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  createPlaylist,
} from '../lib/playlists';
import { Icon } from '../lib/icon';
import { Glass } from './glass';
import { usePreferences } from '../lib/design/preferences';
import { colors, radius } from '../lib/theme';

export function AddToPlaylistSheet({
  trackId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  trackId: string;
  /** Внешнее управление (лист действий фуллскрин-плеера) — по умолчанию свой стейт + свой триггер. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };
  const pushSheet = usePreferences((s) => s.pushSheet);
  const popSheet = usePreferences((s) => s.popSheet);
  const [playlists, setPlaylists] = useState<PlaylistSummaryDTO[]>([]);
  const [inPlaylists, setInPlaylists] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchPlaylistsForTrack(trackId).then((result) => {
      if (!result.ok) return;
      setPlaylists(result.data.playlists);
      setInPlaylists(new Set(result.data.inPlaylists ?? []));
    });
  }, [open, trackId]);

  // Пока лист открыт, нижние стеклянные поверхности гасят живой бэкдроп: они за скримом,
  // преломлять им нечего. Это предписывает кит и это же держит бюджет поверхностей в
  // зелёной зоне — без подавления «поиск + мини-плеер + таб-бар + лист» давали 7
  // (`lib/design/glass-budget.ts`). Через эффект, а не через обработчики: размонтирование
  // с открытым листом иначе оставило бы счётчик навсегда поднятым.
  useEffect(() => {
    if (!open) return;
    pushSheet();
    return popSheet;
  }, [open, pushSheet, popSheet]);

  function close() {
    setOpen(false);
    setNewTitle('');
  }

  function togglePlaylist(playlistId: string) {
    const adding = !inPlaylists.has(playlistId);

    setInPlaylists((prev) => {
      const next = new Set(prev);
      if (adding) next.add(playlistId); else next.delete(playlistId);
      return next;
    });

    const request = adding
      ? addTrackToPlaylist(playlistId, trackId)
      : removeTrackFromPlaylist(playlistId, trackId);

    request.then((result) => {
      if (result.ok) return;
      setInPlaylists((prev) => {
        const next = new Set(prev);
        if (adding) next.delete(playlistId); else next.add(playlistId);
        return next;
      });
    });
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    const result = await createPlaylist(title);
    if (!result.ok) {
      setCreating(false);
      return;
    }

    const newPlaylist: PlaylistSummaryDTO = {
      id: result.data.id,
      title,
      visibility: 'PRIVATE',
      trackCount: 0,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);

    const added = await addTrackToPlaylist(result.data.id, trackId);
    if (added.ok) {
      setInPlaylists((prev) => new Set(prev).add(result.data.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setNewTitle('');
    setCreating(false);
  }

  return (
    <>
      {!hideTrigger && (
        <Pressable
          style={styles.trigger}
          hitSlop={12}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setOpen(true);
          }}
        >
          <Icon name="plus" size={18} color={colors.mutedForeground} />
        </Pressable>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close} />
        <Glass style={[styles.panel, { paddingBottom: insets.bottom + 12 }]} radius={24} intensity={55}>
          <Text style={styles.heading}>Добавить в плейлист</Text>

          {playlists.length === 0 ? (
            <Text style={styles.empty}>Плейлистов пока нет</Text>
          ) : (
            <View style={styles.list}>
              {playlists.map((p) => (
                <PlaylistRow
                  key={p.id}
                  playlist={p}
                  inIt={inPlaylists.has(p.id)}
                  onPress={() => togglePlaylist(p.id)}
                />
              ))}
            </View>
          )}

          <View style={styles.createRow}>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Новый плейлист"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              onSubmitEditing={handleCreate}
            />
            <Pressable
              style={[styles.createButton, (!newTitle.trim() || creating) && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!newTitle.trim() || creating}
            >
              <Text style={styles.createButtonText}>Создать</Text>
            </Pressable>
          </View>
        </Glass>
      </Modal>
    </>
  );
}

function PlaylistRow({
  playlist,
  inIt,
  onPress,
}: {
  playlist: PlaylistSummaryDTO;
  inIt: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.checkbox, inIt && styles.checkboxChecked]}>
        {inIt && <Icon name="check" size={12} color={colors.background} />}
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {playlist.title}
      </Text>
      <Text style={styles.rowCount}>{playlist.trackCount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  heading: { color: colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  empty: { color: colors.mutedForeground, fontSize: 14, paddingVertical: 12 },
  list: { gap: 2, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 6 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  rowTitle: { flex: 1, color: colors.cardForeground, fontSize: 15, fontWeight: '600' },
  rowCount: { color: colors.mutedForeground, fontSize: 12 },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  input: { flex: 1, color: colors.cardForeground, fontSize: 15, paddingVertical: 8 },
  createButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.secondary },
  createButtonDisabled: { opacity: 0.4 },
  createButtonText: { color: colors.secondaryForeground, fontSize: 14, fontWeight: '700' },
});
