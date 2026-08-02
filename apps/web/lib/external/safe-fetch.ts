import { lookup } from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 512 * 1024;
const ALLOWED_CONTENT_TYPES = [/^text\/html\b/i, /^application\/json\b/i, /\+json\b/i];
const USER_AGENT = 'VireMusicBot/1.0 (+https://viremusic.ru)';

export interface FetchedPage {
  contentType: string;
  body: string;
  finalUrl: string;
}

/**
 * SSRF-guarded fetch произвольного URL от пользователя (docs/security/owasp-top-10.md, A10):
 * только http/https, ручные редиректы (макс. 3, каждый хоп ревалидируется отдельно),
 * DNS-резолв хоста с блокировкой loopback/private/link-local/CGNAT (вкл. IPv6 и ::ffff: mapped),
 * таймаут 5с, тело до 512 КБ, content-type только html/json. Любая ошибка — null, не throw.
 */
export async function safeFetchText(url: string): Promise<FetchedPage | null> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = tryParseUrl(current);
    if (!parsed) return null;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const allowed = await isPublicHost(parsed.hostname).catch(() => false);
    if (!allowed) return null;

    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json;q=0.9,*/*;q=0.1' },
    }).catch(() => null);
    if (!res) return null;

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) return null;
      const next = tryParseUrl(location, current);
      if (!next) return null;
      current = next.toString();
      continue;
    }

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!ALLOWED_CONTENT_TYPES.some((re) => re.test(contentType))) return null;

    const body = await readBounded(res);
    if (body === null) return null;

    return { contentType, body, finalUrl: current };
  }

  return null;
}

function tryParseUrl(url: string, base?: string): URL | null {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
}

async function readBounded(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;

  let received = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
}

async function isPublicHost(hostname: string): Promise<boolean> {
  if (net.isIP(hostname)) return isPublicIp(hostname);

  const records = await lookup(hostname, { all: true });
  if (records.length === 0) return false;
  return records.every(({ address }) => isPublicIp(address));
}

function isPublicIp(address: string): boolean {
  const unwrapped = unwrapMappedIPv4(address);
  if (net.isIPv4(unwrapped)) return !isReservedIPv4(unwrapped);
  if (net.isIPv6(unwrapped)) return !isReservedIPv6(unwrapped);
  return false;
}

function unwrapMappedIPv4(address: string): string {
  const m = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return m ? m[1]! : address;
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inIPv4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

// 0.0.0.0/8, 10/8 (private), 100.64/10 (CGNAT), 127/8 (loopback), 169.254/16 (link-local),
// 172.16/12 (private), 192.0.0/24 + 192.0.2/24 (special-purpose/doc), 192.168/16 (private),
// 198.18/15 (benchmarking), 198.51.100/24 + 203.0.113/24 (doc), 224/4 (multicast), 240/4 (reserved).
function isReservedIPv4(ip: string): boolean {
  return (
    inIPv4Range(ip, '0.0.0.0', 8) ||
    inIPv4Range(ip, '10.0.0.0', 8) ||
    inIPv4Range(ip, '100.64.0.0', 10) ||
    inIPv4Range(ip, '127.0.0.0', 8) ||
    inIPv4Range(ip, '169.254.0.0', 16) ||
    inIPv4Range(ip, '172.16.0.0', 12) ||
    inIPv4Range(ip, '192.0.0.0', 24) ||
    inIPv4Range(ip, '192.0.2.0', 24) ||
    inIPv4Range(ip, '192.168.0.0', 16) ||
    inIPv4Range(ip, '198.18.0.0', 15) ||
    inIPv4Range(ip, '198.51.100.0', 24) ||
    inIPv4Range(ip, '203.0.113.0', 24) ||
    inIPv4Range(ip, '224.0.0.0', 4) ||
    inIPv4Range(ip, '240.0.0.0', 4)
  );
}

// ::1 (loopback), :: (unspecified), fe80::/10 (link-local), fc00::/7 (unique local), ff00::/8 (multicast).
function isReservedIPv6(address: string): boolean {
  const ip = address.toLowerCase();
  if (ip === '::1' || ip === '::') return true;
  if (/^fe[89ab]/.test(ip)) return true;
  if (/^f[cd]/.test(ip)) return true;
  if (ip.startsWith('ff')) return true;
  return false;
}
