'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useJamSession } from '@/components/jam/jam-session-provider';
import { useJamStore } from '@/store/jam';
import { useJamPosition } from '@/lib/jam/use-jam-position';
import { useWakeLock } from '@/lib/use-wake-lock';
import { formatDuration } from '@/lib/format';
import { Icon } from '@/components/icon';
import { TrackTitleText } from '@/components/track-title';
import { SourceBadge } from '@/components/jam/source-badge';
import { PartyVideoSlot } from '@/components/jam/party-video-slot';
import { Visualizer, useVisualizerEnabled } from '@/components/visualizer';
import { VisualizerCaptureButton } from '@/components/visualizer/capture-button';
import { JamSavePlaylist } from '@/app/[locale]/(listener)/jam/[code]/jam-save-playlist';
import { PARTY_PATH } from '@/lib/party';

const NEXT_COUNT = 4;

interface Props {
  code: string;
  onExit: () => void;
  isLoggedIn: boolean;
}

/**
 * Витрина устройства-колонки: оверлей на весь вьюпорт поверх оболочки (портал в body) —
 * иначе сцена делит высоту с навигацией и плеером, и всё уезжает в скролл. Видео рисует
 * `PartyVideoDock` из app-shell, здесь только слот под него.
 */
export function PartyScreen({ code, onExit, isLoggedIn }: Props) {
  const session = useJamSession();
  const audioEnabled = useJamStore((s) => s.audioEnabled);
  const enableAudio = useJamStore((s) => s.enableAudio);
  const [visualizerOn, setVisualizerOn] = useVisualizerEnabled();
  const [fullscreen, setFullscreen] = useState(false);
  const isPlaying = session?.isPlaying ?? false;
  const position = useJamPosition(isPlaying);
  useWakeLock(true);

  useEffect(() => {
    const sync = (): void => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    // Фуллскрин самого оверлея скрыл бы док видео — он живёт вне его поддерева.
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  if (!session || typeof document === 'undefined') return null;
  const { room, activeItemId, isHost, votedSkipItemId, actions } = session;
  const activeIndex = room.queue.findIndex((item) => item.id === activeItemId);
  const active = activeIndex >= 0 ? room.queue[activeIndex] : undefined;
  const next = activeIndex >= 0 ? room.queue.slice(activeIndex + 1, activeIndex + 1 + NEXT_COUNT) : room.queue.slice(0, NEXT_COUNT);
  const addedByName = active?.addedByParticipantId
    ? room.participants.find((p) => p.id === active.addedByParticipantId)?.displayName
    : undefined;
  const isVideoActive = active?.source === 'YOUTUBE' || active?.source === 'SOUNDCLOUD';
  const needsAudioGesture = !audioEnabled;
  const skipVotes = room.skipVotes?.itemId === activeItemId ? room.skipVotes : null;
  const iVotedSkip = activeItemId !== null && votedSkipItemId === activeItemId;
  const duration = active?.durationSec ?? null;
  const progress = duration && duration > 0 ? Math.min(1, position / duration) : 0;
  const accent = active?.accentColor ?? null;
  // Видео при включённой визуализации уходит в угол, а не занимает сцену. Меньше 200×200
  // ужимать нельзя — плеер обязан оставаться видимым (ToS YouTube).
  const videoInCorner = isVideoActive && visualizerOn;

  function handleTap(): void {
    if (needsAudioGesture) {
      enableAudio();
      if (!isPlaying) actions.toggle();
      return;
    }
    actions.toggle();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-clip bg-[#09090c] text-white"
      style={accent ? { backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${accent}2e, transparent 70%)` } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <p className="label-wide text-white/45">Экран вечеринки</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setVisualizerOn(!visualizerOn)}
            aria-pressed={visualizerOn}
            aria-label="Визуализация"
            title="Визуализация"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
              visualizerOn ? 'border-white/70 text-white' : 'border-white/15 text-white/50 hover:text-white'
            }`}
          >
            <Icon name={visualizerOn ? 'layers' : 'image'} size={16} />
          </button>
          {visualizerOn && <VisualizerCaptureButton />}
          {isLoggedIn && <JamSavePlaylist
                code={code}
                savableCount={room.queue.filter((i) => i.source === 'VIRE' && i.trackId).length}
                queueLength={room.queue.length}
              />}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/50 transition-colors hover:text-white"
          >
            <Icon name={fullscreen ? 'minimize' : 'maximize'} size={16} />
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="Закрыть экран вечеринки"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/50 transition-colors hover:text-white"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:flex-row lg:gap-6">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-clip rounded-2xl border border-white/10 bg-black/50">
            {isVideoActive && !visualizerOn ? (
              <PartyVideoSlot z={75} className="h-full w-full rounded-none bg-transparent" />
            ) : visualizerOn ? (
              <>
                <Visualizer
                  enabled
                  accentColor={accent}
                  coverUrl={active?.coverUrl ?? null}
                  trackId={active?.trackId ?? null}
                  playing={isPlaying}
                  positionSec={position}
                  durationSec={duration}
                  className="h-full w-full"
                />
                {videoInCorner && (
                  <PartyVideoSlot z={75} className="absolute bottom-3 right-3 h-[200px] w-[356px] max-w-[60%] border border-white/15 shadow-2xl" />
                )}
              </>
            ) : active?.coverUrl ? (
              <Image src={active.coverUrl} alt="" fill sizes="(min-width: 1024px) 70vw, 100vw" className="object-contain" priority />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-white/25">
                <Icon name="music" size={56} />
              </span>
            )}
            {needsAudioGesture && (
              <button
                type="button"
                onClick={handleTap}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-base font-medium"
              >
                Нажмите, чтобы продолжить
              </button>
            )}
          </div>

          {active ? (
            <div className="shrink-0">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
                    <TrackTitleText title={active.title} version={active.version} feat={active.feat ?? undefined} />
                  </p>
                  <p className="mt-1 flex min-w-0 items-center gap-x-2 truncate text-sm text-white/55">
                    <span className="truncate">{active.artistName}</span>
                    <SourceBadge source={active.source} />
                    {addedByName && <span className="hidden truncate sm:inline">· Добавил(а) {addedByName}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTap}
                    aria-label={isPlaying ? 'Пауза' : 'Играть'}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
                  >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.voteSkip(active.id)}
                    disabled={!isHost && iVotedSkip}
                    aria-label="Пропустить"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/70 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Icon name="skip-forward" size={16} />
                    {!isHost && skipVotes && <span className="tabular-nums">{skipVotes.votes}/{skipVotes.needed}</span>}
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-3">
                <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-white/45">{formatDuration(Math.floor(position))}</span>
                <span className="h-1 min-w-0 flex-1 overflow-clip rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-white/70" style={{ width: `${progress * 100}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/45">
                  {duration ? formatDuration(duration) : '--:--'}
                </span>
              </div>
            </div>
          ) : (
            <p className="shrink-0 text-white/50">Очередь пуста — добавьте трек с телефона</p>
          )}
        </div>

        <aside className="flex shrink-0 items-center gap-4 lg:w-64 lg:flex-col lg:items-stretch lg:justify-center lg:gap-6">
          {next.length > 0 && (
            <div className="hidden min-w-0 lg:block">
              <p className="label-mono text-white/35">Дальше</p>
              <ul className="mt-2 space-y-2">
                {next.map((item) => (
                  <li key={item.id} className="flex min-w-0 items-center gap-2.5">
                    <span className="relative h-9 w-9 shrink-0 overflow-clip rounded bg-white/10">
                      {item.coverUrl && <Image src={item.coverUrl} alt="" fill sizes="36px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        <TrackTitleText title={item.title} version={item.version} feat={item.feat ?? undefined} />
                      </span>
                      <span className="block truncate text-xs text-white/40">{item.artistName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG, отдаётся публичным API-роутом, next/image ему не даёт выигрыша */}
            <img src={`/api/v1/jam/${encodeURIComponent(code)}/qr`} alt="QR-код комнаты" width={72} height={72} className="shrink-0 rounded-lg bg-white p-1.5" />
            <div className="min-w-0">
              <p className="text-xs text-white/45">Заходите с телефона</p>
              <p className="truncate font-mono text-sm">{PARTY_PATH}/{code}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
