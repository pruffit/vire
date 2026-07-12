import type { IPlaylistCoverStorage } from '@vire/core';
import { S3FileStorage } from './file-storage';

export const playlistCoverStorage: IPlaylistCoverStorage = new S3FileStorage();
