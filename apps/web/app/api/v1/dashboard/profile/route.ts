import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import type { ThemeTokens, ArtistLink, ArtistVideo } from '@vire/core';

const AVATAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const FONT_SANS = ['Inter', 'Montserrat', 'Unbounded', 'Manrope', 'Geologica'];
const FONT_MONO = ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artistRepo = new DrizzleArtistRepository(db);
  const artist = await artistRepo.findByUserId(session.user.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const name = formData.get('name');
  const bio = formData.get('bio');
  const avatar = formData.get('avatar');
  const removeAvatar = formData.get('removeAvatar') === '1';

  const linksRaw = formData.get('links');
  let links: ArtistLink[] = artist.links;
  if (typeof linksRaw === 'string') {
    try {
      const parsed: unknown = JSON.parse(linksRaw);
      if (Array.isArray(parsed)) {
        links = parsed
          .filter((l): l is ArtistLink =>
            l !== null &&
            typeof l === 'object' &&
            typeof (l as ArtistLink).label === 'string' &&
            typeof (l as ArtistLink).url === 'string',
          )
          .slice(0, 10);
      }
    } catch { /* keep existing links */ }
  }

  const videosRaw = formData.get('videos');
  let videos: ArtistVideo[] = artist.videos;
  if (typeof videosRaw === 'string') {
    try {
      const parsed: unknown = JSON.parse(videosRaw);
      if (Array.isArray(parsed)) {
        videos = parsed
          .filter((v): v is ArtistVideo =>
            v !== null &&
            typeof v === 'object' &&
            typeof (v as ArtistVideo).url === 'string' &&
            typeof (v as ArtistVideo).title === 'string',
          )
          .slice(0, 20);
      }
    } catch { /* keep existing */ }
  }

  const bg = formData.get('bg');
  const text = formData.get('text');
  const accent = formData.get('accent');
  const grain = formData.get('grain') === '1';
  const fontSans = formData.get('fontSans');
  const fontMono = formData.get('fontMono');

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Avatar upload
  let avatarUrl = artist.avatarUrl;
  if (removeAvatar) {
    avatarUrl = null;
  } else if (avatar instanceof File && avatar.size > 0) {
    const ext = AVATAR_MIME[avatar.type];
    if (!ext) {
      return NextResponse.json({ error: 'Avatar must be JPEG, PNG or WebP' }, { status: 400 });
    }
    const buffer = Buffer.from(await avatar.arrayBuffer());
    avatarUrl = await uploadToStream(`avatars/${artist.id}.${ext}`, buffer, avatar.type);
  }

  const themeTokens: ThemeTokens = {
    bg: isHex(bg) ? bg : artist.themeTokens.bg,
    text: isHex(text) ? text : artist.themeTokens.text,
    accent: isHex(accent) ? accent : artist.themeTokens.accent,
    grain,
    fontSans: typeof fontSans === 'string' && FONT_SANS.includes(fontSans) ? fontSans : artist.themeTokens.fontSans,
    fontMono: typeof fontMono === 'string' && FONT_MONO.includes(fontMono) ? fontMono : artist.themeTokens.fontMono,
  };

  await artistRepo.update(artist.id, {
    name: name.trim(),
    bio: typeof bio === 'string' && bio.trim() ? bio.trim() : null,
    avatarUrl,
    themeTokens,
    links,
    videos,
  });

  return NextResponse.json({ ok: true });
}

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}
