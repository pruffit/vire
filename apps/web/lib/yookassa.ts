const BASE_URL = 'https://api.yookassa.ru/v3';

export function isConfigured(): boolean {
  return !!(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID!;
  const secretKey = process.env.YOOKASSA_SECRET_KEY!;
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

export interface YookassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  confirmation: {
    type: string;
    confirmation_url: string;
  };
}

export async function createPayment(params: {
  idempotencyKey: string;
  amount: string;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
}): Promise<YookassaPayment> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      'Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify({
      amount: { value: params.amount, currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: params.returnUrl },
      description: params.description,
      metadata: params.metadata,
      capture: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YooKassa createPayment failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<YookassaPayment>;
}

export async function getPayment(paymentId: string): Promise<YookassaPayment> {
  const res = await fetch(`${BASE_URL}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });

  if (!res.ok) {
    throw new Error(`YooKassa getPayment failed: ${res.status}`);
  }

  return res.json() as Promise<YookassaPayment>;
}
