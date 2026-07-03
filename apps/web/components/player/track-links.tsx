'use client';

import Link from 'next/link';
import type { PlayerTrack } from '@/store/player';

/** Имя артиста → страница артиста, название → страница трека. Если слаг/releaseId
 *  не известны источнику, показываем простой текст без ссылки. */
export function ArtistLink({
  track,
  className,
  onClick,
}: {
  track: PlayerTrack;
  className?: string;
  onClick?: () => void;
}) {
  if (!track.artistSlug) return <span className={className}>{track.artistName}</span>;
  return (
    <Link href={`/artists/${track.artistSlug}`} onClick={onClick} className={`${className ?? ''} hover:underline`}>
      {track.artistName}
    </Link>
  );
}

export function TitleLink({
  track,
  className,
  onClick,
}: {
  track: PlayerTrack;
  className?: string;
  onClick?: () => void;
}) {
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
