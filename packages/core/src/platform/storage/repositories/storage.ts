export interface StorageObjectInfo {
  size: number;
  contentType: string | null;
  lastModified: Date | null;
}

export interface PresignDownloadOptions {
  /** Имя файла в `Content-Disposition: attachment`. */
  filename: string;
  contentType: string;
  expiresInSec: number;
}

/** То, что нужно доменным сервисам: положить файл и получить ссылку/ключ. */
export interface IFileUploader {
  upload(key: string, body: Uint8Array, contentType: string): Promise<string>;
}

// Один экземпляр = один бакет: у платформы их два (приватный vault, публичный stream),
// и права на них разные.
export interface IFileStorage extends IFileUploader {
  uploadFile(key: string, sourcePath: string, contentType: string): Promise<void>;
  downloadToFile(key: string, destinationPath: string): Promise<void>;
  presignDownload(key: string, options: PresignDownloadOptions): Promise<string>;
  /** Все ключи под префиксом; пагинация внутри реализации. */
  listKeys(prefix: string): Promise<string[]>;
  /** Нет объекта — не ошибка: удаление идемпотентно. */
  remove(keys: string[]): Promise<void>;
  stat(key: string): Promise<StorageObjectInfo | null>;
}
