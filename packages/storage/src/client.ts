import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// Индексная сигнатура — чтобы принимать process.env напрямую, без приведения на месте вызова.
export interface S3Env {
  [key: string]: string | undefined;
  S3_ENDPOINT?: string;
  S3_PUBLIC_ENDPOINT?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_BUCKET_VAULT?: string;
  S3_BUCKET_STREAM?: string;
}

const DEFAULTS = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
};

export function s3ConfigFromEnv(env: S3Env, which: 'internal' | 'public' = 'internal'): S3Config {
  // Публичный эндпоинт нужен для подписи: SigV4 привязана к хосту, а на проде
  // S3_ENDPOINT внутренний (web/worker ↔ minio), ссылка же открывается снаружи.
  const endpoint = which === 'public'
    ? env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT ?? DEFAULTS.endpoint
    : env.S3_ENDPOINT ?? DEFAULTS.endpoint;
  return {
    endpoint,
    region: env.S3_REGION ?? DEFAULTS.region,
    accessKeyId: env.S3_ACCESS_KEY ?? DEFAULTS.accessKeyId,
    secretAccessKey: env.S3_SECRET_KEY ?? DEFAULTS.secretAccessKey,
  };
}

export const S3_CONNECTION_TIMEOUT_MS = 10_000;
export const S3_REQUEST_TIMEOUT_MS = 60_000;
/** Загрузка мастера — до 300 МБ одним PUT, 60 секунд для неё мало. */
export const S3_UPLOAD_REQUEST_TIMEOUT_MS = 300_000;

export interface S3ClientOptions {
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
}

// Явные таймауты обязательны: без них зависшее TCP-соединение (прод: connect ETIMEDOUT)
// ждёт ОС-таймаут на КАЖДУЮ из встроенных ретрай-попыток SDK, держа джобу и её лок.
export function createS3Client(config: S3Config, options: S3ClientOptions = {}): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Обязательно для MinIO и Selectel — адресация по пути, не по поддомену
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: options.connectionTimeoutMs ?? S3_CONNECTION_TIMEOUT_MS,
      requestTimeout: options.requestTimeoutMs ?? S3_REQUEST_TIMEOUT_MS,
    }),
  });
}

export function bucketsFromEnv(env: S3Env): { vault: string; stream: string } {
  return {
    vault: env.S3_BUCKET_VAULT ?? 'vire-vault',
    stream: env.S3_BUCKET_STREAM ?? 'vire-stream',
  };
}
