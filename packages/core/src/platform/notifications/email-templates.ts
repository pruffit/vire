import { getTranslator, localizedPath, type Locale } from '@vire/i18n';

interface Base {
  actorName: string | null;
  appUrl: string;
  unsubscribeUrl: string | null;
  locale: Locale;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function shell(
  t: Awaited<ReturnType<typeof getTranslator>>,
  locale: Locale,
  appUrl: string,
  heading: string,
  bodyLine: string,
  ctaLabel: string,
  ctaUrl: string,
  unsubscribeUrl: string | null,
): Promise<string> {
  const unsub = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#666">${t('unsubscribeLink')}</a>`
    : `<a href="${appUrl}${localizedPath(locale, '/profile')}" style="color:#666">${t('notificationSettingsLink')}</a>`;
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">VireMusic</p>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;line-height:1.3">${heading}</h1>
    <p style="margin:0 0 32px;font-size:14px;color:#aaa">${bodyLine}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">${ctaLabel} →</a>
    <p style="margin:40px 0 0;font-size:12px;color:#444">${unsub}</p>
  </div>
</body></html>`;
}

export async function friendRequestEmail(i: Base): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(i.locale, 'email');
  const who = i.actorName ?? t('someone');
  const whoHtml = escapeHtml(who);
  return {
    subject: t('friendRequest.subject', { name: who }),
    html: await shell(
      t,
      i.locale,
      i.appUrl,
      t('friendRequest.heading', { name: whoHtml }),
      t('friendRequest.body'),
      t('friendRequest.cta'),
      `${i.appUrl}${localizedPath(i.locale, '/friends')}`,
      i.unsubscribeUrl,
    ),
  };
}

export async function chatMessageEmail(i: Base): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(i.locale, 'email');
  const who = i.actorName ?? t('someone');
  const whoHtml = escapeHtml(who);
  return {
    subject: t('chatMessage.subject', { name: who }),
    html: await shell(
      t,
      i.locale,
      i.appUrl,
      t('chatMessage.heading', { name: whoHtml }),
      t('chatMessage.body'),
      t('chatMessage.cta'),
      `${i.appUrl}${localizedPath(i.locale, '/messages')}`,
      i.unsubscribeUrl,
    ),
  };
}
