import type { IFileStorage } from '@vire/core';
import { uploadToStream, uploadBuffer } from './s3';

/** Публичный бакет (STREAM) — обложки, аватары, шапки. */
export class S3FileStorage implements IFileStorage {
  upload(key: string, body: Uint8Array, contentType: string): Promise<string> {
    return uploadToStream(key, Buffer.from(body), contentType);
  }
}

/** Приватный бакет (VAULT) — исходники треков; возвращает ключ, публичный URL не нужен. */
export class S3AudioStorage implements IFileStorage {
  async upload(key: string, body: Uint8Array, contentType: string): Promise<string> {
    await uploadBuffer(key, Buffer.from(body), contentType);
    return key;
  }
}

export const fileStorage: IFileStorage = new S3FileStorage();
export const audioStorage: IFileStorage = new S3AudioStorage();
