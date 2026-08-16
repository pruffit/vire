import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { IFileStorage, PresignDownloadOptions, StorageObjectInfo } from '@vire/core';

export interface S3ObjectStorageOptions {
  client: S3Client;
  bucket: string;
  /** Клиент для подписи ссылок (публичный хост); по умолчанию — основной. */
  signerClient?: S3Client;
  /** База публичного URL; если не задана, upload вернёт ключ вместо ссылки. */
  publicBaseUrl?: string;
}

// Удаление пачками: DeleteObjects принимает максимум 1000 ключей за запрос.
const DELETE_BATCH = 1000;

export class S3ObjectStorage implements IFileStorage {
  private readonly client: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor(options: S3ObjectStorageOptions) {
    this.client = options.client;
    this.signer = options.signerClient ?? options.client;
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl;
  }

  async upload(key: string, body: Uint8Array, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${this.bucket}/${key}` : key;
  }

  async uploadFile(key: string, sourcePath: string, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(sourcePath),
        ContentType: contentType,
      }),
    );
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty S3 body: ${this.bucket}/${key}`);
    await pipeline(res.Body as Readable, createWriteStream(destinationPath));
  }

  presignDownload(key: string, options: PresignDownloadOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${options.filename}"`,
      ResponseContentType: options.contentType,
    });
    return getSignedUrl(this.signer, command, { expiresIn: options.expiresInSec });
  }

  async remove(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH);
      if (batch.length === 0) continue;
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  async stat(key: string): Promise<StorageObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? null,
        lastModified: res.LastModified ?? null,
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}
