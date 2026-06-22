import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, AVATAR_POLICY } from '@/lib/image';
import { resolveVideoTitle } from '@/lib/video-meta';
import type { ThemeTokens, ArtistLink, ArtistVideo } from '@vire/core';

const FONT_SANS = ['Inter', 'Montserrat', 'Unbounded', 'Manrope', 'Geologica'];
const FONT_MONO = ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artistRepo = new DrizzleArtistRepository(db);
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
        // label необязателен (распознанные площадки берут название из URL).
        links = parsed
          .filter((l): l is { url: string; label?: unknown } =>
            l !== null && typeof l === 'object' && typeof (l as { url?: unknown }).url === 'string',
          )
          .map((l) => {
            const label = typeof l.label === 'string' ? l.label.trim() : '';
            return label ? { url: l.url, label } : { url: l.url };
          })
          .filter((l) => l.url.trim())
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
        const raw = parsed
          .filter((v): v is { url: string; title?: unknown } =>
            v !== null && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string',
          )
          .map((v) => ({ url: v.url.trim(), title: typeof v.title === 'string' ? v.title.trim() : '' }))
          .filter((v) => v.url)
          .slice(0, 20);
        // Тайтл подтягиваем сами от YouTube/VK, если он пуст (артист его не вводит).
        videos = await Promise.all(
          raw.map(async (v) => (v.title ? v : { url: v.url, title: await resolveVideoTitle(v.url) })),
        );
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
    const buffer = Buffer.from(await avatar.arrayBuffer());
    const v = validateImageUpload(avatar.size, buffer, AVATAR_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    avatarUrl = await uploadToStream(`avatars/${artist.id}.${v.info.ext}`, buffer, v.info.mime);
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
