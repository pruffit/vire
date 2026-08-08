import type { ReactNode } from 'react';
import { assertArtistExists } from './artist-guard';

type Props = { children: ReactNode; params: Promise<{ slug: string }> };

export default async function ArtistLayout({ children, params }: Props) {
  const { slug } = await params;
  await assertArtistExists(slug);
  return <>{children}</>;
}
