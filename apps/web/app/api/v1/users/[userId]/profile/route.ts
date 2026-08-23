import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { loadFriendProfile } from '@/lib/friend-profile';
import { uuidSchema, type UserProfileResponse } from '@vire/api-contracts';

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = uuidSchema.safeParse((await params).userId);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  const profile = await loadFriendProfile(caller.id, parsed.data);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body: UserProfileResponse = {
    id: profile.id,
    name: profile.name,
    image: profile.image,
    status: profile.status,
    blocked: profile.blocked,
    iBlockedThem: profile.iBlockedThem,
    likesVisible: profile.likesVisible,
    likes: profile.likes.map((t) => ({
      id: t.id,
      title: t.title,
      version: t.version,
      durationSec: t.durationSec,
      releaseId: t.releaseId,
      releaseCoverUrl: t.releaseCoverUrl,
      artistName: t.artistName,
      artistSlug: t.artistSlug,
      isExplicit: t.isExplicit,
      likedAt: t.likedAt.toISOString(),
      feat: t.feat,
    })),
    playlists: profile.playlists.map((p) => ({
      id: p.id,
      title: p.title,
      visibility: p.visibility,
      trackCount: p.trackCount,
      coverUrl: p.coverUrl,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
  return NextResponse.json(body);
}
