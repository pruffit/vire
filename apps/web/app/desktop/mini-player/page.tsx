'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { SkipBackIcon, SkipForwardIcon } from '@/components/player/player-icons';
import { ProgressLine } from '@/components/player/progress-line';
import { useMiniPlayerState } from '@/lib/player/desktop-sync';

function MarqueeText({ text, className }: { text: string; className: string }) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
  }, [text]);

  return (
    <span className={`block overflow-hidden whitespace-nowrap ${className}`}>
      <span ref={measureRef} className="inline-block max-w-full">
        {!overflowing && <span className="block truncate">{text}</span>}
      </span>
      {overflowing && (
        <span className="inline-flex w-max animate-mini-player-marquee">
          <span className="pr-8">{text}</span>
          <span className="pr-8" aria-hidden="true">{text}</span>
        </span>
      )}
    </span>
  );
}

export default function MiniPlayerPage() {
  const { track, isPlaying, positionSec, durationSec, togglePlay, next, prev } = useMiniPlayerState();

  return (
    <div
      data-tauri-drag-region
      className="h-full w-full relative flex flex-col justify-between select-none bg-background text-foreground px-3 py-2.5 gap-2"
      style={{ '--artist-accent': track?.accentColor ?? undefined } as React.CSSProperties}
    >
      {/* Визуальный индикатор, без перемотки — команды seek нет в протоколе синка (см. desktop-sync.ts). */}
      <div className="pointer-events-none">
        <ProgressLine position={positionSec} duration={durationSec} onSeek={() => {}} />
      </div>

      <div data-tauri-drag-region className="flex items-center gap-2.5 min-w-0 pt-1">
        <span className="w-11 h-11 shrink-0 relative rounded overflow-hidden bg-muted">
          {track?.coverUrl && <Image src={track.coverUrl} alt="" fill sizes="44px" className="object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          {track ? (
            <>
              <MarqueeText text={track.title} className="text-xs font-medium" />
              <MarqueeText text={track.artistName} className="text-[11px] text-muted-foreground" />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Ничего не играет</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={prev}
          aria-label="Предыдущий трек"
          className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"
        >
          <SkipBackIcon />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Пауза' : 'Играть'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Следующий трек"
          className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"
        >
          <SkipForwardIcon />
        </button>
      </div>
    </div>
  );
}
