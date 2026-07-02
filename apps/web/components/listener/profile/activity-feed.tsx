import Link from 'next/link';
import { type ActivityItem, activityKey } from '@/lib/activity';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { Icon, type IconName } from '@/components/icon';

const ACTIVITY_ICON: Record<ActivityItem['kind'], IconName> = {
  like: 'heart',
  follow: 'user-plus',
  playlist: 'list',
};

function formatActivityDate(at: Date): string {
  return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="animate-fade-up">
      <Section title="Недавняя активность">
        {items.length === 0 ? (
          <EmptyState title="Здесь появится история твоих лайков и подписок." />
        ) : (
          <div className="flex flex-col">
            {items.map((item) => (
              <div
                key={activityKey(item)}
                className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0"
              >
                <span className="w-8 h-8 rounded-full bg-secondary grid place-items-center shrink-0">
                  <Icon name={ACTIVITY_ICON[item.kind]} size={14} className="text-muted-foreground" />
                </span>
                <p className="flex-1 min-w-0 text-sm truncate">
                  {item.kind === 'like' && (
                    <Link href={`/artists/${item.artistSlug}/releases/${item.releaseId}`} className="hover:underline">
                      <span className="font-medium">{item.trackTitle}</span>
                      <span className="text-muted-foreground"> — {item.artistName}</span>
                    </Link>
                  )}
                  {item.kind === 'follow' && (
                    <>
                      Подписка на{' '}
                      <Link href={`/artists/${item.artistSlug}`} className="font-medium hover:underline">
                        {item.artistName}
                      </Link>
                    </>
                  )}
                  {item.kind === 'playlist' && (
                    <>
                      Создан плейлист{' '}
                      <Link href={`/playlists/${item.playlistId}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                    </>
                  )}
                </p>
                <time className="text-xs font-mono text-muted-foreground/60 shrink-0">
                  {formatActivityDate(item.at)}
                </time>
              </div>
            ))}
          </div>
        )}
      </Section>
    </section>
  );
}
