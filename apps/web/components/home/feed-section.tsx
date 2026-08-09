import { getTranslations } from 'next-intl/server';
import { getPresaveStates } from '@vire/db';
import { buildFeed } from '@/lib/feed';
import { Section } from '@/components/listener/section';
import { FeedList } from './feed-list';

export async function FeedSection({ userId }: { userId: string }) {
  const t = await getTranslations('home.sections');
  const feed = await buildFeed(userId).catch(() => []);
  if (feed.length === 0) return null;

  const upcomingIds = feed.filter((item) => item.kind === 'UPCOMING').map((item) => item.id);
  const presavedIds = upcomingIds.length > 0
    ? await getPresaveStates(userId, upcomingIds).catch(() => new Set<string>())
    : new Set<string>();

  return (
    <Section title={t('yourFeed')} count={feed.length}>
      <FeedList items={feed} presavedReleaseIds={[...presavedIds]} />
    </Section>
  );
}
