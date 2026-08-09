'use client';

import { forwardRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { TrackTitleText } from '@/components/track-title';

export interface TrackRowTrack {
  id: string;
  title: string;
  artistName: string;
  isExplicit?: boolean;
  coverUrl: string | null;
  version?: string | null;
  feat?: string[];
}

export interface TrackRowProps {
  track: TrackRowTrack;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  /** Перед обложкой — номер в трек-листе, drag-хендл и т.п. */
  leading?: ReactNode;
  /** После инфо-блока — лайк, длительность, скачать, удалить. */
  trailing?: ReactNode;
  /** Заменяет строку с именем артиста (например, ссылкой на профиль). */
  subtitle?: ReactNode;
  /** Внутри обложки поверх оверлея — доп. индикатор (напр. анимация эквалайзера). */
  coverExtra?: ReactNode;
  /** Если задан — тайтл становится ссылкой (переход), а не триггером воспроизведения. */
  titleHref?: string;
  /** Клик по всей строке запускает воспроизведение; иначе играть можно только через обложку. */
  clickableRow?: boolean;
  /** Оверлей обложки остаётся видимым, пока трек играет (не только по hover). */
  keepOverlayWhilePlaying?: boolean;
  /** 'roomy' — крупнее обложка и минимальная высота строки на мобилке (тач-таргеты в джеме). */
  size?: 'default' | 'roomy';
  /** Рендерит обложку без /_next/image-оптимизации — запрос идёт ровно по track.coverUrl
   *  (нужно для офлайн-экрана: сегменты закэшированы по сырому S3-URL). */
  unoptimizedCover?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const TrackRow = forwardRef<HTMLDivElement, TrackRowProps>(function TrackRow(
  {
    track,
    isActive,
    isPlaying,
    onPlay,
    leading,
    trailing,
    subtitle,
    coverExtra,
    titleHref,
    clickableRow = false,
    keepOverlayWhilePlaying = false,
    size = 'default',
    unoptimizedCover = false,
    className = '',
    style,
  },
  ref,
) {
  const t = useTranslations('track');

  function handleRowKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay();
    }
  }

  const playAriaLabel = isActive && isPlaying ? t('pause') : t('playAria', { title: track.title });
  const overlayVisibility = keepOverlayWhilePlaying && isActive
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100';

  const coverClassName = size === 'roomy'
    ? 'relative w-11 h-11 sm:w-9 sm:h-9 shrink-0 rounded-md sm:rounded-sm overflow-hidden bg-muted'
    : 'relative w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted';
  const coverContent = (
    <>
      {track.coverUrl ? (
        <Image src={track.coverUrl} alt={track.title} fill quality={60} sizes="36px" unoptimized={unoptimizedCover} className="object-cover" />
      ) : (
        <div className="w-full h-full" />
      )}
      <span className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${overlayVisibility}`}>
        {isActive && isPlaying ? <PauseIcon size={12} className="text-white" /> : <PlayIcon size={12} className="text-white" />}
      </span>
      {coverExtra}
    </>
  );

  const titleClassName = `text-sm font-medium truncate flex items-center gap-1.5${titleHref ? ' hover:underline' : ''}`;
  const titleStyle = isActive ? { color: 'var(--primary)' } : undefined;
  const titleContent = (
    <>
      <span className="truncate">
        <TrackTitleText title={track.title} version={track.version} feat={track.feat} />
      </span>
      {track.isExplicit && <ExplicitBadge />}
    </>
  );

  return (
    <div
      ref={ref}
      style={style}
      role={clickableRow ? 'button' : undefined}
      tabIndex={clickableRow ? 0 : undefined}
      aria-label={clickableRow ? playAriaLabel : undefined}
      onClick={clickableRow ? onPlay : undefined}
      onKeyDown={clickableRow ? handleRowKeyDown : undefined}
      className={`group flex items-center gap-3 py-2.5 -mx-3 px-3 rounded-sm hover:bg-accent/5 transition-colors ${size === 'roomy' ? 'min-h-14 sm:min-h-0' : ''} ${clickableRow ? 'cursor-pointer select-none' : ''} ${className}`}
    >
      {leading}
      {clickableRow ? (
        <div className={coverClassName}>{coverContent}</div>
      ) : (
        <button type="button" onClick={onPlay} aria-label={playAriaLabel} className={coverClassName}>
          {coverContent}
        </button>
      )}
      <div className="flex-1 min-w-0">
        {titleHref ? (
          <Link href={titleHref} className={titleClassName} style={titleStyle}>
            {titleContent}
          </Link>
        ) : (
          <p className={titleClassName} style={titleStyle}>{titleContent}</p>
        )}
        <p className="text-xs text-muted-foreground truncate">{subtitle ?? track.artistName}</p>
      </div>
      {trailing}
    </div>
  );
});
