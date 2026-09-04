import { describe, it, expect, beforeEach } from 'vitest';
import { getSimilarArtists, clearSimilarityCache } from '../similarity';
import { resetDb, makeUser, makeArtist, makeRelease, makeTrack, makeVisibleArtist, addPlayEvent } from './db-harness';

beforeEach(async () => {
  await resetDb();
  // Выдача мемоизируется на процесс — без сброса второй тест увидит чужие данные.
  clearSimilarityCache();
});

describe('гейт видимости в похожих артистах', () => {
  it('скрытый артист не попадает в похожие, даже при общих слушателях', async () => {
    const listener = await makeUser();
    const source = await makeVisibleArtist();

    const neighbour = await makeVisibleArtist();
    const hidden = await makeArtist({ isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    const hiddenTrack = await makeTrack(hiddenRelease.id);

    // Один и тот же слушатель слушал исходного, соседа и скрытого — со-прослушивание есть у обоих.
    await addPlayEvent(source.track.id, listener.id);
    await addPlayEvent(neighbour.track.id, listener.id);
    await addPlayEvent(hiddenTrack.id, listener.id);

    const ids = (await getSimilarArtists(source.artist.id, 10)).map((c) => c.artistProfileId);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(source.artist.id);
  });

  it('без совместных прослушиваний выдача пуста', async () => {
    const source = await makeVisibleArtist();
    expect(await getSimilarArtists(source.artist.id, 10)).toEqual([]);
  });
});
