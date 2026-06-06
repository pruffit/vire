import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  },
  forcePathStyle: true,
});

export const VAULT = process.env.S3_BUCKET_VAULT ?? 'vire-vault';
export const STREAM = process.env.S3_BUCKET_STREAM ?? 'vire-stream';

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: VAULT,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  );
}

export async function getFlacDownloadUrl(trackId: string, filename: string): Promise<string> {
  const key = `tracks/${trackId}/source.flac`;
  const command = new GetObjectCommand({
    Bucket: VAULT,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}.flac"`,
    ResponseContentType: 'audio/flac',
  });
  // 15 minutes — enough to start the download
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function uploadToStream(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: STREAM,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  );
  return `${process.env.S3_PUBLIC_ENDPOINT}/${STREAM}/${key}`;
}
