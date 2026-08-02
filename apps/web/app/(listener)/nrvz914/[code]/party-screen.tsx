'use client';
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
import { ActionSelect } from '@/components/action-select';
import { Visualizer, VISUALIZER_PRESETS, useVisualizerPreset } from '@/components/visualizer';
import { PARTY_PATH } from '@/lib/party';

const NEXT_COUNT = 5;

interface Props {
  code: string;
  onExit: () => void;
}

/**
 * Устройство-колонка: полноэкранная витрина, не пульт. Видео встраиваемых источников рисует
 * `PartyVideoDock` из app-shell — здесь только слот под него: iframe нельзя переносить по DOM,
 * а размонтирование поверхности убивает звук.
 */
export function PartyScreen({ code, onExit }: Props) {
  const session = useJamSession();
  const audioEnabled = useJamStore((s) => s.audioEnabled);
  const enableAudio = useJamStore((s) => s.enableAudio);
  const [preset, setPreset] = useVisualizerPreset();
  const isPlaying = session?.isPlaying ?? false;
  const position = useJamPosition(isPlaying);
  useWakeLock(true);

  if (!session) return null;
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
  const showVisualizer = preset !== 'off' && !isVideoActive;

  function handleTap(): void {
    if (needsAudioGesture) {
      enableAudio();
      if (!isPlaying) actions.toggle();
      return;
    }
    actions.toggle();
  }

  return (
    <div
      className="relative flex min-h-full flex-col overflow-clip bg-[#09090c] text-white"
      style={accent ? { backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${accent}33, transparent 70%)` } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 sm:px-8 sm:pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/50">Экран вечеринки</p>
        <div className="flex items-center gap-2">
          <ActionSelect
            options={[...VISUALIZER_PRESETS]}
            value={preset}
            onChange={(v) => setPreset(v as typeof preset)}
            ariaLabel="Фон экрана"
          />
          <button
            type="button"
            onClick={onExit}
            aria-label="Выйти из экрана вечеринки"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:text-white"
          >
            <Icon name="minimize-2" size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 px-4 py-5 sm:px-8 sm:py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="relative aspect-video w-full overflow-clip rounded-2xl border border-white/10 bg-black/50">
            {isVideoActive ? (
              <PartyVideoSlot className="h-full w-full rounded-none" />
            ) : showVisualizer ? (
              <Visualizer
                preset={preset}
                accentColor={accent}
                trackId={active?.trackId ?? null}
                playing={isPlaying}
                positionSec={position}
                durationSec={duration}
                className="h-full w-full"
              />
            ) : active?.coverUrl ? (
              <Image src={active.coverUrl} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-contain" priority />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-white/30">
                <Icon name="music" size={48} />
              </span>
            )}
            {needsAudioGesture && (
              <button
                type="button"
                onClick={handleTap}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-base font-medium backdrop-blur-[2px]"
              >
                Нажмите, чтобы продолжить
              </button>
            )}
          </div>

          {active ? (
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                <TrackTitleText title={active.title} version={active.version} feat={active.feat ?? undefined} />
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/60 sm:text-base">
                <span className="truncate">{active.artistName}</span>
                <SourceBadge source={active.source} />
                {addedByName && <span className="truncate">· Добавил(а) {addedByName}</span>}
              </p>

              <div className="mt-4 flex items-center gap-3">
                <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-white/50">{formatDuration(Math.floor(position))}</span>
                <span className="h-1 min-w-0 flex-1 overflow-clip rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-white/70" style={{ width: `${progress * 100}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-white/50">
                  {duration ? formatDuration(duration) : '--:--'}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTap}
                  aria-label={isPlaying ? 'Пауза' : 'Играть'}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => actions.voteSkip(active.id)}
                  disabled={!isHost && iVotedSkip}
                  className="inline-flex h-14 items-center gap-2 rounded-full border border-white/15 px-5 text-sm text-white/70 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40"
                >
                  <Icon name="skip-forward" size={16} /> Пропустить
                  {!isHost && skipVotes && <span className="tabular-nums">· {skipVotes.votes}/{skipVotes.needed}</span>}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-white/50">Очередь пуста — добавьте трек с телефона</p>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-5 lg:self-center">
          {next.length > 0 && (
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">Дальше</p>
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
                      <span className="block truncate text-xs text-white/45">{item.artistName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG, отдаётся публичным API-роутом, next/image ему не даёт выигрыша */}
            <img src={`/api/v1/jam/${encodeURIComponent(code)}/qr`} alt="QR-код комнаты" width={88} height={88} className="shrink-0 rounded-lg bg-white p-1.5" />
            <div className="min-w-0">
              <p className="text-xs text-white/50">Заходите с телефона</p>
              <p className="truncate font-mono text-sm">{PARTY_PATH}/{code}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
