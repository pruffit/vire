'use client';

import Link from 'next/link';
import type { PlayerTrack } from '@/store/player';
import { TrackTitleText } from '@/components/track-title';

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
  const label = <TrackTitleText title={track.title} version={track.version} feat={track.feat} />;
  if (!track.artistSlug || !track.releaseId) return <span className={className}>{label}</span>;
  return (
    <Link
      href={`/artists/${track.artistSlug}/releases/${track.releaseId}/tracks/${track.id}`}
      onClick={onClick}
      className={`${className ?? ''} hover:underline`}
    >
      {label}
    </Link>
  );
}
