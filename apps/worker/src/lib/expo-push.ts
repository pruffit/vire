const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Возвращает токены с немедленной ошибкой DeviceNotRegistered — их надо удалить. */
export async function sendExpoPush(
  tokens: string[],
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<string[]> {
  if (tokens.length === 0) return [];

  const dead: string[] = [];
  await Promise.all(chunk(tokens, CHUNK_SIZE).map(async (batch) => {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch.map((token) => ({
          to: token,
          title: payload.title,
          body: payload.body,
          data: { url: payload.url, tag: payload.tag },
        }))),
      });
      const json = await res.json() as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          dead.push(batch[i]);
        }
      });
    } catch {
      // сетевые ошибки/rate-limit — не считаем токены мёртвыми
    }
  }));
  return dead;
}
