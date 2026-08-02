'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useJamSession } from '@/components/jam/jam-session-provider';
import { setPartyVideoContainer } from '@/lib/jam/sources/video-container';
import { useJamStore } from '@/store/jam';
import { Icon } from '@/components/icon';
import { TrackTitleText } from '@/components/track-title';
import { SourceBadge } from '@/components/jam/source-badge';
import { PARTY_PATH } from '@/lib/party';

const NEXT_COUNT = 5;

interface Props {
  code: string;
  onExit: () => void;
}

/**
 * Устройство-колонка: полноэкранная витрина, не пульт. Видео-поверхность держит контейнер
 * постоянно в DOM (YouTube IFrame API привязывается к нему при первом YouTube-треке в очереди) —
 * без него источник YOUTUBE недоступен нигде (см. lib/jam/sources/youtube-source.ts).
 */
export function PartyScreen({ code, onExit }: Props) {
  const session = useJamSession();
  const videoRef = useRef<HTMLDivElement>(null);
  const audioEnabled = useJamStore((s) => s.audioEnabled);
  const enableAudio = useJamStore((s) => s.enableAudio);

  useEffect(() => {
    setPartyVideoContainer(videoRef.current);
    return () => setPartyVideoContainer(null);
  }, []);

  if (!session) return null;
  const { room, activeItemId, isPlaying, isHost, votedSkipItemId, actions } = session;
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

  function handleTap(): void {
    if (needsAudioGesture) {
      enableAudio();
      if (!isPlaying) actions.toggle();
      return;
    }
    actions.toggle();
  }

  return (
    <div className="flex min-h-full flex-col px-6 py-8 sm:px-10 sm:py-10">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Экран вечеринки</p>
        <button
          type="button"
          onClick={onExit}
          aria-label="Выйти из экрана вечеринки"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="minimize-2" size={16} />
        </button>
      </div>

      <div className="mx-auto mt-6 w-full max-w-3xl flex-1 space-y-8">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-muted">
          <div ref={videoRef} className={isVideoActive ? 'absolute inset-0' : 'absolute inset-0 opacity-0'} />
          {!isVideoActive && active?.coverUrl && (
            <Image src={active.coverUrl} alt="" fill sizes="480px" className="object-cover" priority />
          )}
          {needsAudioGesture && (
            <button
              type="button"
              onClick={handleTap}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white"
            >
              Нажмите, чтобы продолжить
            </button>
          )}
        </div>

        {active ? (
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <TrackTitleText title={active.title} version={active.version} feat={active.feat ?? undefined} />
            </p>
            <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>{active.artistName}</span>
              <SourceBadge source={active.source} />
              {addedByName && <span>· Добавил(а) {addedByName}</span>}
            </p>
            <button
              type="button"
              onClick={() => actions.voteSkip(active.id)}
              disabled={!isHost && iVotedSkip}
              className="mx-auto mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Icon name="skip-forward" size={14} /> Пропустить
              {!isHost && skipVotes && <span className="tabular-nums">· {skipVotes.votes}/{skipVotes.needed}</span>}
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Очередь пуста</p>
        )}

        {next.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Дальше</p>
            {next.map((item) => (
              <p key={item.id} className="flex items-center justify-center gap-2 truncate text-sm text-muted-foreground">
                <TrackTitleText title={item.title} version={item.version} feat={item.feat ?? undefined} />
                <span className="shrink-0">— {item.artistName}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto flex flex-col items-center gap-2 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG, отдаётся публичным API-роутом, next/image ему не даёт выигрыша */}
        <img src={`/api/v1/jam/${encodeURIComponent(code)}/qr`} alt="QR-код комнаты" width={112} height={112} className="rounded-lg bg-white p-2" />
        <p className="font-mono text-xs text-muted-foreground">{PARTY_PATH}/{code}</p>
      </div>
    </div>
  );
}
