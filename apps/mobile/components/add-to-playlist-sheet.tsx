import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
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
import { Cover } from './ui/cover';
import { usePreferences } from '../lib/design/preferences';
import { colors } from '../lib/theme';
import { type } from '../lib/design/typography';
import { space, layout, radii } from '../lib/design/scales';

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
        <Glass style={[styles.panel, { paddingBottom: insets.bottom + space.md }]} radius={radii.sheet} intensity={55}>
          <View style={styles.grabber} />

          <View style={styles.head}>
            <Text style={type.releaseTitle}>В плейлист</Text>
            <Pressable
              onPress={close}
              hitSlop={12}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Icon name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Создание — первой строкой, а не полем на дне: чаще всего трек кладут в
                новый плейлист именно в этот момент, а до дна списка ещё надо долистать. */}
            <View style={styles.createRow}>
              <View style={styles.createGlyph}>
                <Icon name="plus" size={20} color={colors.foreground} />
              </View>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Новый плейлист"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              {newTitle.trim().length > 0 && (
                <Pressable
                  style={[styles.createButton, creating && styles.createButtonDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                  accessibilityRole="button"
                  accessibilityLabel="Создать плейлист"
                >
                  <Text style={[type.button, styles.createButtonText]}>Создать</Text>
                </Pressable>
              )}
            </View>

            {playlists.length === 0 ? (
              <Text style={[type.caption, styles.empty]}>Плейлистов пока нет — назовите первый</Text>
            ) : (
              playlists.map((p) => (
                <PlaylistRow
                  key={p.id}
                  playlist={p}
                  inIt={inPlaylists.has(p.id)}
                  onPress={() => togglePlaylist(p.id)}
                />
              ))
            )}
          </ScrollView>
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
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: inIt }}
      accessibilityLabel={playlist.title}
    >
      <Cover uri={playlist.coverUrl} size={COVER} radius={radii.coverSm} />
      <View style={styles.rowText}>
        <Text style={type.row} numberOfLines={1}>
          {playlist.title}
        </Text>
        <Text style={type.caption}>{playlist.trackCount} трек{plural(playlist.trackCount)}</Text>
      </View>
      <View style={[styles.check, inIt && styles.checkOn]}>
        {inIt && <Icon name="check" size={14} color={colors.background} />}
      </View>
    </Pressable>
  );
}

/** 1 трек · 2 трека · 5 треков. */
function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return '';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'а';
  return 'ов';
}

const COVER = 48;
const CHECK = 26;

const styles = StyleSheet.create({
  trigger: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: { paddingTop: space.sm, paddingHorizontal: layout.screenPadding, maxHeight: '78%' },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: layout.touchTarget, height: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: space.sm, gap: space.xs },

  createRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 },
  createGlyph: {
    width: COVER,
    height: COVER,
    borderRadius: radii.coverSm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  input: { ...type.row, flex: 1, paddingVertical: space.sm },
  createButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
  },
  createButtonDisabled: { opacity: 0.4 },
  createButtonText: { color: colors.background },

  empty: { paddingVertical: space.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 },
  rowPressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.foreground, borderColor: colors.foreground },
});
