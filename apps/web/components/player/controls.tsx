'use client';

import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls } from './audio-engine';
import { Icon } from '@/components/icon';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ErrorIcon, RepeatIcon, SkipBackIcon, SkipForwardIcon, WaveIcon } from './player-icons';

/** Переиспользуемая кнопка-тоггл: иконка + accent-glow при активном состоянии. */
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
      className="relative p-2 -m-1 transition-colors disabled:pointer-events-none"
      style={active && !disabled ? { color: 'var(--artist-accent, oklch(72% 0.19 145))' } : { opacity: 0.3 }}
    >
      {icon}
      {badge}
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

/** Кнопка «Волны» (поток). Вынесена из Controls, чтобы в фуллскрине её можно
 *  было поставить отдельно — зеркально кнопке лайка в строке названия. */
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

/** Кнопка play/pause. Пока плеер в restored-состоянии (трек/позиция
 *  восстановлены из persist, но ещё не подключены к движку), клик не жмёт
 *  паузу у несуществующего audio — он запускает `resumeRestored()`, который
 *  подгрузит манифест и продолжит с сохранённой позиции. */
function PlayPauseButton() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const hasAudio = usePlayerStore((s) => s.hasAudio);
  const audioError = usePlayerStore((s) => s.audioError);
  const restored = usePlayerStore((s) => s.restored);

  const iconKey = audioError ? 'error' : isLoading ? 'loading' : isPlaying ? 'pause' : 'play';
  const disabled = (!hasAudio && !restored) || isLoading || audioError;

  return (
    <motion.button
      onClick={() => (restored ? controls.resumeRestored() : controls.togglePlay())}
      disabled={disabled}
      aria-label={audioError ? 'Ошибка загрузки' : isPlaying ? 'Пауза' : 'Играть'}
      title={audioError ? 'Не удалось загрузить трек' : undefined}
      whileTap={!disabled ? { scale: 0.92 } : undefined}
      transition={spring.snappy}
      className="relative w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90"
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
            <PauseIcon />
          ) : (
            <PlayIcon className="translate-x-[1px]" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** Блок транспорта: prev/play/next + опционально shuffle/wave/repeat по краям.
 *  Используется и в мини-баре ([Shuffle] prev play next [Wave] [Repeat] на sm+,
 *  Shuffle/Repeat скрыты на мобилке через `hideExtrasBelowSm`), и в фуллскрине
 *  ([Shuffle] prev play next [Repeat], всегда видимые). */
export function Controls({
  showWaveMode = true,
  showShuffle = false,
  showRepeat = false,
  hideExtrasBelowSm = false,
}: {
  showWaveMode?: boolean;
  showShuffle?: boolean;
  showRepeat?: boolean;
  hideExtrasBelowSm?: boolean;
}) {
  const extraClass = `${hideExtrasBelowSm ? 'hidden sm:flex' : 'flex'} w-9 justify-center`;

  return (
    <div className="flex items-center gap-5 justify-center flex-1">
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
        className="p-2 -m-1 opacity-50 hover:opacity-100 transition-opacity"
      >
        <SkipBackIcon />
      </motion.button>

      <PlayPauseButton />

      <motion.button
        onClick={() => controls.next()}
        aria-label="Следующий трек"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        className="p-2 -m-1 opacity-50 hover:opacity-100 transition-opacity"
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
