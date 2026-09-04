import { describe, it, expect, beforeEach } from 'vitest';
import { getAdminStats, getRecentPublishedReleases } from '../admin';
import { listArtistsAdmin } from '../admin-artists';
import { listTracksAdmin } from '../admin-catalog';
import { getAdminPlatformMetrics } from '../admin-analytics';
import { resetDb, makeArtist, makeRelease, makeTrack, makeVisibleArtist } from './db-harness';

beforeEach(resetDb);

/**
 * У бэкофиса гейт обратный: он обязан видеть то, что скрыто от витрины, — иначе
 * скрытого артиста и залипший трек нечем разбирать. Проверяем именно это.
 */
describe('бэкофис видит скрытое от витрины', () => {
  it('listArtistsAdmin показывает скрытого артиста и помечает его isActive=false', async () => {
    const { artist: visible } = await makeVisibleArtist();
    const hidden = await makeArtist({ isActive: false });

    const rows = await listArtistsAdmin({ limit: 50 });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    expect(bySlug.get(visible.slug)?.isActive).toBe(true);
    expect(bySlug.get(hidden.slug)?.isActive).toBe(false);
  });

  it('listTracksAdmin показывает треки черновиков и умеет фильтровать по статусу', async () => {
    const artist = await makeArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id, { status: 'PROCESSING' });
    const published = await makeRelease(artist.id);
    const blocked = await makeTrack(published.id, { status: 'BLOCKED' });

    const all = (await listTracksAdmin({ limit: 50 })).map((t) => t.id);
    expect(all).toContain(draftTrack.id);
    expect(all).toContain(blocked.id);

    const onlyBlocked = (await listTracksAdmin({ status: 'BLOCKED', limit: 50 })).map((t) => t.id);
    expect(onlyBlocked).toEqual([blocked.id]);
  });

  it('getAdminStats считает треки по статусам, включая скрытые от витрины', async () => {
    const artist = await makeArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    await makeTrack(draft.id, { status: 'PROCESSING' });
    const published = await makeRelease(artist.id);
    await makeTrack(published.id, { status: 'READY' });
    await makeTrack(published.id, { trackNumber: 2, status: 'BLOCKED' });

    const stats = await getAdminStats();
    expect(stats.tracksProcessing).toBe(1);
    expect(stats.tracksReady).toBe(1);
    expect(stats.tracksBlocked).toBe(1);
  });

  it('метрики площадки различают активных и скрытых артистов', async () => {
    await makeVisibleArtist();
    await makeArtist({ isActive: false });

    const metrics = await getAdminPlatformMetrics();
    expect(metrics.artistsActive).toBe(1);
    expect(metrics.releasesByStatus['PUBLISHED']).toBe(1);
  });
});

describe('витринные выборки внутри админки', () => {
  it('getRecentPublishedReleases берёт только опубликованные', async () => {
    const { artist, release: published } = await makeVisibleArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const archived = await makeRelease(artist.id, { status: 'ARCHIVED' });

    const ids = (await getRecentPublishedReleases(20)).map((r) => r.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(archived.id);
  });
});
