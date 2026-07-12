import type { IPlaylistCoverStorage } from '@vire/core';
import { uploadToStream } from './s3';

export class S3PlaylistCoverStorage implements IPlaylistCoverStorage {
  upload(key: string, body: Buffer, contentType: string): Promise<string> {
    return uploadToStream(key, body, contentType);
  }
}

export const playlistCoverStorage: IPlaylistCoverStorage = new S3PlaylistCoverStorage();
