import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSmartLinkById, updateSmartLink, deleteSmartLink, smartLinkSlugTaken, getReleaseOptions } from '@vire/db';
import { uploadToStream } from '@/lib/s3';
import { getActiveArtist } from '@/lib/active-artist';
import { validateImageUpload, COVER_POLICY } from '@/lib/image';
import { parseSmartLinkLinks, normalizeSlug, isValidSlug } from '@/lib/smart-link';
import type { SmartLinkInput } from '@vire/db';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const existing = await getSmartLinkById(id);
  if (!existing || existing.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const patch: Partial<SmartLinkInput> = {};

  const title = formData.get('title');
  if (typeof title === 'string') {
    if (!title.trim()) return NextResponse.json({ error: 'Нужно название' }, { status: 400 });
    patch.title = title.trim();
  }

  const slugRaw = formData.get('slug');
  if (typeof slugRaw === 'string') {
    const slug = normalizeSlug(slugRaw);
    if (!isValidSlug(slug)) return NextResponse.json({ error: 'Некорректный адрес (slug)' }, { status: 400 });
    if (slug !== existing.slug && (await smartLinkSlugTaken(artist.id, slug, id))) {
      return NextResponse.json({ error: 'Такой адрес уже занят' }, { status: 409 });
    }
    patch.slug = slug;
  }

  const subtitle = formData.get('subtitle');
  if (typeof subtitle === 'string') patch.subtitle = subtitle.trim() || null;

  const releaseDateRaw = formData.get('releaseDate');
  if (typeof releaseDateRaw === 'string') patch.releaseDate = releaseDateRaw ? new Date(releaseDateRaw) : null;

  // Привязка к релизу: пусто — отвязать; иначе только собственный релиз артиста.
  const releaseIdRaw = formData.get('releaseId');
  if (typeof releaseIdRaw === 'string') {
    if (!releaseIdRaw.trim()) {
      patch.releaseId = null;
    } else {
      const owned = await getReleaseOptions(artist.id);
      if (!owned.some((r) => r.id === releaseIdRaw)) {
        return NextResponse.json({ error: 'Релиз не найден' }, { status: 400 });
      }
      patch.releaseId = releaseIdRaw;
    }
  }

  if (formData.get('links') !== null) patch.links = parseSmartLinkLinks(formData.get('links'));

  const publishedRaw = formData.get('isPublished');
  if (typeof publishedRaw === 'string') patch.isPublished = publishedRaw === '1';

  const cover = formData.get('cover');
  if (cover instanceof File && cover.size > 0) {
    const buffer = Buffer.from(await cover.arrayBuffer());
    const v = validateImageUpload(cover.size, buffer, COVER_POLICY);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    patch.coverUrl = await uploadToStream(`covers/smartlinks/${crypto.randomUUID()}.${v.info.ext}`, buffer, v.info.mime);
  } else if (formData.get('removeCover') === '1') {
    patch.coverUrl = null;
  }

  await updateSmartLink(id, artist.id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const ok = await deleteSmartLink(id, artist.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
