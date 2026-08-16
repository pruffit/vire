import { describe, it, expect, vi } from 'vitest';
import { DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3ObjectStorage } from './object-storage';

type SendMock = ReturnType<typeof vi.fn>;

function storage(overrides?: { publicBaseUrl?: string; send?: SendMock }) {
  const send: SendMock = overrides?.send ?? vi.fn().mockResolvedValue({});
  const client = { send } as unknown as S3Client;
  return {
    send,
    subject: new S3ObjectStorage({ client, bucket: 'vire-stream', publicBaseUrl: overrides?.publicBaseUrl }),
  };
}

describe('S3ObjectStorage.upload', () => {
  it('кладёт объект в свой бакет и отдаёт публичный URL', async () => {
    const { subject, send } = storage({ publicBaseUrl: 'https://cdn.vire' });

    const url = await subject.upload('covers/a.jpg', new Uint8Array([1, 2, 3]), 'image/jpeg');

    expect(url).toBe('https://cdn.vire/vire-stream/covers/a.jpg');
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'vire-stream',
      Key: 'covers/a.jpg',
      ContentType: 'image/jpeg',
      ContentLength: 3,
    });
  });

  it('без публичной базы возвращает ключ — приватный бакет ссылок не отдаёт', async () => {
    const { subject } = storage();
    await expect(subject.upload('tracks/1/source.flac', new Uint8Array([1]), 'audio/flac')).resolves.toBe(
      'tracks/1/source.flac',
    );
  });
});

describe('S3ObjectStorage.remove', () => {
  it('удаляет пачкой', async () => {
    const { subject, send } = storage();

    await subject.remove(['a', 'b']);

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input.Delete.Objects).toEqual([{ Key: 'a' }, { Key: 'b' }]);
  });

  it('пустой список ключей не идёт в S3', async () => {
    const { subject, send } = storage();
    await subject.remove([]);
    expect(send).not.toHaveBeenCalled();
  });

  it('режет на запросы по 1000 ключей', async () => {
    const { subject, send } = storage();
    await subject.remove(Array.from({ length: 1001 }, (_, i) => `k${i}`));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].input.Delete.Objects).toEqual([{ Key: 'k1000' }]);
  });
});

describe('S3ObjectStorage.listKeys', () => {
  it('собирает ключи по префиксу', async () => {
    const send = vi.fn().mockResolvedValue({ Contents: [{ Key: 'a' }, { Key: 'b' }], IsTruncated: false });
    const { subject } = storage({ send });

    await expect(subject.listKeys('tracks/t1/')).resolves.toEqual(['a', 'b']);
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: 'vire-stream', Prefix: 'tracks/t1/' });
  });

  it('идёт по страницам, пока IsTruncated', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ Contents: [{ Key: 'a' }], IsTruncated: true, NextContinuationToken: 'tok' })
      .mockResolvedValueOnce({ Contents: [{ Key: 'b' }], IsTruncated: false });
    const { subject } = storage({ send });

    await expect(subject.listKeys('p/')).resolves.toEqual(['a', 'b']);
    expect(send.mock.calls[1][0].input.ContinuationToken).toBe('tok');
  });

  it('пустой префикс — пустой список, а не падение', async () => {
    const { subject } = storage({ send: vi.fn().mockResolvedValue({ IsTruncated: false }) });
    await expect(subject.listKeys('nope/')).resolves.toEqual([]);
  });
});

describe('S3ObjectStorage.stat', () => {
  it('отдаёт метаданные объекта', async () => {
    const lastModified = new Date('2026-08-16T00:00:00Z');
    const send = vi.fn().mockResolvedValue({ ContentLength: 42, ContentType: 'audio/flac', LastModified: lastModified });
    const { subject } = storage({ send });

    await expect(subject.stat('tracks/1/source.flac')).resolves.toEqual({
      size: 42,
      contentType: 'audio/flac',
      lastModified,
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('нет объекта → null, а не исключение', async () => {
    const notFound = Object.assign(new Error('nope'), { name: 'NotFound' });
    const { subject } = storage({ send: vi.fn().mockRejectedValue(notFound) });
    await expect(subject.stat('missing')).resolves.toBeNull();
  });

  it('404 без имени NotFound тоже считается отсутствием', async () => {
    const notFound = Object.assign(new Error('nope'), { $metadata: { httpStatusCode: 404 } });
    const { subject } = storage({ send: vi.fn().mockRejectedValue(notFound) });
    await expect(subject.stat('missing')).resolves.toBeNull();
  });

  it('прочие ошибки пробрасываются — молчать о сбое S3 нельзя', async () => {
    const { subject } = storage({ send: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(subject.stat('key')).rejects.toThrow('boom');
  });
});
