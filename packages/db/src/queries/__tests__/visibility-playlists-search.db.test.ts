import { describe, it, expect, beforeEach } from 'vitest';
import { getPublicPlaylistsByOwner, getPlaylistWithTracks } from '../playlists';
import { searchAll } from '../search';
import { listSitemapPlaylists, countSitemapPlaylists } from '../sitemap';
import {
  resetDb,
  makeUser,
  makeArtist,
  makeRelease,
  makeTrack,
  makeVisibleArtist,
  makePlaylist,
  addPlaylistTrack,
} from './db-harness';

beforeEach(resetDb);

describe('гейт приватности плейлистов', () => {
  it('чужому видны только PUBLIC-плейлисты вида USER', async () => {
    const owner = await makeUser();
    const publicPl = await makePlaylist(owner.id, { visibility: 'PUBLIC', title: 'Публичный' });
    const privatePl = await makePlaylist(owner.id, { visibility: 'PRIVATE', title: 'Приватный' });
    const personal = await makePlaylist(owner.id, { visibility: 'PUBLIC', kind: 'PERSONAL', title: 'Личная подборка' });

    const ids = (await getPublicPlaylistsByOwner(owner.id)).map((p) => p.id);
    expect(ids).toContain(publicPl.id);
    expect(ids).not.toContain(privatePl.id);
    expect(ids).not.toContain(personal.id);
  });

  it('getPlaylistWithTracks отдаёт плейлист независимо от приватности — гейт обязан стоять у вызывающего', async () => {
    const owner = await makeUser();
    const privatePl = await makePlaylist(owner.id, { visibility: 'PRIVATE' });

    // Зафиксировано фактическое поведение: сама query-функция приватность НЕ проверяет,
    // она отдаёт visibility и ownerUserId, а решение принимает страница/роут.
    const loaded = await getPlaylistWithTracks(privatePl.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.visibility).toBe('PRIVATE');
    expect(loaded!.ownerUserId).toBe(owner.id);
  });

  it('нецелой строкой не падает, а отдаёт null', async () => {
    expect(await getPlaylistWithTracks('не-uuid')).toBeNull();
  });

  it('в sitemap попадает только публичный USER-плейлист с треками', async () => {
    const owner = await makeUser();
    const { track } = await makeVisibleArtist();

    const withTracks = await makePlaylist(owner.id, { visibility: 'PUBLIC' });
    await addPlaylistTrack(withTracks.id, track.id);
    const empty = await makePlaylist(owner.id, { visibility: 'PUBLIC', title: 'Пустой' });
    const privatePl = await makePlaylist(owner.id, { visibility: 'PRIVATE' });
    await addPlaylistTrack(privatePl.id, track.id);
    const personal = await makePlaylist(owner.id, { visibility: 'PUBLIC', kind: 'PERSONAL' });
    await addPlaylistTrack(personal.id, track.id);

    const ids = (await listSitemapPlaylists(100, 0)).map((p) => p.id);
    expect(ids).toEqual([withTracks.id]);
    expect(await countSitemapPlaylists()).toBe(1);
    expect(ids).not.toContain(empty.id);
    expect(ids).not.toContain(privatePl.id);
    expect(ids).not.toContain(personal.id);
  });
});

describe('гейт видимости в поиске', () => {
  it('скрытый артист и артист без опубликованных треков не находятся', async () => {
    const { artist: visible } = await makeVisibleArtist({ name: 'Заметный Икс' });

    const hidden = await makeArtist({ name: 'Заметный Игрек', isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    await makeTrack(hiddenRelease.id);

    const empty = await makeArtist({ name: 'Заметный Зет' });
    await makeRelease(empty.id, { status: 'DRAFT' });

    const found = (await searchAll('Заметный', 20)).artists.map((a) => a.slug);
    expect(found).toContain(visible.slug);
    expect(found).not.toContain(hidden.slug);
    expect(found).not.toContain(empty.slug);
  });

  it('трек из черновика не находится, опубликованный — находится', async () => {
    const artist = await makeArtist();
    const published = await makeRelease(artist.id, { status: 'PUBLISHED' });
    const publishedTrack = await makeTrack(published.id, { title: 'Уникальный Опубликованный' });
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id, { title: 'Уникальный Черновиковый' });

    const ids = (await searchAll('Уникальный', 20)).tracks.map((t) => t.id);
    expect(ids).toContain(publishedTrack.id);
    expect(ids).not.toContain(draftTrack.id);
  });
});
