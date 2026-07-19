import { describe, it, expect } from 'vitest';
import { friendRequestEmail, chatMessageEmail } from '../../notifications/email-templates';

describe('email-templates', () => {
  it('заявка: имя актора и ссылка на /friends', () => {
    const { subject, html } = friendRequestEmail({ actorName: 'Аня', appUrl: 'https://vire', unsubscribeUrl: 'https://vire/unsub' });
    expect(subject).toContain('Аня');
    expect(html).toContain('https://vire/friends');
    expect(html).toContain('https://vire/unsub');
  });
  it('сообщение: контентless, ссылка на /messages, без текста', () => {
    const { subject, html } = chatMessageEmail({ actorName: 'Аня', appUrl: 'https://vire', unsubscribeUrl: null });
    expect(subject).toContain('Аня');
    expect(html).toContain('https://vire/messages');
    expect(html).not.toContain('secret-body-text');
  });
  it('без имени — нейтральная формулировка', () => {
    expect(friendRequestEmail({ actorName: null, appUrl: 'https://vire', unsubscribeUrl: null }).subject.length).toBeGreaterThan(0);
  });
  it('экранирует HTML в имени актора (защита от инъекции)', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { html } = friendRequestEmail({ actorName: evil, appUrl: 'https://vire', unsubscribeUrl: null });
    expect(html).not.toContain(evil);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('экранирует HTML в имени актора для чат-письма', () => {
    const evil = '<img src=x>';
    const { html } = chatMessageEmail({ actorName: evil, appUrl: 'https://vire', unsubscribeUrl: null });
    expect(html).toContain('&lt;img src=x&gt;');
  });
});
