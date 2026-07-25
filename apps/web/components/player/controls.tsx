'use client';

import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Icon } from '@/components/icon';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ErrorIcon, RepeatIcon, SkipBackIcon, SkipForwardIcon, WaveIcon } from './player-icons';

function PlayerToggleButton({
  icon,
  active,
  disabled,
  onClick,
  label,
  badge,
}: {
  icon: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      whileTap={!disabled ? { scale: 0.88 } : undefined}
      transition={spring.snappy}
      className="relative p-2 -m-1 transition-colors disabled:pointer-events-none pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
      style={active && !disabled ? { color: 'var(--artist-accent, oklch(72% 0.19 145))' } : { opacity: 0.3 }}
    >
      {/* бейдж якорится к иконке, а не к боксу — на pointer-coarse бокс 44px, иначе бейдж отлетает */}
      <span className="relative inline-flex items-center justify-center">
        {icon}
        {badge}
      </span>
      <AnimatePresence>
        {active && !disabled && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.22, scale: 1.9 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={spring.snappy}
            aria-hidden="true"
            className="absolute inset-0 rounded-full blur-md pointer-events-none"
            style={{ background: 'var(--artist-accent, oklch(72% 0.19 145))' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Кнопка «Волны». Вынесена из Controls — в фуллскрине стоит отдельно, зеркально кнопке лайка. */
export function WaveModeButton() {
  const waveMode = usePlayerStore((s) => s.waveMode);
  return (
    <PlayerToggleButton
      icon={<WaveIcon />}
      active={waveMode}
      onClick={() => controls.setWaveMode(!waveMode)}
      label={waveMode ? 'Режим волны включён' : 'Режим волны выключен'}
    />
  );
}

export function ShuffleButton() {
  const shuffle = usePlayerStore((s) => s.shuffle);
  return (
    <PlayerToggleButton
      icon={<Icon name="shuffle" size={18} />}
      active={shuffle}
      onClick={() => controls.toggleShuffle()}
      label={shuffle ? 'Случайный порядок включён' : 'Случайный порядок'}
    />
  );
}

const REPEAT_LABELS = {
  off: 'Повтор выключен',
  all: 'Повтор очереди',
  one: 'Повтор трека',
} as const;

export function RepeatButton() {
  const repeat = usePlayerStore((s) => s.repeat);
  return (
    <PlayerToggleButton
      icon={<RepeatIcon />}
      active={repeat !== 'off'}
      onClick={() => controls.cycleRepeat()}
      label={REPEAT_LABELS[repeat]}
      badge={
        repeat === 'one' ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3 h-3 rounded-full text-[8px] font-bold leading-none"
            style={{ background: 'var(--artist-accent, oklch(72% 0.19 145))', color: 'var(--background)' }}
          >
            1
          </span>
        ) : null
      }
    />
  );
}

const PLAY_PAUSE_SIZE_CLASS = {
  bar: 'w-10 h-10',
  full: 'w-12 h-12 pointer-coarse:w-14 pointer-coarse:h-14',
} as const;

/** Play/pause; в restored-состоянии клик зовёт resumeRestored(), а не паузу несуществующего audio. */
function PlayPauseButton({ size }: { size: 'bar' | 'full' }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const hasAudio = usePlayerStore((s) => s.hasAudio);
  const audioError = usePlayerStore((s) => s.audioError);
  const restored = usePlayerStore((s) => s.restored);

  const iconKey = audioError ? 'error' : isLoading ? 'loading' : isPlaying ? 'pause' : 'play';
  // Буферизация уже играющего трека кнопку не блокирует — на медленной сети 'waiting' приходит постоянно.
  const disabled = audioError || (!hasAudio && !restored) || (isLoading && !isPlaying);
  const iconSize = size === 'full' ? 18 : undefined;

  return (
    <motion.button
      onClick={() => (restored ? controls.resumeRestored() : controls.togglePlay())}
      disabled={disabled}
      aria-label={audioError ? 'Ошибка загрузки' : isPlaying ? 'Пауза' : 'Играть'}
      title={audioError ? 'Не удалось загрузить трек' : undefined}
      whileTap={!disabled ? { scale: 0.92 } : undefined}
      transition={spring.snappy}
      className={`relative ${PLAY_PAUSE_SIZE_CLASS[size]} rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={iconKey}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={spring.snappy}
          className="flex items-center justify-center"
        >
          {audioError ? (
            <ErrorIcon />
          ) : isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon size={iconSize} />
          ) : (
            <PlayIcon size={iconSize} className="translate-x-[1px]" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export function Controls({
  showWaveMode = true,
  showShuffle = false,
  showRepeat = false,
  hideExtrasBelowSm = false,
  size = 'bar',
}: {
  showWaveMode?: boolean;
  showShuffle?: boolean;
  showRepeat?: boolean;
  hideExtrasBelowSm?: boolean;
  size?: 'bar' | 'full';
}) {
  const extraClass = `${hideExtrasBelowSm ? 'hidden sm:flex' : 'flex'} w-9 justify-center`;

  return (
    <div className="flex items-center gap-4 sm:gap-5 justify-center flex-1">
      {showShuffle && (
        <span className={extraClass}>
          <ShuffleButton />
        </span>
      )}
      <motion.button
        onClick={() => controls.prev()}
        aria-label="Предыдущий трек"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        className="p-2 -m-1 opacity-50 hover:opacity-100 transition-opacity pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
      >
        <SkipBackIcon />
      </motion.button>

      <PlayPauseButton size={size} />

      <motion.button
        onClick={() => controls.next()}
        aria-label="Следующий трек"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        className="p-2 -m-1 opacity-50 hover:opacity-100 transition-opacity pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center"
      >
        <SkipForwardIcon />
      </motion.button>

      {showWaveMode && <WaveModeButton />}

      {showRepeat && (
        <span className={extraClass}>
          <RepeatButton />
        </span>
      )}
    </div>
  );
}
