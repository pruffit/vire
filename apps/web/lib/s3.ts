import {
  S3ObjectStorage, createS3Client, s3ConfigFromEnv, bucketsFromEnv, S3_UPLOAD_REQUEST_TIMEOUT_MS,
} from '@vire/storage';

// Веб грузит мастер целиком одним PUT (до 300 МБ) — таймаут запроса с запасом,
// иначе загрузка крупного трека обрывалась бы на медленном диске.
const client = createS3Client(s3ConfigFromEnv(process.env), { requestTimeoutMs: S3_UPLOAD_REQUEST_TIMEOUT_MS });
const signer = createS3Client(s3ConfigFromEnv(process.env, 'public'));
const buckets = bucketsFromEnv(process.env);

export const VAULT = buckets.vault;
export const STREAM = buckets.stream;

export const vaultStorage = new S3ObjectStorage({ client, signerClient: signer, bucket: VAULT });
export const streamStorage = new S3ObjectStorage({
  client,
  signerClient: signer,
  bucket: STREAM,
  publicBaseUrl: process.env.S3_PUBLIC_ENDPOINT,
});

export function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  return vaultStorage.upload(key, buffer, contentType).then(() => undefined);
}

export function uploadToStream(key: string, buffer: Buffer, contentType: string): Promise<string> {
  return streamStorage.upload(key, buffer, contentType);
}

export function getSourceDownloadUrl(key: string, filename: string): Promise<string> {
  // key указывает на мастер в vault, например tracks/{id}/source.wav | source.flac
  const ext = key.split('.').pop() || 'flac';
  return vaultStorage.presignDownload(key, {
    filename: `${encodeURIComponent(filename)}.${ext}`,
    contentType: ext === 'wav' ? 'audio/wav' : 'audio/flac',
    expiresInSec: 900,
  });
}
