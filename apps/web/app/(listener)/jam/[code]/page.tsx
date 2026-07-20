import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { jamService } from '@/lib/jam';
import { JamRoom } from './jam-room';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const preview = await jamService().preview(code);
  if (!preview.ok) return { title: 'Не найдено' };

  return {
    title: preview.value.session.title ?? 'Джем',
    robots: { index: false, follow: false },
  };
}

export default async function JamPage({ params }: Props) {
  const { code } = await params;
  const [preview, session] = await Promise.all([jamService().preview(code), auth()]);
  if (!preview.ok) notFound();

  return (
    <JamRoom
      code={preview.value.session.code}
      title={preview.value.session.title}
      hostDisplayName={preview.value.hostDisplayName}
      initialEnded={preview.value.session.status === 'ENDED'}
      isLoggedIn={Boolean(session?.user?.id)}
      currentUserName={session?.user?.name ?? null}
    />
  );
}
