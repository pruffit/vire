import { describe, it, expect } from 'vitest';
import { s3ConfigFromEnv, bucketsFromEnv } from './client';

describe('s3ConfigFromEnv', () => {
  const env = {
    S3_ENDPOINT: 'http://minio:9000',
    S3_PUBLIC_ENDPOINT: 'https://cdn.vire',
    S3_REGION: 'ru-1',
    S3_ACCESS_KEY: 'key',
    S3_SECRET_KEY: 'secret',
  };

  it('internal берёт внутренний эндпоинт', () => {
    expect(s3ConfigFromEnv(env).endpoint).toBe('http://minio:9000');
  });

  it('public берёт публичный — подпись SigV4 привязана к хосту ссылки', () => {
    expect(s3ConfigFromEnv(env, 'public').endpoint).toBe('https://cdn.vire');
  });

  it('без публичного эндпоинта public падает на внутренний (локалка)', () => {
    expect(s3ConfigFromEnv({ S3_ENDPOINT: 'http://localhost:9000' }, 'public').endpoint).toBe('http://localhost:9000');
  });

  it('пустое окружение — локальные дефолты MinIO', () => {
    expect(s3ConfigFromEnv({})).toEqual({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    });
  });
});

describe('bucketsFromEnv', () => {
  it('берёт имена из окружения', () => {
    expect(bucketsFromEnv({ S3_BUCKET_VAULT: 'v', S3_BUCKET_STREAM: 's' })).toEqual({ vault: 'v', stream: 's' });
  });

  it('без окружения — дефолты', () => {
    expect(bucketsFromEnv({})).toEqual({ vault: 'vire-vault', stream: 'vire-stream' });
  });
});
