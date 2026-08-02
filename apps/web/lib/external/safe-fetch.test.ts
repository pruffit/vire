import { describe, it, expect, vi, afterEach } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));

import { safeFetchText } from './safe-fetch';

const publicRecords = [{ address: '93.184.216.34', family: 4 }];
const privateRecords = [{ address: '10.0.0.5', family: 4 }];

afterEach(() => {
  vi.unstubAllGlobals();
  lookupMock.mockReset();
});

describe('safeFetchText — protocol/URL validation', () => {
  it('rejects non-http(s) protocols without ever resolving DNS', async () => {
    const result = await safeFetchText('file:///etc/passwd');
    expect(result).toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed URL', async () => {
    expect(await safeFetchText('not a url')).toBeNull();
  });
});

describe('safeFetchText — private/reserved IP blocking', () => {
  it('blocks a literal loopback IP host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await safeFetchText('http://127.0.0.1/page')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a literal private-range IP host (10.x)', async () => {
    expect(await safeFetchText('http://10.0.0.5/page')).toBeNull();
  });

  it('blocks a link-local IP host (169.254.x — cloud metadata range)', async () => {
    expect(await safeFetchText('http://169.254.169.254/latest/meta-data')).toBeNull();
  });

  it('blocks a CGNAT IP host (100.64.x)', async () => {
    expect(await safeFetchText('http://100.64.0.1/page')).toBeNull();
  });

  it('blocks an IPv6 loopback host', async () => {
    expect(await safeFetchText('http://[::1]/page')).toBeNull();
  });

  it('blocks an IPv4-mapped IPv6 private address', async () => {
    expect(await safeFetchText('http://[::ffff:10.0.0.5]/page')).toBeNull();
  });

  it('blocks a hostname that resolves to a private IP via DNS', async () => {
    lookupMock.mockResolvedValue(privateRecords);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetchText('http://internal.example.com/page');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a hostname that resolves to a public IP', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html><body>ok</body></html>', { status: 200, headers: { 'content-type': 'text/html' } })));

    const result = await safeFetchText('http://public.example.com/page');

    expect(result?.body).toContain('ok');
  });
});

describe('safeFetchText — content-type gate', () => {
  it('rejects a non-html/json content-type (e.g. an image)', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('binary', { status: 200, headers: { 'content-type': 'image/png' } })));

    expect(await safeFetchText('http://public.example.com/cover.png')).toBeNull();
  });

  it('accepts application/json and +json variants', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/ld+json; charset=utf-8' } })));

    expect(await safeFetchText('http://public.example.com/data.json')).not.toBeNull();
  });
});

describe('safeFetchText — body size cap', () => {
  it('rejects a body larger than 512 KB', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    const huge = 'a'.repeat(600 * 1024);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(huge, { status: 200, headers: { 'content-type': 'text/html' } })));

    expect(await safeFetchText('http://public.example.com/huge')).toBeNull();
  });
});

describe('safeFetchText — redirects', () => {
  it('follows a redirect to a public host', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://public.example.com/final' } }))
      .mockResolvedValueOnce(new Response('<html>final</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetchText('http://public.example.com/start');

    expect(result?.body).toContain('final');
    expect(result?.finalUrl).toBe('http://public.example.com/final');
  });

  it('re-validates the host on every hop — a redirect to a private IP is blocked even though the first hop was public', async () => {
    lookupMock.mockResolvedValueOnce(publicRecords);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://10.0.0.5/internal' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetchText('http://public.example.com/start');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caps redirects at 3 hops', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://public.example.com/next' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetchText('http://public.example.com/start');

    expect(result).toBeNull();
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('a redirect with no Location header fails closed', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302 })));

    expect(await safeFetchText('http://public.example.com/start')).toBeNull();
  });
});

describe('safeFetchText — network failure', () => {
  it('a thrown/aborted fetch degrades to null, not a throw', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(safeFetchText('http://public.example.com/page')).resolves.toBeNull();
  });

  it('a non-ok response (404/500) returns null', async () => {
    lookupMock.mockResolvedValue(publicRecords);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })));

    expect(await safeFetchText('http://public.example.com/missing')).toBeNull();
  });
});
