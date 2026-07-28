'use client';
import { useLayoutEffect, useRef } from 'react';
import { useRealtime, type RealtimeEvent } from '@/lib/use-realtime';

type ChangedEvent = RealtimeEvent & { version: number; actorId: string };
type CollaboratorsEvent = RealtimeEvent & { actorId: string };

interface Props {
  playlistId: string;
  selfUserId: string;
  version: number;
  onTracksChanged: (version: number) => void;
  onCollaboratorsChanged: () => void;
}

/**
 * Смонтирован родителем только когда плейлист совместный и зритель — участник
 * (иначе GET .../stream отдаёт 403). Своя правка уже применена оптимистично — свои
 * actorId игнорируем; устаревшие версии (<= уже применённой) тоже отбрасываем.
 */
export function PlaylistRealtimeSync({ playlistId, selfUserId, version, onTracksChanged, onCollaboratorsChanged }: Props) {
  const versionRef = useRef(version);
  useLayoutEffect(() => {
    versionRef.current = version;
  }, [version]);

  useRealtime(`/api/v1/playlists/${playlistId}/stream`, {
    'playlist:snapshot': (event) => {
      const e = event as RealtimeEvent & { version: number };
      if (e.version > versionRef.current) onTracksChanged(e.version);
    },
    'playlist:changed': (event) => {
      const e = event as ChangedEvent;
      if (e.actorId === selfUserId) return;
      if (e.version <= versionRef.current) return;
      onTracksChanged(e.version);
    },
    'playlist:collaborators': (event) => {
      const e = event as CollaboratorsEvent;
      if (e.actorId === selfUserId) return;
      onCollaboratorsChanged();
    },
  });

  return null;
}
