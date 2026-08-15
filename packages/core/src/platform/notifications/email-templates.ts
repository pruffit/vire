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

export interface EmailShellOptions {
  locale: Locale;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerHtml: string;
  /** Второй абзац тела (напр. подсказка после основного текста) — опционален. */
  hintHtml?: string;
  /** Обложка релиза. */
  imageUrl?: string;
  /** Название релиза под заголовком. */
  subheading?: string;
}

// Единственная реализация вёрстки транзакционного письма платформы — используется
// и core (friendRequest/chatMessage/transcodeFailed), и apps/worker (release/presave).
export function emailShell(opts: EmailShellOptions): string {
  const { locale, heading, bodyHtml, hintHtml, ctaLabel, ctaUrl, footerHtml, imageUrl, subheading } = opts;
  const image = imageUrl
    ? `<img src="${imageUrl}" alt="${subheading ?? ''}" width="200" height="200" style="display:block;border-radius:6px;margin:20px 0;object-fit:cover">\n    `
    : '';
  const subheadingHtml = subheading
    ? `<p style="font-size:20px;font-weight:500;margin:0 0 24px">${subheading}</p>\n    `
    : '';
  const hint = hintHtml
    ? `<p style="margin:0 0 24px;font-size:14px;color:#aaa">${hintHtml}</p>\n    `
    : '';
  const bodyMargin = hintHtml ? '16px' : '32px';
  const headingMargin = subheading ? '6px' : '12px';
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Inter,sans-serif;color:#f5f2eb">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <p style="font-size:13px;color:#666;margin:0 0 24px">VireMusic</p>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 ${headingMargin};line-height:1.3">${heading}</h1>
    ${image}${subheadingHtml}<p style="margin:0 0 ${bodyMargin};font-size:14px;color:#aaa">${bodyHtml}</p>
    ${hint}<a href="${ctaUrl}" style="display:inline-block;background:#f5f2eb;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">${ctaLabel} →</a>
    <p style="margin:40px 0 0;font-size:12px;color:#444">${footerHtml}</p>
  </div>
</body></html>`;
}

async function unsubscribeOrSettingsFooter(
  t: Awaited<ReturnType<typeof getTranslator>>,
  locale: Locale,
  appUrl: string,
  unsubscribeUrl: string | null,
): Promise<string> {
  return unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#666">${t('unsubscribeLink')}</a>`
    : `<a href="${appUrl}${localizedPath(locale, '/profile')}" style="color:#666">${t('notificationSettingsLink')}</a>`;
}

export async function friendRequestEmail(i: Base): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(i.locale, 'email');
  const who = i.actorName ?? t('someone');
  const whoHtml = escapeHtml(who);
  return {
    subject: t('friendRequest.subject', { name: who }),
    html: emailShell({
      locale: i.locale,
      heading: t('friendRequest.heading', { name: whoHtml }),
      bodyHtml: t('friendRequest.body'),
      ctaLabel: t('friendRequest.cta'),
      ctaUrl: `${i.appUrl}${localizedPath(i.locale, '/friends')}`,
      footerHtml: await unsubscribeOrSettingsFooter(t, i.locale, i.appUrl, i.unsubscribeUrl),
    }),
  };
}

export async function chatMessageEmail(i: Base): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(i.locale, 'email');
  const who = i.actorName ?? t('someone');
  const whoHtml = escapeHtml(who);
  return {
    subject: t('chatMessage.subject', { name: who }),
    html: emailShell({
      locale: i.locale,
      heading: t('chatMessage.heading', { name: whoHtml }),
      bodyHtml: t('chatMessage.body'),
      ctaLabel: t('chatMessage.cta'),
      ctaUrl: `${i.appUrl}${localizedPath(i.locale, '/messages')}`,
      footerHtml: await unsubscribeOrSettingsFooter(t, i.locale, i.appUrl, i.unsubscribeUrl),
    }),
  };
}

export interface TranscodeFailedInput {
  trackTitle: string;
  dashboardUrl: string;
  recipientName: string | null;
  locale: Locale;
}

export async function transcodeFailedEmail(
  i: TranscodeFailedInput,
): Promise<{ subject: string; html: string }> {
  const t = await getTranslator(i.locale, 'email');
  const greeting = i.recipientName
    ? t('transcodeFailed.greeting', { name: escapeHtml(i.recipientName) })
    : t('transcodeFailed.greetingAnonymous');
  // Разметка собирается здесь: use-intl не принимает теги с атрибутами внутри сообщения.
  const track = `<strong style="color:#f5f2eb">${t('transcodeFailed.trackQuoted', { trackTitle: escapeHtml(i.trackTitle) })}</strong>`;
  return {
    subject: t('transcodeFailed.subject', { trackTitle: i.trackTitle }),
    html: emailShell({
      locale: i.locale,
      heading: t('transcodeFailed.heading'),
      bodyHtml: t('transcodeFailed.body', { greeting, track }),
      hintHtml: t('transcodeFailed.hint'),
      ctaLabel: t('transcodeFailed.cta'),
      ctaUrl: i.dashboardUrl,
      footerHtml: t('transcodeFailed.footer'),
    }),
  };
}
