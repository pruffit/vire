interface Base {
  actorName: string | null;
  appUrl: string;
  unsubscribeUrl: string | null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(
  appUrl: string,
  heading: string,
  bodyLine: string,
  ctaLabel: string,
  ctaUrl: string,
  unsubscribeUrl: string | null,
): string {
  const unsub = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#666">Отписаться от писем</a>`
    : `<a href="${appUrl}/profile" style="color:#666">Настройки уведомлений</a>`;
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">Vire</p>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;line-height:1.3">${heading}</h1>
    <p style="margin:0 0 32px;font-size:14px;color:#aaa">${bodyLine}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">${ctaLabel} →</a>
    <p style="margin:40px 0 0;font-size:12px;color:#444">${unsub}</p>
  </div>
</body></html>`;
}

export function friendRequestEmail(i: Base): { subject: string; html: string } {
  const who = i.actorName ?? 'Кто-то';
  const whoHtml = escapeHtml(who);
  return {
    subject: `${who} отправил вам заявку в друзья на Vire`,
    html: shell(
      i.appUrl,
      `${whoHtml} хочет добавить вас в друзья`,
      'Примите или отклоните заявку на Vire.',
      'Открыть заявки',
      `${i.appUrl}/friends`,
      i.unsubscribeUrl,
    ),
  };
}

export function chatMessageEmail(i: Base): { subject: string; html: string } {
  const who = i.actorName ?? 'Кто-то';
  const whoHtml = escapeHtml(who);
  return {
    subject: `Новое сообщение от ${who} на Vire`,
    html: shell(
      i.appUrl,
      `Новое сообщение от ${whoHtml}`,
      'Откройте переписку на Vire, чтобы прочитать.',
      'Открыть сообщения',
      `${i.appUrl}/messages`,
      i.unsubscribeUrl,
    ),
  };
}
