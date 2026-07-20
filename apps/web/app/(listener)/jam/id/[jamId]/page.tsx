import { notFound, redirect } from 'next/navigation';
import { jamService } from '@/lib/jam';

type Props = { params: Promise<{ jamId: string }> };

export default async function JamByIdPage({ params }: Props) {
  const { jamId } = await params;
  const result = await jamService().resolveId(jamId);
  if (!result.ok) notFound();
  if (result.value.status === 'ENDED') redirect('/');

  redirect(`/jam/${result.value.code}`);
}
