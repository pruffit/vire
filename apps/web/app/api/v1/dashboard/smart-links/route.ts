import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, createSmartLink, smartLinkSlugTaken } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';
import { parseSmartLinkLinks, normalizeSlug, isValidSlug } from '@/lib/smart-link';

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

  const title = formData.get('title');
  const slugRaw = formData.get('slug');
  const subtitle = formData.get('subtitle');
  const releaseDateRaw = formData.get('releaseDate');
  const cover = formData.get('cover');

  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Нужно название' }, { status: 400 });
  }

  const slug = normalizeSlug(typeof slugRaw === 'string' && slugRaw ? slugRaw : title);
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Некорректный адрес (slug)' }, { status: 400 });
  }
  if (await smartLinkSlugTaken(artist.id, slug)) {
    return NextResponse.json({ error: 'Такой адрес уже занят' }, { status: 409 });
  }

  const links = parseSmartLinkLinks(formData.get('links'));
  const releaseDate =
    typeof releaseDateRaw === 'string' && releaseDateRaw ? new Date(releaseDateRaw) : null;
  const isPublished = formData.get('isPublished') === '1';

  let coverUrl: string | null = null;
  if (cover instanceof File && cover.size > 0) {
    const buffer = Buffer.from(await cover.arrayBuffer());
    const v = validateImageUpload(cover.size, buffer, COVER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    coverUrl = await uploadToStream(`covers/smartlinks/${crypto.randomUUID()}.${v.info.ext}`, buffer, v.info.mime);
  }

  const id = await createSmartLink(artist.id, {
    slug,
    title: title.trim(),
    subtitle: typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : null,
    coverUrl,
    releaseDate,
    links,
    isPublished,
  });

  return NextResponse.json({ id, slug }, { status: 201 });
}
