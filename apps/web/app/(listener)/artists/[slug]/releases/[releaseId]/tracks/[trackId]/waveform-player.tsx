'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { usePlayerStore, type PlayerTrack, type PlayContext } from '@/store/player';
import { controls, getAudioTime } from '@/lib/player/audio-engine';
import { WaveformScrubber } from '@/components/player/waveform-scrubber';
import { useAudioTime } from '@/lib/player/use-audio-time';
import { TrackShare } from '@/components/track-share';
import { PlayIcon, PauseIcon, HeartIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';
import type { MomentBucket } from '@vire/db';

const BAR_COUNT = 120;

interface Props {
  track: PlayerTrack;
  queue: PlayerTrack[];
  queueIndex: number;
  peaks: number[] | null;
  moments: MomentBucket[];
  trackId: string;
  context: PlayContext;
  /** Автоматически перемотать к этой секунде при загрузке */
  seekTo?: number;
}

export function TrackWaveformPlayer({
  track,
  queue,
  queueIndex,
  peaks,
  moments,
  trackId,
  context,
  seekTo,
}: Props) {
  const didSeek = useRef(false);

  const currentTrackId = usePlayerStore((s) => s.track?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const duration = usePlayerStore((s) => s.duration);

  const isThisTrack = currentTrackId === track.id;

  // Seek to ?t= param after track loads
  useEffect(() => {
    if (!seekTo || didSeek.current || !isThisTrack || duration <= 0) return;
    didSeek.current = true;
    controls.seek(Math.min(seekTo, duration - 1));
  }, [seekTo, isThisTrack, duration]);

  // клик только запускает трек — перемотку активного ведёт pointer-скраб внутри WaveformScrubber
  function handleWaveformClick() {
    controls.playQueue(queue, { startIndex: queueIndex, context });
  }

  function handlePlayPause() {
    if (isThisTrack) controls.togglePlay();
    else controls.playQueue(queue, { startIndex: queueIndex, context });
  }

  // время читаем напрямую из движка — не подписываемся на тик ради разового значения на клик
  const handleMarkMoment = useCallback(() => {
    if (!isThisTrack || !duration) return;
    const positionSec = Math.round(getAudioTime());
    fetch(`/api/v1/tracks/${trackId}/moments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSec }),
    }).catch(() => {});
  }, [isThisTrack, duration, trackId]);

  const markers = useMemo(
    () => (duration > 0 ? moments.map((b) => ({ ratio: b.positionSec / duration, count: b.count })) : []),
    [moments, duration],
  );

  return (
    <div className="space-y-3">
      {/* Waveform + момент-маркеры */}
      <div className="relative group">
        <WaveformScrubber
          peaks={peaks}
          barCount={BAR_COUNT}
          markers={markers}
          duration={duration}
          active={isThisTrack}
          onActivate={handleWaveformClick}
          onSeek={(t) => controls.seek(t)}
          hoverAccent
          className="w-full h-24 sm:h-28 rounded"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={isThisTrack && isLoading}
          aria-label={isThisTrack && isPlaying ? 'Пауза' : 'Играть'}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 shrink-0"
          style={{
            background: 'var(--artist-accent)',
            color: 'var(--artist-bg, #0d0d0d)',
            boxShadow: '0 0 28px 2px color-mix(in oklch, var(--artist-accent) 30%, transparent)',
          }}
        >
          {isThisTrack && isLoading ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isThisTrack && isPlaying ? (
            <PauseIcon size={20} />
          ) : (
            <PlayIcon size={20} className="translate-x-[1px]" />
          )}
        </button>

        {/* Time */}
        {isThisTrack && <ActiveTimeLabel duration={duration} />}

        <div className="flex-1" />

        {/* Момент-маркер */}
        {isThisTrack && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={handleMarkMoment}
            title="Отметить любимый момент"
            aria-label="Отметить любимый момент"
            className="w-8 h-8 rounded-full flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity"
            style={{ border: '1px solid var(--artist-accent)' }}
          >
            <HeartIcon size={14} strokeWidth={2} />
          </motion.button>
        )}

        {/* Share с таймкодом — поповер: ссылка на трек или с момента */}
        <WaveformTrackShare isThisTrack={isThisTrack} />
      </div>
    </div>
  );
}

/** Живое «сейчас / всего» — изолированный лист, тикает только пока открыт. */
function ActiveTimeLabel({ duration }: { duration: number }) {
  const currentTime = useAudioTime();
  return (
    <span className="text-xs font-mono opacity-40 tabular-nums shrink-0">
      {formatDuration(currentTime)} / {formatDuration(duration)}
    </span>
  );
}

function WaveformTrackShare({ isThisTrack }: { isThisTrack: boolean }) {
  const currentTime = useAudioTime();
  return (
    <TrackShare
      currentTime={isThisTrack ? currentTime : undefined}
      size="sm"
      variant="bordered"
      align="right"
    />
  );
}
