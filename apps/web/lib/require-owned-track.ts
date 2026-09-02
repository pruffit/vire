import { NextResponse } from 'next/server';
import { db, DrizzleTrackRepository, DrizzleReleaseRepository } from '@vire/db';
import type { ArtistProfile, Track } from '@vire/core';
import { getCaller, type Caller } from '@/lib/caller';
import { getActiveArtist } from '@/lib/active-artist';
import { isUuid } from '@/lib/upload';

type OwnedTrackResult =
  | { ok: true; caller: Caller; artist: ArtistProfile; track: Track }
  | { ok: false; response: NextResponse };

/**
 * Гейт артист-периметра для операций над своим треком: вызывающий авторизован,
 * у него есть активный артист, трек существует и лежит в релизе этого артиста.
 *
 * Правило одно на пять роутов `dashboard/tracks/[id]/*` — раньше оно было скопировано
 * в каждый, и ошибка в одной копии означала бы дыру в правах. Форма ответа повторяет
 * `require-access.ts`: результат-значение вместо исключения сквозь слой HTTP.
 */
export async function requireOwnedTrack(req: Request, trackId: string): Promise<OwnedTrackResult> {
  const caller = await getCaller();
  if (!caller) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  if (!isUuid(trackId)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid track id' }, { status: 400 }) };
  }

  const artist = await getActiveArtist(caller.id, req);
  if (!artist) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  const track = await new DrizzleTrackRepository(db).findById(trackId);
  if (!track) return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  const release = await new DrizzleReleaseRepository(db).findById(track.releaseId);
  if (!release || release.artistProfileId !== artist.id) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, caller, artist, track };
}
