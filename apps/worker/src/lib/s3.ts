import { S3ObjectStorage, createS3Client, s3ConfigFromEnv, bucketsFromEnv } from '@vire/storage';

const client = createS3Client(s3ConfigFromEnv(process.env));
const buckets = bucketsFromEnv(process.env);

export const VAULT = buckets.vault;
export const STREAM = buckets.stream;

export const vaultStorage = new S3ObjectStorage({ client, bucket: VAULT });
export const streamStorage = new S3ObjectStorage({ client, bucket: STREAM });

function storageFor(bucket: string): S3ObjectStorage {
  if (bucket === VAULT) return vaultStorage;
  if (bucket === STREAM) return streamStorage;
  throw new Error(`Unknown bucket: ${bucket}`);
}

export function downloadToFile(bucket: string, key: string, destPath: string): Promise<void> {
  return storageFor(bucket).downloadToFile(key, destPath);
}

export function uploadFile(bucket: string, key: string, srcPath: string, contentType: string): Promise<void> {
  return storageFor(bucket).uploadFile(key, srcPath, contentType);
}
