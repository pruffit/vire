import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import type { Readable } from 'node:stream';

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  },
  // Обязательно для MinIO и Selectel — адресация по пути, не по поддомену
  forcePathStyle: true,
});

export const VAULT = process.env.S3_BUCKET_VAULT ?? 'vire-vault';
export const STREAM = process.env.S3_BUCKET_STREAM ?? 'vire-stream';

export async function downloadToFile(
  bucket: string,
  key: string,
  destPath: string,
): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty S3 body: ${bucket}/${key}`);
  await pipeline(res.Body as Readable, createWriteStream(destPath));
}

export async function uploadFile(
  bucket: string,
  key: string,
  srcPath: string,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(srcPath),
      ContentType: contentType,
    }),
  );
}
