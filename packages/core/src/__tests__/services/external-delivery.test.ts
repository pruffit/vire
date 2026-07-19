import { describe, it, expect } from 'vitest';
import { decideExternalDelivery } from '../../services/external-delivery';

const base = { notifyEmail: true, notifyPush: true, recipientOnline: false, emailDebounced: false, hasEmail: true, pushSubscriptionCount: 2 };

describe('decideExternalDelivery', () => {
  it('онлайн-получателю не шлём ничего', () => {
    expect(decideExternalDelivery({ ...base, recipientOnline: true })).toEqual({ email: false, push: false });
  });
  it('офлайн + оба канала включены → оба', () => {
    expect(decideExternalDelivery(base)).toEqual({ email: true, push: true });
  });
  it('email выключен в prefs → без email', () => {
    expect(decideExternalDelivery({ ...base, notifyEmail: false })).toEqual({ email: false, push: true });
  });
  it('нет email-адреса → без email', () => {
    expect(decideExternalDelivery({ ...base, hasEmail: false })).toEqual({ email: false, push: true });
  });
  it('email в окне дебаунса → без email', () => {
    expect(decideExternalDelivery({ ...base, emailDebounced: true })).toEqual({ email: false, push: true });
  });
  it('нет push-подписок → без push', () => {
    expect(decideExternalDelivery({ ...base, pushSubscriptionCount: 0 })).toEqual({ email: true, push: false });
  });
  it('push выключен в prefs → без push', () => {
    expect(decideExternalDelivery({ ...base, notifyPush: false })).toEqual({ email: true, push: false });
  });
});
