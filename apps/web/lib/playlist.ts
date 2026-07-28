import { db, DrizzlePlaylistRepository, DrizzleBlockRepository, DrizzleNotificationRepository } from '@vire/db';
import { PlaylistService, type IPlaylistBroadcaster } from '@vire/core';
import { playlistCoverStorage } from './playlist-cover-storage';
import { publishChannel, playlistChannel } from './realtime';

const broadcaster: IPlaylistBroadcaster = {
  broadcast: (playlistId, event) => publishChannel(playlistChannel(playlistId), event),
};

export function playlistService() {
  return new PlaylistService(
    new DrizzlePlaylistRepository(db),
    playlistCoverStorage,
    Date.now,
    new DrizzleBlockRepository(),
    new DrizzleNotificationRepository(),
    broadcaster,
    () => crypto.randomUUID(),
  );
}
