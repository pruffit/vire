import type { IPlaylistCoverStorage } from '@vire/core';
import { fileStorage } from './file-storage';

export const playlistCoverStorage: IPlaylistCoverStorage = fileStorage;
