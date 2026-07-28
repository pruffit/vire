'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@vire/ui';
import type { FeedReason, RankedFeedItem } from '@vire/core';
import { Icon } from '@/components/icon';
import { ExplicitBadge } from '@/components/explicit-badge';
import { CountdownBadge } from '@/components/countdown-badge';
import { UpcomingPresaveButton } from '@/components/upcoming-presave-button';
import { ChatAvatar } from '@/components/chat/chat-avatar';

const INITIAL_VISIBLE = 12;

export function feedReasonLabel(reason: FeedReason): string {
  switch (reason) {
    case 'follow': return 'Вы подписаны';
    case 'taste': return 'Похоже на ваши вкусы';
    case 'fresh': return 'Свежее на площадке';
  }
}

/** Прогрессивный показ (сервер уже отдал до 24) — тут только клиентский слайс, без второго запроса. */
export function FeedList({
  items,
  presavedReleaseIds,
}: {
  items: RankedFeedItem[];
  presavedReleaseIds: string[];
}) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const presaved = new Set(presavedReleaseIds);
  const shown = items.slice(0, visible);
  const remaining = items.length - shown.length;

  return (
    <div className="space-y-4">
      <ul className="flex flex-col">
        {shown.map((item) => (
          <FeedItemRow key={`${item.kind}:${item.id}`} item={item} presaved={presaved.has(item.id)} />
        ))}
      </ul>
      {remaining > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + remaining)}>
            Показать ещё ({remaining})
          </Button>
        </div>
      )}
    </div>
  );
}

function FeedItemRow({ item, presaved }: { item: RankedFeedItem; presaved: boolean }) {
  if (item.kind === 'POST') return <FeedPostRow item={item} />;
  return <FeedReleaseRow item={item} presaved={presaved} />;
}

function FeedReleaseRow({ item, presaved }: { item: RankedFeedItem; presaved: boolean }) {
  const href = `/artists/${item.artistSlug}/releases/${item.id}`;
  const isUpcoming = item.kind === 'UPCOMING';

  return (
    <li className="border-b border-border/60 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <Link href={href} className="group block shrink-0" aria-label={item.title}>
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden bg-muted ring-1 ring-white/5 transition-shadow duration-300 ease-soft group-hover:ring-white/20">
            {item.coverUrl ? (
              <Image
                src={item.coverUrl}
                alt={item.title}
                fill
                sizes="64px"
                quality={60}
                className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]"
              />
            ) : (
              <div className="w-full h-full grid place-items-center opacity-20"><Icon name="music" size={20} /></div>
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1 pt-0.5">
          <Link href={href} className="block min-w-0 min-h-11 sm:min-h-0">
            <p className="text-sm font-medium leading-snug truncate flex items-center gap-1.5">
              <span className="truncate">{item.title}</span>
              {item.hasExplicit && <ExplicitBadge />}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {item.artistName}
              {item.releaseType && <span className="opacity-50 font-mono">{' · '}{item.releaseType}</span>}
            </p>
          </Link>
          <p className="mt-1 text-[11px] text-muted-foreground/60">{feedReasonLabel(item.reason)}</p>

          {isUpcoming && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link href={href} className="transition-opacity hover:opacity-80">
                <CountdownBadge releaseDate={item.occurredAt} title={item.title} />
              </Link>
              <UpcomingPresaveButton releaseId={item.id} initialPresaved={presaved} isAuthed releaseHref={href} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function FeedPostRow({ item }: { item: RankedFeedItem }) {
  const href = `/artists/${item.artistSlug}`;

  return (
    <li className="border-b border-border/60 py-3 last:border-0">
      <Link href={href} className="group flex items-start gap-3 min-h-11">
        <ChatAvatar name={item.artistName} image={item.artistAvatarUrl} size={56} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium leading-snug truncate group-hover:text-foreground transition-colors">
            {item.title}
          </p>
          {item.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.body}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground/60">{feedReasonLabel(item.reason)}</p>
        </div>
      </Link>
    </li>
  );
}
