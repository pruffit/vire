import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { jamService } from '@/lib/jam';
import { PARTY_PATH } from '@/lib/party';

type Props = { params: Promise<{ jamId: string }> };

export default async function JamByIdPage({ params }: Props) {
  const { jamId } = await params;
  const [result, locale] = await Promise.all([jamService().resolveId(jamId), getLocale()]);
  if (!result.ok) notFound();
  if (result.value.status === 'ENDED') return redirect({ href: '/', locale });

  const base = result.value.kind === 'PARTY' ? PARTY_PATH : '/jam';
  redirect({ href: `${base}/${result.value.code}`, locale });
}
