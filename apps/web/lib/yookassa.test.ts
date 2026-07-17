import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isConfigured, createPayment, getPayment } from './yookassa';

const SHOP_ID = 'shop-42';
const SECRET_KEY = 'secret-key';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');

const params = {
  idempotencyKey: 'idem-1',
  amount: '99.00',
  description: 'Трек: Track One',
  returnUrl: 'https://vire.example/thanks',
  metadata: { purchaseId: 'p-1' },
};

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
function errRes(status: number, text = 'boom'): Response {
  return { ok: false, status, json: async () => ({}), text: async () => text } as Response;
}

beforeEach(() => {
  process.env.YOOKASSA_SHOP_ID = SHOP_ID;
  process.env.YOOKASSA_SECRET_KEY = SECRET_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YOOKASSA_SHOP_ID;
  delete process.env.YOOKASSA_SECRET_KEY;
});

describe('isConfigured', () => {
  it('true when both shop id and secret key are set', () => {
    expect(isConfigured()).toBe(true);
  });

  it('false when the shop id is missing', () => {
    delete process.env.YOOKASSA_SHOP_ID;
    expect(isConfigured()).toBe(false);
  });

  it('false when the secret key is missing', () => {
    delete process.env.YOOKASSA_SECRET_KEY;
    expect(isConfigured()).toBe(false);
  });

  it('false when the shop id is an empty string', () => {
    process.env.YOOKASSA_SHOP_ID = '';
    expect(isConfigured()).toBe(false);
  });
});

describe('createPayment', () => {
  it('POSTs to /payments with basic auth, idempotency header and the YooKassa payment body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ id: 'ext-1', status: 'pending', confirmation: { type: 'redirect', confirmation_url: 'https://pay/1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const payment = await createPayment(params);

    expect(payment).toEqual({ id: 'ext-1', status: 'pending', confirmation: { type: 'redirect', confirmation_url: 'https://pay/1' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.yookassa.ru/v3/payments');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(EXPECTED_AUTH);
    expect(init.headers['Idempotency-Key']).toBe('idem-1');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      amount: { value: '99.00', currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: 'https://vire.example/thanks' },
      description: 'Трек: Track One',
      metadata: { purchaseId: 'p-1' },
      capture: true,
    });
  });

  it('throws with status and body when the API responds non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errRes(400, 'bad request')));
    await expect(createPayment(params)).rejects.toThrow('YooKassa createPayment failed: 400 bad request');
  });
});

describe('getPayment', () => {
  it('GETs /payments/:id with basic auth and returns the parsed payment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ id: 'ext-9', status: 'succeeded', confirmation: { type: 'redirect', confirmation_url: null } }));
    vi.stubGlobal('fetch', fetchMock);

    const payment = await getPayment('ext-9');

    expect(payment.status).toBe('succeeded');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.yookassa.ru/v3/payments/ext-9');
    expect(init.headers.Authorization).toBe(EXPECTED_AUTH);
    expect(init.method).toBeUndefined();
  });

  it('throws with the status when the API responds non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errRes(404)));
    await expect(getPayment('missing')).rejects.toThrow('YooKassa getPayment failed: 404');
  });
});
