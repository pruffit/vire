'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Sheet } from '@/components/sheet';
import { Icon } from '@/components/icon';
import { useArtistSwitcher, type SwitcherArtist } from './artist-switcher';

interface ActiveArtistInfo {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

function ArtistAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    <Image
      src={avatarUrl}
      alt={name}
      width={28}
      height={28}
      className="h-7 w-7 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground/10 font-mono text-xs">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/** Мобильный топ-бар дашборда: аватар+имя артиста, при нескольких артистах открывает Sheet со списком. */
export function MobileArtistSwitcher({
  artist,
  allArtists,
}: {
  artist: ActiveArtistInfo;
  allArtists: SwitcherArtist[];
}) {
  const [open, setOpen] = useState(false);

  if (allArtists.length <= 1) {
    return (
      <a
        href={`/artists/${artist.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2 pointer-coarse:min-h-11"
      >
        <ArtistAvatar name={artist.name} avatarUrl={artist.avatarUrl} />
        <span className="min-w-0 truncate text-sm font-medium">{artist.name}</span>
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Сменить артиста (сейчас ${artist.name})`}
        className="flex min-w-0 items-center gap-2 pointer-coarse:min-h-11"
      >
        <ArtistAvatar name={artist.name} avatarUrl={artist.avatarUrl} />
        <span className="min-w-0 truncate text-sm font-medium">{artist.name}</span>
        <Icon name="chevron-down" size={12} className="shrink-0 text-foreground/40" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} anchor="bottom">
        <ArtistSheetList artist={artist} allArtists={allArtists} onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function ArtistSheetList({
  artist,
  allArtists,
  onClose,
}: {
  artist: ActiveArtistInfo;
  allArtists: SwitcherArtist[];
  onClose: () => void;
}) {
  const { value, isPending, select } = useArtistSwitcher(artist.id);

  return (
    <div className="px-4 pb-4 pt-1">
      <p className="px-2 pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">Артист</p>
      <div className="space-y-1">
        {allArtists.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={isPending}
            aria-current={a.id === value ? 'true' : undefined}
            onClick={() => { select(a.id); onClose(); }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-foreground/5 disabled:opacity-60 min-h-11"
          >
            <span className="min-w-0 flex-1 truncate">
              {a.name} <span className="text-foreground/40">@{a.slug}</span>
            </span>
            {a.id === value && <Icon name="check" size={14} className="shrink-0 text-primary" />}
          </button>
        ))}
      </div>
      <a
        href={`/artists/${artist.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="mt-3 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground/60 hover:text-foreground"
      >
        Открыть страницу артиста <Icon name="external-link" size={13} />
      </a>
    </div>
  );
}
