import Link from 'next/link';
import type { Metadata } from 'next';
import { searchAll } from '@vire/db';
import type { SearchArtist, SearchRelease, SearchTrack } from '@vire/db';
import { GlobalSearch } from '@/components/global-search';

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `«${q}» — Поиск · Vire` : 'Поиск — Vire' };
}

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const results = query.length >= 2 ? await searchAll(query, 20) : null;

  const total = results
    ? results.artists.length + results.releases.length + results.tracks.length
    : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <GlobalSearch variant="page" defaultValue={query} autoFocus={!query} />

      {!query && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          Начни вводить — покажем артистов, релизы и треки.
        </p>
      )}

      {query && query.length < 2 && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          Введи хотя бы 2 символа.
        </p>
      )}

      {results && total === 0 && (
        <p className="text-sm text-muted-foreground text-center pt-16">
          По запросу <span className="text-foreground">«{query}»</span> ничего не найдено.
        </p>
      )}

      {results && total > 0 && (
        <div className="space-y-10">
          {results.artists.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label="Артисты" count={results.artists.length} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {results.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
              </div>
            </section>
          )}

          {results.releases.length > 0 && (
            <section className="space-y-2">
              <SectionHeader label="Релизы" count={results.releases.length} />
              <div className="flex flex-col divide-y divide-border">
                {results.releases.map((r) => <ReleaseRow key={r.id} release={r} />)}
              </div>
            </section>
          )}

          {results.tracks.length > 0 && (
            <section className="space-y-2">
              <SectionHeader label="Треки" count={results.tracks.length} />
              <div className="flex flex-col divide-y divide-border">
                {results.tracks.map((t) => <TrackRow key={t.id} track={t} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h2>
      <span className="text-xs font-mono text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

function ArtistCard({ artist }: { artist: SearchArtist }) {
  return (
    <Link
      href={`/artists/${artist.slug}`}
      className="group flex items-center gap-3 p-3 rounded-md bg-card border border-border/40 hover:bg-accent/5 transition-colors"
    >
      {artist.avatarUrl ? (
        <img src={artist.avatarUrl} alt={artist.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
          {artist.name[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
          {artist.name}
          {artist.verified && <span className="ml-1 text-[10px] text-muted-foreground">✓</span>}
        </p>
      </div>
    </Link>
  );
}

function ReleaseRow({ release }: { release: SearchRelease }) {
  return (
    <Link
      href={`/artists/${release.artistSlug}/releases/${release.id}`}
      className="group flex items-center gap-3 py-3 hover:bg-accent/5 -mx-2 px-2 rounded-sm transition-colors"
    >
      <div className="w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted">
        {release.coverUrl
          ? <img src={release.coverUrl} alt={release.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-white/5" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{release.title}</p>
        <p className="text-xs text-muted-foreground truncate">{release.artistName}</p>
      </div>
      <span className="text-xs font-mono text-muted-foreground shrink-0">{release.type}</span>
    </Link>
  );
}

function TrackRow({ track }: { track: SearchTrack }) {
  return (
    <Link
      href={`/artists/${track.artistSlug}/releases/${track.releaseId}/tracks/${track.id}`}
      className="group flex items-center gap-3 py-3 hover:bg-accent/5 -mx-2 px-2 rounded-sm transition-colors"
    >
      <div className="w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted">
        {track.coverUrl
          ? <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-white/5" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>
    </Link>
  );
}
