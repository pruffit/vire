import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository } from '@vire/db';
import { ArtistService } from '@vire/core';
import { fileStorage } from '@/lib/file-storage';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, AVATAR_POLICY, HEADER_POLICY } from '@/lib/image';
import { videoTitleResolver } from '@/lib/video-meta';
import { SANS_FONTS, MONO_FONTS } from '@/lib/font-catalog';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // remove-флаг выигрывает у приложенного файла (как до рефакторинга) — файл не валидируем
  const removeAvatar = formData.get('removeAvatar') === '1';
  const avatar = formData.get('avatar');
  let avatarInput: { buffer: Buffer; ext: string; mime: string } | null = null;
  if (!removeAvatar && avatar instanceof File && avatar.size > 0) {
    const buffer = Buffer.from(await avatar.arrayBuffer());
    const v = validateImageUpload(avatar.size, buffer, AVATAR_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    avatarInput = { buffer, ext: v.info.ext, mime: v.info.mime };
  }

  const removeHeader = formData.get('removeHeader') === '1';
  const header = formData.get('header');
  let headerInput: { buffer: Buffer; ext: string; mime: string } | null = null;
  if (!removeHeader && header instanceof File && header.size > 0) {
    const buffer = Buffer.from(await header.arrayBuffer());
    const v = validateImageUpload(header.size, buffer, HEADER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    headerInput = { buffer, ext: v.info.ext, mime: v.info.mime };
  }

  const service = new ArtistService(new DrizzleArtistRepository(db), {
    now: () => Date.now(),
    fonts: { sans: SANS_FONTS, mono: MONO_FONTS },
    videoTitleResolver,
    imageStorage: fileStorage,
  });

  const result = await service.updateProfile(artist, {
    name: formData.get('name'),
    bio: formData.get('bio'),
    avatar: avatarInput,
    removeAvatar,
    header: headerInput,
    removeHeader,
    linksRaw: formData.get('links'),
    videosRaw: formData.get('videos'),
    bg: formData.get('bg'),
    text: formData.get('text'),
    accent: formData.get('accent'),
    grain: formData.get('grain') === '1',
    fontSans: formData.get('fontSans'),
    fontMono: formData.get('fontMono'),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
