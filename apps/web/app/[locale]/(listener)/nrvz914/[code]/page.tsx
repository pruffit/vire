import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { SearchTrack } from '@vire/core';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { getLikedTracksCached } from '@/lib/listener-data';
import { PartyRoom } from './party-room';

const SUGGESTION_LIMIT = 8;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const [preview, t] = await Promise.all([jamService().preview(code), getTranslations('party')]);
  if (!preview.ok) return { title: t('notFound') };

  return {
    title: preview.value.session.title ?? t('landing.title'),
    robots: { index: false, follow: false },
  };
}

export default async function PartyPage({ params }: Props) {
  const { code } = await params;
  const [preview, session] = await Promise.all([jamService().preview(code), auth()]);
  if (!preview.ok) notFound();

  const userId = session?.user?.id;
  const liked = userId ? await getLikedTracksCached(userId) : [];
  const suggestions: SearchTrack[] = liked.slice(0, SUGGESTION_LIMIT).map((t) => ({
    id: t.id,
    title: t.title,
    releaseId: t.releaseId,
    artistSlug: t.artistSlug,
    artistName: t.artistName,
    coverUrl: t.releaseCoverUrl,
    version: t.version,
    feat: t.feat,
  }));

  return (
    <PartyRoom
      code={preview.value.session.code}
      title={preview.value.session.title}
      hostDisplayName={preview.value.hostDisplayName}
      initialEnded={preview.value.session.status === 'ENDED'}
      isLoggedIn={Boolean(userId)}
      currentUserName={session?.user?.name ?? null}
      suggestions={suggestions}
    />
  );
}
