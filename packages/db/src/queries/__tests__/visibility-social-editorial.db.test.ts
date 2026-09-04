import { describe, it, expect, beforeEach } from 'vitest';
import { getEditorialPlaylists, getPersonalPlaylists } from '../playlist-editorial';
import { findDueScheduledReleases } from '../release-presaves';
import { getFriendsActivity } from '../friends-activity';
import {
  resetDb,
  makeUser,
  makeArtist,
  makeRelease,
  makeVisibleArtist,
  makePlaylist,
  makeFriendship,
  likeTrack,
} from './db-harness';

beforeEach(resetDb);

describe('гейт подборок', () => {
  it('личная подборка видна только своему адресату', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const mine = await makePlaylist(owner.id, {
      kind: 'PERSONAL',
      isCurated: true,
      targetUserId: owner.id,
      title: 'Моя личная',
    });

    expect((await getPersonalPlaylists(owner.id, 10)).map((p) => p.id)).toContain(mine.id);
    expect((await getPersonalPlaylists(stranger.id, 10)).map((p) => p.id)).not.toContain(mine.id);
  });

  it('в общие редакционные не попадают личные и пользовательские', async () => {
    const owner = await makeUser();
    const shared = await makePlaylist(owner.id, { kind: 'MOOD', isCurated: true, title: 'Общая дневная' });
    const personal = await makePlaylist(owner.id, {
      kind: 'PERSONAL',
      isCurated: true,
      targetUserId: owner.id,
    });
    const userMade = await makePlaylist(owner.id, { kind: 'USER', isCurated: true, visibility: 'PUBLIC' });

    const ids = (await getEditorialPlaylists(20)).map((p) => p.id);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(personal.id);
    expect(ids).not.toContain(userMade.id);
  });
});

describe('гейт выхода запланированного релиза', () => {
  it('в кандидаты на публикацию попадает только SCHEDULED с наступившей датой', async () => {
    const artist = await makeArtist();
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const due = await makeRelease(artist.id, { status: 'SCHEDULED', releaseDate: past });
    const notYet = await makeRelease(artist.id, { status: 'SCHEDULED', releaseDate: future });
    const draftPast = await makeRelease(artist.id, { status: 'DRAFT', releaseDate: past });

    const ids = (await findDueScheduledReleases()).map((r) => r.id);
    expect(ids).toContain(due.id);
    expect(ids).not.toContain(notYet.id);
    expect(ids).not.toContain(draftPast.id);
  });
});

describe('гейт видимости лайков друзей', () => {
  it('лайк друга виден только при social_visibility=FRIENDS', async () => {
    const me = await makeUser();
    const openFriend = await makeUser({ socialVisibility: 'FRIENDS' });
    const closedFriend = await makeUser({ socialVisibility: 'PRIVATE' });
    const stranger = await makeUser({ socialVisibility: 'FRIENDS' });
    const { track } = await makeVisibleArtist();

    await makeFriendship(me.id, openFriend.id);
    await makeFriendship(closedFriend.id, me.id);
    await likeTrack(openFriend.id, track.id);
    await likeTrack(closedFriend.id, track.id);
    await likeTrack(stranger.id, track.id);

    const activity = await getFriendsActivity(me.id, 20);
    const likerIds = activity.likes.map((l) => l.actor.id);
    expect(likerIds).toContain(openFriend.id);
    expect(likerIds).not.toContain(closedFriend.id);
    expect(likerIds).not.toContain(stranger.id);
  });

  it('без друзей активность пуста', async () => {
    const lonely = await makeUser();
    const activity = await getFriendsActivity(lonely.id, 20);
    expect(activity.likes).toHaveLength(0);
  });
});
