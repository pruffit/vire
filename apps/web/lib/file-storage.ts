import type { IFileUploader } from '@vire/core';
import { uploadBuffer, uploadToStream } from './s3';

/** Публичный бакет (STREAM) — обложки, аватары, шапки. */
export const fileStorage: IFileUploader = {
  upload: (key, body, contentType) => uploadToStream(key, Buffer.from(body), contentType),
};

/** Приватный бакет (VAULT) — исходники треков; возвращает ключ, публичный URL не нужен. */
export const audioStorage: IFileUploader = {
  async upload(key, body, contentType) {
    await uploadBuffer(key, Buffer.from(body), contentType);
    return key;
  },
};
