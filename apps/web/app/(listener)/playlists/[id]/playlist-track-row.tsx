'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/components/player/audio-engine';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';
import type { PlayerTrack } from '@/store/player';
import type { PlaylistTrackRow as TrackData } from '@vire/db';
import { Icon } from '@/components/icon';

interface Props {
  track: TrackData;
  queue: PlayerTrack[];
  queueIndex: number;
  playlistId: string;
  isOwner: boolean;
}

export function PlaylistTrackRow({ track, queue, queueIndex, playlistId, isOwner }: Props) {
  const [removing, setRemoving] = useState(false);
  const currentTrackId = usePlayerStore((s) => s.track?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isThisTrack = currentTrackId === track.id;

  const playerTrack: PlayerTrack = {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    coverUrl: track.coverUrl,
    artistSlug: track.artistSlug,
    releaseId: track.releaseId,
  };

  function handlePlay() {
    if (isThisTrack) controls.togglePlay();
    else controls.play(playerTrack, queue, queueIndex);
  }

  async function handleRemove() {
    setRemoving(true);
    await fetch(`/api/v1/playlists/${playlistId}/tracks/${track.id}`, { method: 'DELETE' });
    // Обновим страницу через router
    window.location.reload();
  }

  return (
    <motion.div
      layout
      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-secondary/50 group transition-colors"
    >
      {/* Play button + cover */}
      <button
        onClick={handlePlay}
        aria-label={isThisTrack && isPlaying ? 'Пауза' : `Играть ${track.title}`}
        className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-card"
      >
        {track.coverUrl ? (
          <Image
            src={track.coverUrl}
            alt={track.title}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-secondary" />
        )}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
            isThisTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isThisTrack && isPlaying ? <PauseIcon size={12} className="text-white" /> : <PlayIcon size={12} className="text-white" />}
        </div>
        {isThisTrack && isPlaying && (
          <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-px">
            {[0, 0.1, 0.2].map((d) => (
              <motion.div
                key={d}
                className="w-0.5 bg-white rounded-full"
                animate={{ height: [2, 8, 2] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: d, ease: 'easeInOut' }}
              />
            ))}
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isThisTrack ? 'text-primary' : ''}`}>
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          <Link
            href={`/artists/${track.artistSlug}`}
            className="hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {track.artistName}
          </Link>
        </p>
      </div>

      {/* Duration */}
      {track.durationSec && (
        <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
          {formatDuration(track.durationSec)}
        </span>
      )}

      {/* Remove (owner only) */}
      {isOwner && (
        <button
          onClick={handleRemove}
          disabled={removing}
          aria-label="Удалить из плейлиста"
          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
        >
          <RemoveIcon />
        </button>
      )}
    </motion.div>
  );
}

function RemoveIcon() {
  return <Icon name="x" size={12} />;
}
