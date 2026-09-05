import { describe, it, expect, beforeEach } from 'vitest';
import { listArtistsAdmin } from '../admin-artists';
import {
  resetDb,
  makeUser,
  makeArtist,
  makeRelease,
  makeTrack,
  addPlayEvent,
  followArtist,
} from './db-harness';

beforeEach(resetDb);

/**
 * Счётчики собираются четырьмя LEFT JOIN предагрегатов. Если хоть один потеряет
 * группировку, строки размножатся и числа поедут вверх — проверяем точные значения
 * на артисте, у которого всего по несколько штук.
 */
describe('счётчики админского списка артистов', () => {
  it('не размножаются при нескольких релизах, треках и подписчиках', async () => {
    const artist = await makeArtist();
    const first = await makeRelease(artist.id);
    const second = await makeRelease(artist.id, { title: 'Второй' });
    const t1 = await makeTrack(first.id);
    const t2 = await makeTrack(first.id, { trackNumber: 2 });
    await makeTrack(second.id);

    const fan1 = await makeUser();
    const fan2 = await makeUser();
    await followArtist(fan1.id, artist.id);
    await followArtist(fan2.id, artist.id);

    await addPlayEvent(t1.id, fan1.id);
    await addPlayEvent(t1.id, fan2.id);
    await addPlayEvent(t2.id, fan1.id);

    const [row] = await listArtistsAdmin({ limit: 10 });
    expect(row!.releaseCount).toBe(2);
    expect(row!.trackCount).toBe(3);
    expect(row!.followerCount).toBe(2);
    expect(row!.plays30d).toBe(3);
  });

  it('у пустого артиста нули, а не null', async () => {
    await makeArtist();
    const [row] = await listArtistsAdmin({ limit: 10 });
    expect(row!.releaseCount).toBe(0);
    expect(row!.trackCount).toBe(0);
    expect(row!.followerCount).toBe(0);
    expect(row!.plays30d).toBe(0);
  });

  it('прослушивания старше 30 дней в plays30d не попадают', async () => {
    const artist = await makeArtist();
    const release = await makeRelease(artist.id);
    const track = await makeTrack(release.id);
    const listener = await makeUser();

    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await addPlayEvent(track.id, listener.id, { startedAt: recent });
    await addPlayEvent(track.id, listener.id, { startedAt: old });

    const [row] = await listArtistsAdmin({ limit: 10 });
    expect(row!.plays30d).toBe(1);
  });

  it('счётчики не перетекают между артистами', async () => {
    const loud = await makeArtist({ name: 'Громкий' });
    const quiet = await makeArtist({ name: 'Тихий' });
    const release = await makeRelease(loud.id);
    const track = await makeTrack(release.id);
    const fan = await makeUser();
    await followArtist(fan.id, loud.id);
    await addPlayEvent(track.id, fan.id);

    const byName = new Map((await listArtistsAdmin({ limit: 10 })).map((r) => [r.name, r]));
    expect(byName.get('Громкий')!.plays30d).toBe(1);
    expect(byName.get('Громкий')!.followerCount).toBe(1);
    expect(byName.get('Тихий')!.plays30d).toBe(0);
    expect(byName.get('Тихий')!.followerCount).toBe(0);
  });
});
