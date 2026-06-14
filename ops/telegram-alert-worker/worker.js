// Cloudflare Worker — релей алертов в Telegram.
//
// Зачем: прод-VPS (Timeweb) не имеет egress на api.telegram.org (заблокирован),
// поэтому web/worker не могут слать в Telegram напрямую. Cloudflare этот хост
// видит. Схема: VPS → POST на этот Worker (его VPS видит) → sendMessage в Telegram.
//
// Vire-сторона шлёт generic-webhook JSON ({ text, content, ... }) на
// ALERT_WEBHOOK_URL = https://<worker>.workers.dev/<ALERT_SECRET>. Воркер берёт
// `text` и пересылает его в чат TG_CHAT_ID ботом TG_TOKEN.
//
// Переменные окружения Worker (Settings → Variables and Secrets):
//   ALERT_SECRET — секрет в пути URL (отсекает чужие POST'ы). Secret.
//   TG_TOKEN     — токен бота (тот же, что для входа). Secret.
//   TG_CHAT_ID   — куда слать (user id / id группы). Plaintext.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Авторизация секретом в пути: /<ALERT_SECRET>. Сравнение постоянного времени
    // не критично — секрет длинный и случайный.
    if (!env.ALERT_SECRET || url.pathname !== `/${env.ALERT_SECRET}`) {
      return new Response('not found', { status: 404 });
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('bad json', { status: 400 });
    }

    const text = String(body.text ?? body.content ?? body.message ?? 'alert').slice(0, 4000);

    const tgRes = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });

    // Пробрасываем ответ Telegram как есть — удобно для отладки curl'ом.
    return new Response(await tgRes.text(), {
      status: tgRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
