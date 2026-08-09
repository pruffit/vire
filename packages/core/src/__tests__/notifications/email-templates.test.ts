import { describe, it, expect } from 'vitest';
import { friendRequestEmail, chatMessageEmail } from '../../notifications/email-templates';

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
