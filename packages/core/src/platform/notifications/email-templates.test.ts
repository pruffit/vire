import { describe, it, expect } from 'vitest';
import { friendRequestEmail, chatMessageEmail, emailShell, transcodeFailedEmail } from './email-templates';

describe('email-templates', () => {
  it('заявка: имя актора и ссылка на /friends', async () => {
    const { subject, html } = await friendRequestEmail({ actorName: 'Аня', appUrl: 'https://vire', unsubscribeUrl: 'https://vire/unsub', locale: 'ru' });
    expect(subject).toContain('Аня');
    expect(html).toContain('https://vire/friends');
    expect(html).toContain('https://vire/unsub');
  });
  it('сообщение: контентless, ссылка на /messages, без текста', async () => {
    const { subject, html } = await chatMessageEmail({ actorName: 'Аня', appUrl: 'https://vire', unsubscribeUrl: null, locale: 'ru' });
    expect(subject).toContain('Аня');
    expect(html).toContain('https://vire/messages');
    expect(html).not.toContain('secret-body-text');
  });
  it('без имени — нейтральная формулировка', async () => {
    const { subject } = await friendRequestEmail({ actorName: null, appUrl: 'https://vire', unsubscribeUrl: null, locale: 'ru' });
    expect(subject.length).toBeGreaterThan(0);
  });
  it('экранирует HTML в имени актора (защита от инъекции)', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { html } = await friendRequestEmail({ actorName: evil, appUrl: 'https://vire', unsubscribeUrl: null, locale: 'ru' });
    expect(html).not.toContain(evil);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('экранирует HTML в имени актора для чат-письма', async () => {
    const evil = '<img src=x>';
    const { html } = await chatMessageEmail({ actorName: evil, appUrl: 'https://vire', unsubscribeUrl: null, locale: 'ru' });
    expect(html).toContain('&lt;img src=x&gt;');
  });
  it('en-локаль: html lang и переведённый текст', async () => {
    const { subject, html } = await friendRequestEmail({ actorName: 'Anna', appUrl: 'https://vire', unsubscribeUrl: null, locale: 'en' });
    expect(html).toContain('<html lang="en">');
    expect(subject).toContain('friend request');
  });
});

describe('emailShell', () => {
  const base = {
    locale: 'ru' as const,
    heading: 'Заголовок',
    bodyHtml: 'Текст письма',
    ctaLabel: 'Открыть',
    ctaUrl: 'https://vire/target',
    footerHtml: '<a href="https://vire/unsub">Отписаться</a>',
  };

  it('содержит CTA, футер и lang', () => {
    const html = emailShell(base);
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('href="https://vire/target"');
    expect(html).toContain('Открыть →');
    expect(html).toContain('href="https://vire/unsub"');
  });

  it('без imageUrl/subheading — картинки и подзаголовка нет', () => {
    const html = emailShell(base);
    expect(html).not.toContain('<img');
  });

  it('с imageUrl — рендерит обложку и подзаголовок', () => {
    const html = emailShell({ ...base, imageUrl: 'https://vire/cover.jpg', subheading: 'Название релиза' });
    expect(html).toContain('<img src="https://vire/cover.jpg"');
    expect(html).toContain('Название релиза');
  });

  it('с hintHtml — второй абзац тела присутствует', () => {
    const html = emailShell({ ...base, hintHtml: 'Подсказка' });
    expect(html).toContain('Подсказка');
  });
});

describe('transcodeFailedEmail', () => {
  it('ru: subject и heading дословно как в исходном письме', async () => {
    const { subject, html } = await transcodeFailedEmail({
      trackTitle: 'Song',
      dashboardUrl: 'https://vire/dashboard/releases/1',
      recipientName: 'Артист',
      locale: 'ru',
    });
    expect(subject).toBe('Не удалось обработать трек «Song»');
    expect(html).toContain('Не удалось обработать трек</h1>');
    expect(html).toContain('Привет, Артист!');
    expect(html).toContain('Открыть релиз →');
    expect(html).toContain('href="https://vire/dashboard/releases/1"');
  });

  it('ru: без имени — нейтральное приветствие', async () => {
    const { html } = await transcodeFailedEmail({
      trackTitle: 'Song',
      dashboardUrl: 'https://vire/dashboard/releases/1',
      recipientName: null,
      locale: 'ru',
    });
    expect(html).toContain('Привет!');
    expect(html).not.toContain('Привет,');
  });

  it('en: subject и heading переведены', async () => {
    const { subject, html } = await transcodeFailedEmail({
      trackTitle: 'Song',
      dashboardUrl: 'https://vire/dashboard/releases/1',
      recipientName: 'Artist',
      locale: 'en',
    });
    expect(subject).toContain("couldn't process");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Hi, Artist!');
  });

  it('экранирует HTML в названии трека', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { html } = await transcodeFailedEmail({
      trackTitle: evil,
      dashboardUrl: 'https://vire/dashboard/releases/1',
      recipientName: null,
      locale: 'ru',
    });
    expect(html).not.toContain(evil);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('экранирует HTML в имени получателя', async () => {
    const evil = '<b>Artist</b>';
    const { html } = await transcodeFailedEmail({
      trackTitle: 'Song',
      dashboardUrl: 'https://vire/dashboard/releases/1',
      recipientName: evil,
      locale: 'ru',
    });
    expect(html).not.toContain(evil);
    expect(html).toContain('&lt;b&gt;Artist&lt;/b&gt;');
  });
});
