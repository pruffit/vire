import { NextResponse } from 'next/server';
import { parseSentryEnvelope, extractCrashEvent } from '@vire/core';
import { insertMobileCrash } from '@vire/db';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

/**
 * Приёмник падений мобильного приложения — свой Sentry-совместимый эндпоинт.
 *
 * **Почему путь выглядит так.** Его диктует SDK, а не мы: из DSN
 * `https://<key>@viremusic.ru/1` клиент выводит адрес `/api/<projectId>/envelope/`.
 * Менять путь нельзя, не отказавшись от стокового `@sentry/react-native`.
 *
 * **Почему не sentry.io.** Отдаёт 403 на любой запрос из России (блокировка на
 * пограничном балансировщике, до приложения). Свой приёмник ничего не стоит в
 * инфраструктуре: таблица в уже работающем Postgres, ноль новых контейнеров на VPS,
 * где 2 ГБ RAM и шесть контейнеров. Протокол стандартный, поэтому переезд на
 * self-hosted GlitchTip позже — смена хоста в DSN, без правок клиента.
 *
 * Аутентификации нет намеренно: краш случается и до входа, и когда приложение уже
 * падает. Защита — rate limit и потолок размера тела.
 */
export const dynamic = 'force-dynamic';

// Событие Sentry с трейсом и контекстом укладывается в сотни килобайт; всё, что крупнее,
// — вложения или мусор, и в таблицу ему не надо.
const MAX_BODY_BYTES = 512 * 1024;

// Падают приложения пачками (цикл перезапуска), но не сотнями в минуту с одного адреса.
const RATE_LIMIT = 60;
const RATE_WINDOW_SEC = 60;

export async function POST(req: Request) {
  const rl = await rateLimit(clientKey(req, 'crash'), RATE_LIMIT, RATE_WINDOW_SEC);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const raw = await req.text().catch(() => null);
  if (!raw || raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const envelope = parseSentryEnvelope(raw);
  if (!envelope) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const crash = extractCrashEvent(envelope);
  // Сессии и транзакции идут тем же каналом — это не ошибка клиента, молча принимаем.
  // Ответ всегда 200: SDK на неуспех складывает событие в очередь и шлёт снова, а
  // повторять то, что мы осознанно не храним, смысла нет.
  if (!crash) return NextResponse.json({ ok: true });

  try {
    await insertMobileCrash(crash);
  } catch (err) {
    console.error('[crash-ingest] не удалось записать падение', crash.eventId, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ id: crash.eventId });
}
