import { describe, it, expect, beforeEach } from 'vitest';
import { getReleaseCardStats, listReleases } from '../discovery';
import {
  resetDb,
  makeUser,
  makeArtist,
  makeRelease,
  makeTrack,
  makeVisibleArtist,
  addPlayEvent,
} from './db-harness';

beforeEach(resetDb);

describe('счётчики карточки релиза', () => {
  it('считают только READY-треки и суммируют их длительность', async () => {
    const artist = await makeArtist();
    const release = await makeRelease(artist.id);
    await makeTrack(release.id, { status: 'READY', durationSec: 120 });
    await makeTrack(release.id, { trackNumber: 2, status: 'READY', durationSec: 180 });
    await makeTrack(release.id, { trackNumber: 3, status: 'PROCESSING', durationSec: 999 });
    await makeTrack(release.id, { trackNumber: 4, status: 'BLOCKED', durationSec: 999 });

    const stats = await getReleaseCardStats(release.id);
    expect(stats.trackCount).toBe(2);
    expect(stats.totalDurationSec).toBe(300);
  });

  it('у релиза без готовых треков нули, а не null', async () => {
    const artist = await makeArtist();
    const release = await makeRelease(artist.id);
    await makeTrack(release.id, { status: 'PROCESSING' });

    const stats = await getReleaseCardStats(release.id);
    expect(stats.trackCount).toBe(0);
    expect(stats.totalDurationSec).toBe(0);
  });

  it('длительность без проставленных значений не ломает сумму', async () => {
    const artist = await makeArtist();
    const release = await makeRelease(artist.id);
    await makeTrack(release.id, { status: 'READY', durationSec: null });

    const stats = await getReleaseCardStats(release.id);
    expect(stats.trackCount).toBe(1);
    expect(stats.totalDurationSec).toBe(0);
  });
});

describe('сортировка каталога по популярности', () => {
  it('релиз с большим числом прослушиваний идёт выше, а без них остаётся в выдаче', async () => {
    const listener = await makeUser();
    const { artist, release: quiet } = await makeVisibleArtist();

    const loud = await makeRelease(artist.id, { title: 'Громкий' });
    const loudTrack = await makeTrack(loud.id);
    await addPlayEvent(loudTrack.id, listener.id);
    await addPlayEvent(loudTrack.id, listener.id);
    await addPlayEvent(loudTrack.id, null);

    const silent = await makeRelease(artist.id, { title: 'Без прослушиваний' });
    await makeTrack(silent.id);

    const ids = (await listReleases({ limit: 50, offset: 0, sort: 'popular' })).map((r) => r.id);
    expect(ids[0]).toBe(loud.id);
    // left join: релизы без прослушиваний не выпадают из каталога
    expect(ids).toContain(quiet.id);
    expect(ids).toContain(silent.id);
  });

  it('прослушивания одного релиза не приписываются соседнему', async () => {
    const listener = await makeUser();
    const { artist } = await makeVisibleArtist();
    const target = await makeRelease(artist.id, { title: 'Целевой' });
    const targetTrack = await makeTrack(target.id);
    const neighbour = await makeRelease(artist.id, { title: 'Соседний' });
    await makeTrack(neighbour.id);

    await addPlayEvent(targetTrack.id, listener.id);

    const ids = (await listReleases({ limit: 50, offset: 0, sort: 'popular' })).map((r) => r.id);
    expect(ids[0]).toBe(target.id);
  });
});
