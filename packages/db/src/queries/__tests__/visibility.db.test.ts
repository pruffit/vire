import { describe, it, expect, beforeEach } from 'vitest';
import { listActiveArtists, artistHasPublishedTrackById } from '../artists';
import { getLatestReleases, listReleases, getArtistPlayableTracks } from '../discovery';
import { listSitemapArtists, countSitemapArtists, listSitemapReleases } from '../sitemap';
import { resetDb, makeArtist, makeRelease, makeTrack, makeVisibleArtist } from './db-harness';

beforeEach(resetDb);

describe('гейт видимости артиста', () => {
  it('скрытый артист (isActive=false) не попадает в каталог, даже с опубликованным треком', async () => {
    const { artist: visible } = await makeVisibleArtist();
    const hidden = await makeArtist({ isActive: false });
    const release = await makeRelease(hidden.id);
    await makeTrack(release.id);

    const slugs = (await listActiveArtists({ limit: 50, offset: 0 })).map((a) => a.slug);
    expect(slugs).toContain(visible.slug);
    expect(slugs).not.toContain(hidden.slug);
  });

  it('артист без опубликованных треков не попадает в каталог', async () => {
    const artist = await makeArtist();
    await makeRelease(artist.id, { status: 'DRAFT' });

    const slugs = (await listActiveArtists({ limit: 50, offset: 0 })).map((a) => a.slug);
    expect(slugs).not.toContain(artist.slug);
  });

  it('artistHasPublishedTrackById смотрит на статус релиза, а не трека', async () => {
    const artist = await makeArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    await makeTrack(draft.id);
    expect(await artistHasPublishedTrackById(artist.id)).toBe(false);

    // Зафиксировано фактическое поведение: гейт каталога проверяет только статус релиза.
    // Трек в PROCESSING/FAILED/BLOCKED делает артиста видимым, хотя играть у него нечего —
    // getArtistPlayableTracks фильтрует по READY, и профиль оказывается пустым.
    const published = await makeRelease(artist.id, { status: 'PUBLISHED' });
    await makeTrack(published.id, { status: 'PROCESSING' });
    expect(await artistHasPublishedTrackById(artist.id)).toBe(true);
    expect(await getArtistPlayableTracks(artist.id)).toHaveLength(0);
  });
});

describe('гейт видимости релиза', () => {
  it('черновик и архив не попадают в свежие релизы и каталог', async () => {
    const { artist, release: published } = await makeVisibleArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT', title: 'Черновик' });
    await makeTrack(draft.id);
    const archived = await makeRelease(artist.id, { status: 'ARCHIVED', title: 'Архив' });
    await makeTrack(archived.id);

    const latestIds = (await getLatestReleases(50)).map((r) => r.id);
    expect(latestIds).toContain(published.id);
    expect(latestIds).not.toContain(draft.id);
    expect(latestIds).not.toContain(archived.id);

    const catalogIds = (await listReleases({ limit: 50, offset: 0, sort: 'fresh' })).map((r) => r.id);
    expect(catalogIds).toContain(published.id);
    expect(catalogIds).not.toContain(draft.id);
    expect(catalogIds).not.toContain(archived.id);
  });

  it('релизы скрытого артиста не попадают в свежие', async () => {
    const hidden = await makeArtist({ isActive: false });
    const release = await makeRelease(hidden.id);
    await makeTrack(release.id);

    expect((await getLatestReleases(50)).map((r) => r.id)).not.toContain(release.id);
  });

  it('в играбельные треки артиста не попадают треки черновика и не-READY', async () => {
    const { artist, track: ready } = await makeVisibleArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id);
    const published = await makeRelease(artist.id);
    const processing = await makeTrack(published.id, { status: 'PROCESSING' });

    const ids = (await getArtistPlayableTracks(artist.id)).map((t) => t.id);
    expect(ids).toContain(ready.id);
    expect(ids).not.toContain(draftTrack.id);
    expect(ids).not.toContain(processing.id);
  });
});

describe('гейт видимости в sitemap', () => {
  it('скрытый артист и его релизы не попадают в карту сайта', async () => {
    const { artist: visible, release: visibleRelease } = await makeVisibleArtist();
    const hidden = await makeArtist({ isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    await makeTrack(hiddenRelease.id);

    const artistSlugs = (await listSitemapArtists(100, 0)).map((a) => a.slug);
    expect(artistSlugs).toContain(visible.slug);
    expect(artistSlugs).not.toContain(hidden.slug);
    expect(await countSitemapArtists()).toBe(1);

    const releaseIds = (await listSitemapReleases(100, 0)).map((r) => r.id);
    expect(releaseIds).toContain(visibleRelease.id);
    expect(releaseIds).not.toContain(hiddenRelease.id);
  });

  it('черновик не попадает в карту сайта', async () => {
    const { artist } = await makeVisibleArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    await makeTrack(draft.id);

    expect((await listSitemapReleases(100, 0)).map((r) => r.id)).not.toContain(draft.id);
  });
});
