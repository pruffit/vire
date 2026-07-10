import { describe, expect, it, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { request } from '../http';

const schema = z.object({ ok: z.boolean() });

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('сетевой сбой -> ok:false, status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await request('/api/x', { schema });

    expect(result).toEqual({ ok: false, error: { status: 0, message: 'Нет соединения' } });
  });

  it('HTTP-ошибка с телом {error} -> текст сервера в message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Слишком много запросов' }),
      }),
    );

    const result = await request('/api/x', { schema });

    expect(result).toEqual({ ok: false, error: { status: 429, message: 'Слишком много запросов' } });
  });

  it('HTTP-ошибка без тела {error} -> дефолтное сообщение', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      }),
    );

    const result = await request('/api/x', { schema });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(500);
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('ответ не по zod-схеме -> ok:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: 'not-a-boolean' }),
      }),
    );

    const result = await request('/api/x', { schema });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(200);
    }
  });

  it('успех -> ok:true, данные из схемы', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      }),
    );

    const result = await request('/api/x', { schema });

    expect(result).toEqual({ ok: true, data: { ok: true } });
  });
});
