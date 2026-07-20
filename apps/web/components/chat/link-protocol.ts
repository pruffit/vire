export interface LinkState {
  userId: string;
  commitB: string;
  eaPub?: string;
  ebPub?: string;
  wrapped?: string;
  nonce?: string;
  status: 'pending' | 'completed';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isLinkState(s: LinkState | null | 'gone'): s is LinkState {
  return s !== null && s !== 'gone';
}

// 404 = сессию удалили (abort с другой стороны или TTL) — прекращаем поллинг сразу,
// не ждём оставшиеся ~3 минуты цикла на транзиентных ошибках сети.
export async function pollLink(linkId: string, until: (s: LinkState) => boolean): Promise<LinkState | null | 'gone'> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`/api/v1/keys/link/poll?linkId=${linkId}`).catch(() => null);
    if (res?.status === 404) return 'gone';
    if (res?.ok) {
      const state = (await res.json()) as LinkState;
      if (until(state)) return state;
    }
    await sleep(1500);
  }
  return null;
}

export function postLink(path: string, body: unknown) {
  return fetch(`/api/v1/keys/link/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
