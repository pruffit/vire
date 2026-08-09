'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { FriendshipStatus } from '@vire/core';
import { Icon } from '@/components/icon';
import { FriendButton } from '@/components/friends/friend-button';

interface Hit { id: string; name: string; image: string | null; status: FriendshipStatus }

const MIN_QUERY_LENGTH = 2;

export function UserSearch() {
  const t = useTranslations('social.userSearch');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback((q: string, signal: AbortSignal) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/v1/friends/search?q=${encodeURIComponent(q)}`, { signal })
      .then((r) => r.json())
      .then((data: { results: Hit[] }) => setResults(data.results ?? []))
      .catch((e) => { if (e?.name !== 'AbortError') setResults([]); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => fetchResults(trimmed, controller.signal), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, fetchResults]);

  const showPanel = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <section className="space-y-3">
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {showPanel && (
        <div className="flex flex-col gap-2">
          {loading && results.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">{t('searching')}</p>
          ) : results.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            results.map((hit) => (
              <div key={hit.id} className="flex items-center gap-3 rounded-md border border-border/40 bg-card p-3">
                <Link href={`/u/${hit.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  {hit.image ? (
                    <Image src={hit.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">
                      {hit.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{hit.name}</p>
                </Link>
                <FriendButton targetUserId={hit.id} initialStatus={hit.status} />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
