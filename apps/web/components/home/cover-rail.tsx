'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { PlayerTrack } from '@/store/player';
import { toPlayerTracks } from '@/lib/player/to-player-track';
import { usePlay } from '@/lib/player/use-play';
import { PlayIcon, PauseIcon } from '@/components/icons';
import type { PlayableChartTrack } from '@vire/db';

const CONTEXT = { source: 'home' as const };

export function CoverRail({ tracks }: { tracks: PlayableChartTrack[] }) {
  const queue: PlayerTrack[] = toPlayerTracks(tracks);

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-1 px-1 snap-x">
      {tracks.map((t, i) => (
        <Cell key={t.id} track={t} queue={queue} index={i} />
      ))}
    </div>
  );
}

function Cell({ track, queue, index }: { track: PlayableChartTrack; queue: PlayerTrack[]; index: number }) {
  const { playQueue, toggle, isCurrent, isPlaying } = usePlay();
  const isActive = isCurrent(track.id);

  function play() {
    if (isActive) toggle(track.id);
    else playQueue(queue, { startIndex: index, context: CONTEXT });
  }

  return (
    <div className="shrink-0 w-32 snap-start group">
      <button type="button" onClick={play} aria-label={`Слушать ${track.title}`} className="block w-full text-left">
        <span className="relative block aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 group-hover:ring-white/20 transition-all">
          {track.coverUrl && (
            <Image src={track.coverUrl} alt={track.title} fill quality={60} sizes="128px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/25 transition-colors">
            <span className="opacity-0 group-hover:opacity-100 grid place-items-center w-10 h-10 rounded-full bg-black/70 ring-1 ring-white/30 text-white transition-opacity">
              {isActive && isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={13} className="translate-x-px" />}
            </span>
          </span>
        </span>
        <span className="mt-2 block text-sm font-medium truncate">{track.title}</span>
      </button>
      <Link href={`/artists/${track.artistSlug}`} className="block text-xs text-muted-foreground truncate hover:text-foreground transition-colors">
        {track.artistName}
      </Link>
    </div>
  );
}
