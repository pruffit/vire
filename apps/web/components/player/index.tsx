'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, Reorder, motion, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from './audio-engine';
import { usePlayerHotkeys } from './use-player-hotkeys';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';
import { TrackShare } from '@/components/track-share';
import { Lyrics } from './lyrics';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';
import { isDesktopPointer } from '@/lib/is-desktop-pointer';

export function Player() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    initAudioEngine();
  }, []);
  usePlayerHotkeys();

  const track = usePlayerStore((s) => s.track);

  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', track ? '4rem' : '0px');
    return () => document.documentElement.style.setProperty('--player-h', '0px');
  }, [track]);

  return (
    <>
      {/* Мини-бар: всплывает снизу при появлении трека, уезжает вниз при сбросе. */}
      <AnimatePresence>
        {track && (
          <motion.div
            key="player-bar"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={spring.smooth}
            className="relative shrink-0 h-16 border-t border-border overflow-hidden"
            style={{ '--artist-accent': track.accentColor ?? undefined } as React.CSSProperties}
          >
            {/* Ambient — размытая обложка создаёт цветовой ореол без JS-извлечения цвета */}
            {track.coverUrl && (
              <div
                aria-hidden="true"
                className="absolute inset-0 scale-110"
                style={{
                  backgroundImage: `url(${track.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(48px) saturate(2)',
                  opacity: 0.12,
                }}
              />
            )}
            <div className="absolute inset-0 bg-card/88" />
            <div className="relative z-10 flex items-center h-full px-4 gap-4">
              <TrackInfo onExpandCover={() => setExpanded(true)} />
              <Controls />
              <ProgressSection />
            </div>
            {/* Тонкая полоска прогресса внизу бара — видна на всех размерах */}
            <MiniProgressBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Фуллскрин: обложка разворачивается из мини-бара (shared layoutId). */}
      <AnimatePresence>
        {expanded && track && <FullscreenPlayer onClose={() => setExpanded(false)} />}
      </AnimatePresence>
    </>
  );
}

/** Имя артиста → страница артиста, название → страница трека. Если слаг/releaseId
 *  не известны источнику, показываем простой текст без ссылки. */
function ArtistLink({ track, className, onClick }: { track: PlayerTrack; className?: string; onClick?: () => void }) {
  if (!track.artistSlug) return <span className={className}>{track.artistName}</span>;
  return (
    <Link href={`/artists/${track.artistSlug}`} onClick={onClick} className={`${className ?? ''} hover:underline`}>
      {track.artistName}
    </Link>
  );
}

function TitleLink({ track, className, onClick }: { track: PlayerTrack; className?: string; onClick?: () => void }) {
  if (!track.artistSlug || !track.releaseId) return <span className={className}>{track.title}</span>;
  return (
    <Link
      href={`/artists/${track.artistSlug}/releases/${track.releaseId}/tracks/${track.id}`}
      onClick={onClick}
      className={`${className ?? ''} hover:underline`}
    >
      {track.title}
    </Link>
  );
}

function TrackInfo({ onExpandCover }: { onExpandCover: () => void }) {
  const track = usePlayerStore((s) => s.track);
  if (!track) return null;

  return (
    <div className="flex items-center gap-3 w-1/3 min-w-0">
      <button
        onClick={onExpandCover}
        aria-label="Открыть плеер на весь экран"
        className="w-11 h-11 shrink-0 relative group"
      >
        {/* layoutId связывает эту обложку с большой в фуллскрине */}
        <motion.div
          layoutId="player-cover"
          className="absolute inset-0 rounded overflow-hidden bg-white/5"
          transition={spring.smooth}
        >
          {track.coverUrl && (
            <Image src={track.coverUrl} alt={track.title} fill sizes="44px" className="object-cover" />
          )}
        </motion.div>
        <span className="absolute inset-0 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <ExpandIcon />
        </span>
      </button>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <TitleLink track={track} className="text-[11px] sm:text-sm font-medium truncate leading-tight" />
            {track.isExplicit && <ExplicitBadge />}
          </span>
          <ArtistLink track={track} className="hidden sm:block text-xs text-muted-foreground truncate" />
        </div>
        <span className="hidden sm:inline-flex shrink-0">
          <PlayerLikeButton trackId={track.id} size="sm" />
        </span>
      </div>
    </div>
  );
}

function FullscreenPlayer({ onClose }: { onClose: () => void }) {
  const track = usePlayerStore((s) => s.track);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const [showQueue, setShowQueue] = useState(false);

  // Esc закрывает полноэкранный режим
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!track) return null;

  // Свайп вниз достаточно далеко/быстро — закрыть. Иначе пружина вернёт на место.
  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      // Очередь использует свой drag-reorder + скролл — отключаем dismiss-свайп при ней.
      drag={showQueue ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={handleDragEnd}
      className="fixed inset-0 z-50 bg-card/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto px-6 py-12"
      style={{ '--artist-accent': track.accentColor ?? undefined } as React.CSSProperties}
    >
      <button
        onClick={onClose}
        aria-label="Свернуть плеер"
        className="fixed top-5 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
      >
        <ChevronDownIcon />
      </button>

      {/* Подсказка-«хваталка» для свайпа вниз */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />

      <div className="my-auto w-full max-w-md flex flex-col items-center gap-8">
        {/* Большая обложка — тот же layoutId, что у мини-бара */}
        <motion.div
          layoutId="player-cover"
          transition={spring.smooth}
          className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-lg overflow-hidden shadow-2xl bg-white/5 cursor-grab active:cursor-grabbing"
        >
          {track.coverUrl && (
            <Image src={track.coverUrl} alt={track.title} fill sizes="320px" className="object-cover" />
          )}
        </motion.div>

        {/* Поток (слева) + название + артист + лайк (справа) — поток зеркалит лайк */}
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="shrink-0">
            <WaveModeButton />
          </div>
          <div className="flex-1 min-w-0 text-center">
            <span className="flex items-center justify-center gap-2 min-w-0">
              <TitleLink track={track} onClick={onClose} className="text-xl font-semibold truncate" />
              {track.isExplicit && <ExplicitBadge />}
            </span>
            <ArtistLink track={track} onClick={onClose} className="text-sm text-muted-foreground truncate block mt-1" />
          </div>
          <div className="shrink-0">
            <PlayerLikeButton trackId={track.id} size="md" />
          </div>
        </div>

        {/* Прогресс */}
        <div className="w-full flex items-center gap-3">
          <TimeLabel which="current" />
          <Waveform large />
          <TimeLabel which="duration" />
        </div>

        {/* Управление (без кнопки потока — она перенесена в строку названия) */}
        <Controls showWaveMode={false} />

        {/* Синхронизированный текст (если есть) */}
        <Lyrics key={track.id} trackId={track.id} />

        {/* Нижняя панель: громкость (десктоп) + поделиться + очередь — одной строкой,
            список очереди раскрывается под ней (а не отдельным центрированным блоком). */}
        <div className="w-full flex flex-col items-center gap-3">
          <FullscreenExtras
            track={track}
            queueLength={queueLength}
            showQueue={showQueue}
            onToggleQueue={() => setShowQueue((s) => !s)}
          />
          <AnimatePresence initial={false}>
            {showQueue && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.smooth}
                className="w-full overflow-hidden"
              >
                <QueuePanel onJump={() => setShowQueue(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function QueuePanel({ onJump }: { onJump: () => void }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentId = usePlayerStore((s) => s.track?.id);

  function handleReorder(order: PlayerTrack[]) {
    const idx = currentId ? order.findIndex((t) => t.id === currentId) : 0;
    usePlayerStore.getState()._setState({ queue: order, queueIndex: Math.max(0, idx) });
  }

  function jump(t: PlayerTrack) {
    const q = usePlayerStore.getState().queue;
    const idx = q.findIndex((x) => x.id === t.id);
    if (idx >= 0) controls.play(q[idx], q, idx);
    onJump();
  }

  return (
    <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="mt-3 w-full space-y-1">
      {queue.map((t) => {
        const isCurrent = t.id === currentId;
        return (
          <Reorder.Item
            key={t.id}
            value={t}
            className={`flex items-center gap-2 px-2 py-2 rounded-md select-none ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <span className="text-white/25 cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
              <GripIcon />
            </span>
            <button
              type="button"
              onClick={() => jump(t)}
              className="flex-1 min-w-0 text-left"
            >
              <span
                className="text-sm truncate flex items-center gap-1.5"
                style={isCurrent ? { color: 'var(--artist-accent)' } : undefined}
              >
                <span className="truncate">{t.title}</span>
                {t.isExplicit && <ExplicitBadge />}
              </span>
              <span className="text-xs text-muted-foreground truncate block">{t.artistName}</span>
            </button>
            {isCurrent && <PlayingDot />}
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}

// Тип указателя (десктоп/тач) в рамках сессии считаем стабильным — подписка-пустышка.
const subscribeNoop = () => () => {};

function FullscreenExtras({
  track,
  queueLength,
  showQueue,
  onToggleQueue,
}: {
  track: PlayerTrack;
  queueLength: number;
  showQueue: boolean;
  onToggleQueue: () => void;
}) {
  const volume = usePlayerStore((s) => s.volume);
  const currentTime = usePlayerStore((s) => s.currentTime);

  // Ползунок громкости — только на десктопе (мышь/трекпад). На планшетах/телефонах
  // прячем: там громкостью рулят хардварные кнопки. useSyncExternalStore: на сервере
  // true (показываем), на клиенте — реальный детект, без рассинхрона гидрации.
  const showVolume = useSyncExternalStore(subscribeNoop, isDesktopPointer, () => true);

  const shareUrl =
    track.artistSlug && track.releaseId
      ? `${window.location.origin}/artists/${track.artistSlug}/releases/${track.releaseId}/tracks/${track.id}`
      : undefined;

  return (
    // stopPropagation, чтобы взаимодействие с громкостью/share/очередью не закрывало плеер свайпом.
    // Десктоп: ползунок (flex-1) раздвигает строку, share+очередь уходят вправо.
    // Тач (без громкости): share и «Очередь» стоят рядом одной центрированной группой.
    <div
      className={showVolume ? 'w-full flex items-center gap-4' : 'flex items-center gap-6'}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showVolume && (
        <>
          <motion.button
            onClick={() => controls.toggleMute()}
            aria-label={volume === 0 ? 'Включить звук' : 'Выключить звук'}
            whileTap={{ scale: 0.88 }}
            transition={spring.snappy}
            className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
          >
            <VolumeIcon muted={volume === 0} />
          </motion.button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => controls.setVolume(Number(e.target.value))}
            aria-label="Громкость"
            className="flex-1 h-1 accent-primary cursor-pointer"
          />
        </>
      )}
      {shareUrl && <TrackShare trackUrl={shareUrl} currentTime={currentTime} align="right" />}
      {queueLength > 1 && (
        <button
          type="button"
          onClick={onToggleQueue}
          aria-expanded={showQueue}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <QueueIcon />
          {showQueue ? 'Скрыть очередь' : `Очередь · ${queueLength}`}
        </button>
      )}
    </div>
  );
}

function TimeLabel({ which }: { which: 'current' | 'duration' }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  return (
    <span className="text-xs font-mono text-muted-foreground tabular-nums w-9 text-center shrink-0">
      {formatDuration(which === 'current' ? currentTime : duration)}
    </span>
  );
}

function Controls({ showWaveMode = true }: { showWaveMode?: boolean }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const hasAudio = usePlayerStore((s) => s.hasAudio);
  const audioError = usePlayerStore((s) => s.audioError);

  // Иконка плеера: ошибка / загрузка / пауза / играть — выбираем ключ для морфинга.
  const iconKey = audioError ? 'error' : isLoading ? 'loading' : isPlaying ? 'pause' : 'play';

  return (
    <div className="flex items-center gap-5 justify-center flex-1">
      <motion.button
        onClick={() => controls.prev()}
        aria-label="Предыдущий трек"
        whileTap={{ scale: 0.92 }}
        transition={spring.snappy}
        className="p-2 -m-1 opacity-50 hover:opacity-100 transition-opacity"
      >
        <SkipBackIcon />
      </motion.button>

      <motion.button
        onClick={() => controls.togglePlay()}
        disabled={!hasAudio || isLoading || audioError}
        aria-label={audioError ? 'Ошибка загрузки' : isPlaying ? 'Пауза' : 'Играть'}
        title={audioError ? 'Не удалось загрузить трек' : undefined}
        whileTap={hasAudio && !isLoading && !audioError ? { scale: 0.92 } : undefined}
        transition={spring.snappy}
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:bg-primary/90"
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
    </div>
  );
}

/** Кнопка «Волны» (поток). Вынесена из Controls, чтобы в фуллскрине её можно
 *  было поставить отдельно — зеркально кнопке лайка в строке названия. */
function WaveModeButton() {
  const waveMode = usePlayerStore((s) => s.waveMode);

  return (
    <motion.button
      onClick={() => controls.setWaveMode(!waveMode)}
      aria-label={waveMode ? 'Режим волны включён' : 'Режим волны выключен'}
      aria-pressed={waveMode}
      whileTap={{ scale: 0.88 }}
      transition={spring.snappy}
      className="relative p-2 -m-1 transition-colors"
      style={
        waveMode
          ? { color: 'var(--artist-accent, oklch(72% 0.19 145))' }
          : { opacity: 0.3 }
      }
    >
      <WaveIcon />
      <AnimatePresence>
        {waveMode && (
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

function MiniProgressBar() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const ref = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? (duration > 0 ? currentTime / duration : 0);

  function ratioFromX(clientX: number): number {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromX(e.clientX));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (scrub === null || !duration) return;
    setScrub(ratioFromX(e.clientX));
  }
  function commit() {
    if (scrub === null || !duration) return;
    controls.seek(scrub * duration);
    setScrub(null);
  }

  const dragging = scrub !== null;

  return (
    // Зона касания 12px по высоте (видимая полоска — 2px у самого низа); на
    // мобилке это единственная перемотка в мини-баре. touch-none — без скролла.
    <div
      ref={ref}
      role="slider"
      aria-label="Перемотка"
      aria-valuenow={Math.round(shown * duration)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={commit}
      onPointerCancel={() => setScrub(null)}
      className="absolute bottom-0 left-0 right-0 h-3 flex items-end touch-none cursor-pointer group"
    >
      <div className={`relative w-full bg-white/5 transition-[height] ${dragging ? 'h-[3px]' : 'h-[2px]'}`}>
        <div
          className={dragging ? 'h-full' : 'h-full transition-[width] duration-100 ease-linear'}
          style={{
            width: `${shown * 100}%`,
            background: 'var(--artist-accent, oklch(72% 0.19 145))',
            opacity: dragging ? 1 : 0.7,
          }}
        />
      </div>
    </div>
  );
}

function ProgressSection() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);

  // Ползунок громкости — только на десктопе (см. FullscreenExtras). На планшете в
  // ландшафте (≥lg по ширине, но тач) тоже прячем.
  const showVolume = useSyncExternalStore(subscribeNoop, isDesktopPointer, () => true);

  return (
    <div className="hidden sm:flex items-center gap-2 w-1/3 justify-end">
      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
        {formatDuration(currentTime)}
      </span>

      <Waveform />

      <span className="text-xs font-mono text-muted-foreground tabular-nums w-8">
        {formatDuration(duration)}
      </span>

      {showVolume && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => controls.setVolume(Number(e.target.value))}
          aria-label="Громкость"
          className="w-16 h-1 accent-primary cursor-pointer hidden lg:block"
        />
      )}
    </div>
  );
}

function Waveform({ large = false }: { large?: boolean }) {
  const peaks = usePlayerStore((s) => s.waveformPeaks);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const svgRef = useRef<SVGSVGElement>(null);
  // Локальный скраб (0..1) во время перетаскивания: ведёт визуал мгновенно,
  // seek в аудио — только на отпускании (без рывков HLS при каждом движении).
  const [scrub, setScrub] = useState<number | null>(null);
  const progress = scrub ?? (duration > 0 ? currentTime / duration : 0);

  function ratioFromX(clientX: number): number {
    const el = svgRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!duration) return;
    e.stopPropagation(); // не запускать dismiss-свайп фуллскрина
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromX(e.clientX));
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (scrub === null || !duration) return;
    setScrub(ratioFromX(e.clientX));
  }
  function commit() {
    if (scrub === null || !duration) return;
    controls.seek(scrub * duration);
    setScrub(null);
  }
  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (!duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      controls.seek(Math.min(duration, currentTime + 5));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      controls.seek(Math.max(0, currentTime - 5));
    }
  }

  // Нет пиков — нативный range (тач/драг из коробки). stopPropagation, чтобы
  // перетаскивание не закрывало фуллскрин; touch-none — без скролла страницы.
  if (!peaks || peaks.length === 0) {
    return (
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        step={0.5}
        onChange={(e) => controls.seek(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Перемотка"
        className={`flex-1 accent-primary cursor-pointer touch-none ${large ? 'h-1.5' : 'h-1'}`}
      />
    );
  }

  const BAR_COUNT = 80;
  const step = peaks.length / BAR_COUNT;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const from = Math.floor(i * step);
    const to = Math.min(Math.ceil((i + 1) * step), peaks.length);
    const slice = peaks.slice(from, to);
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  });

  const SVG_H = 24;
  const BAR_W = 2;
  const BAR_GAP = 1;
  const SVG_W = BAR_COUNT * (BAR_W + BAR_GAP);
  const playheadX = progress * SVG_W;
  const dragging = scrub !== null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={commit}
      onPointerCancel={() => setScrub(null)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label="Перемотка"
      role="slider"
      aria-valuenow={Math.round(progress * duration)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      // touch-none — палец скраббит, а не скроллит страницу; крупнее зона на
      // фуллскрине (мобилка). На драге явно растим высоту для точности.
      className={`flex-1 touch-none select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm transition-[height] ${
        large ? 'h-9' : 'h-6'
      } ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
    >
      {bars.map((peak, i) => {
        const h = Math.max(2, peak * (SVG_H - 4));
        const x = i * (BAR_W + BAR_GAP);
        const played = i / BAR_COUNT < progress;
        return (
          <rect
            key={i}
            x={x}
            y={(SVG_H - h) / 2}
            width={BAR_W}
            height={h}
            rx={0.5}
            style={{
              fill: played ? 'var(--artist-accent, rgba(255,255,255,0.75))' : 'rgba(255,255,255,0.18)',
              transition: dragging ? 'none' : 'fill 0.12s linear',
            }}
          />
        );
      })}
      {/* Playhead — тонкая линия позиции; ярче во время перетаскивания */}
      {duration > 0 && (
        <rect
          x={Math.min(SVG_W - 1, Math.max(0, playheadX - 0.5))}
          y={0}
          width={1}
          height={SVG_H}
          style={{ fill: 'var(--artist-accent, rgba(255,255,255,0.9))', opacity: dragging ? 0.9 : 0.5 }}
        />
      )}
    </svg>
  );
}

function ExpandIcon() {
  return <Icon name="maximize-2" size={14} className="text-white" />;
}

function ChevronDownIcon() {
  return <Icon name="chevron-down" size={20} />;
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="19,20 9,12 19,4" />
      <rect x="5" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,4 15,12 5,20" />
      <rect x="17" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return <Icon name={muted ? 'volume-x' : 'volume-2'} size={16} className="opacity-50 shrink-0" />;
}

function QueueIcon() {
  return <Icon name="list" size={15} />;
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function PlayingDot() {
  return (
    <span
      className="shrink-0 w-1.5 h-1.5 rounded-full animate-pulse"
      style={{ background: 'var(--artist-accent)' }}
      aria-hidden="true"
    />
  );
}

function WaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12 C4.5 6, 7.5 6, 10 12 C12.5 18, 15.5 18, 18 12 C20.5 6, 22 6, 22 12" />
    </svg>
  );
}
