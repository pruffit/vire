import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { type FriendActivityItem, friendActivityKey } from '@/lib/activity';

function formatActivityDate(at: Date): string {
  return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function ActorAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return <Image src={image} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
      {(name ?? '?')[0]?.toUpperCase()}
    </span>
  );
}

export function FriendsActivityFeed({ items }: { items: FriendActivityItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <div key={friendActivityKey(item)} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
          <ActorAvatar name={item.actor.name} image={item.actor.image} />
          <p className="min-w-0 flex-1 truncate text-sm">
            <Link href={`/u/${item.actor.id}`} className="font-medium hover:underline">
              {item.actor.name ?? 'Слушатель'}
            </Link>
            {item.kind === 'like' && (
              <>
                <span className="text-muted-foreground"> · лайк </span>
                <Link href={`/artists/${item.artistSlug}/releases/${item.releaseId}`} className="hover:underline">
                  {item.trackTitle}
                  <span className="text-muted-foreground"> — {item.artistName}</span>
                </Link>
              </>
            )}
            {item.kind === 'follow' && (
              <>
                <span className="text-muted-foreground"> · подписка на </span>
                <Link href={`/artists/${item.artistSlug}`} className="hover:underline">{item.artistName}</Link>
              </>
            )}
            {item.kind === 'playlist' && (
              <>
                <span className="text-muted-foreground"> · плейлист </span>
                <Link href={`/playlists/${item.playlistId}`} className="hover:underline">{item.title}</Link>
              </>
            )}
          </p>
          <time className="shrink-0 font-mono text-xs text-muted-foreground/60">{formatActivityDate(item.at)}</time>
        </div>
      ))}
    </div>
  );
}
