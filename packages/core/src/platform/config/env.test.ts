import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

const REQUIRED = {
  DATABASE_URL: 'postgresql://vire:vire@localhost:5432/vire',
  REDIS_URL: 'redis://localhost:6379',
  AUTH_SECRET: 'secret',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_BUCKET_VAULT: 'vire-vault',
  S3_BUCKET_STREAM: 'vire-stream',
};

const WEB_OPTIONAL = {
  BREVO_API_KEY: 'brevo-key',
  VAPID_PUBLIC_KEY: 'vapid-pub',
  YOOKASSA_SHOP_ID: 'shop',
  YOOKASSA_SECRET_KEY: 'shop-secret',
  ALERT_WEBHOOK_URL: 'https://hooks.example/alert',
  TELEGRAM_ALERT_CHAT_ID: '123',
  LASTFM_API_KEY: 'lastfm-key',
  YOUTUBE_API_KEY: 'youtube-key',
  LINK_SIGNING_SECRET: 'link-secret',
};

const WORKER_OPTIONAL = {
  BREVO_API_KEY: 'brevo-key',
  VAPID_PUBLIC_KEY: 'vapid-pub',
  VAPID_PRIVATE_KEY: 'vapid-priv',
  VAPID_SUBJECT: 'mailto:admin@viremusic.ru',
  ALERT_WEBHOOK_URL: 'https://hooks.example/alert',
  TELEGRAM_ALERT_CHAT_ID: '123',
  AUTO_GENRE: 'true',
  AUTO_GENRE_MODELS_DIR: '/models',
  LINK_SIGNING_SECRET: 'link-secret',
};

describe('parseEnv', () => {
  it('web profile: full set of vars → ok with no degraded features', () => {
    const result = parseEnv({ ...REQUIRED, ...WEB_OPTIONAL }, 'web');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile).toBe('web');
    expect(result.value.degraded).toEqual([]);
  });

  it('worker profile: full set of vars → ok with no degraded features', () => {
    const result = parseEnv({ ...REQUIRED, ...WORKER_OPTIONAL }, 'worker');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile).toBe('worker');
    expect(result.value.degraded).toEqual([]);
  });

  it('empty raw env → lists all required variables for the web profile', () => {
    const result = parseEnv({}, 'web');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const variables = result.error.issues.map((i) => i.variable).sort();
    expect(variables).toEqual(Object.keys(REQUIRED).sort());
  });

  it('empty raw env → lists all required variables for the worker profile', () => {
    const result = parseEnv({}, 'worker');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const variables = result.error.issues.map((i) => i.variable).sort();
    expect(variables).toEqual(Object.keys(REQUIRED).sort());
  });

  it('required present, optional absent (web) → ok with all optional features degraded', () => {
    const result = parseEnv({ ...REQUIRED }, 'web');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const features = result.value.degraded.map((d) => d.feature).sort();
    expect(features).toEqual(
      ['alerts', 'email', 'lastfm-taste', 'link-signing', 'purchases', 'push', 'youtube-search'].sort(),
    );
  });

  it('required present, optional absent (worker) → ok with all optional features degraded', () => {
    const result = parseEnv({ ...REQUIRED }, 'worker');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const features = result.value.degraded.map((d) => d.feature).sort();
    expect(features).toEqual(['alerts', 'auto-genre', 'email', 'link-signing', 'push'].sort());
  });

  it('alerts is degraded only when neither webhook nor chat id is set', () => {
    const withWebhookOnly = parseEnv({ ...REQUIRED, ALERT_WEBHOOK_URL: 'https://hooks.example/alert' }, 'web');
    expect(withWebhookOnly.ok).toBe(true);
    if (!withWebhookOnly.ok) return;
    expect(withWebhookOnly.value.degraded.some((d) => d.feature === 'alerts')).toBe(false);
  });

  it('purchases is degraded when only one of the two YooKassa vars is set', () => {
    const result = parseEnv({ ...REQUIRED, YOOKASSA_SHOP_ID: 'shop' }, 'web');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const purchases = result.value.degraded.find((d) => d.feature === 'purchases');
    expect(purchases?.missing).toEqual(['YOOKASSA_SECRET_KEY']);
  });

  it('rejects empty-string required variables, not just missing keys', () => {
    const result = parseEnv({ ...REQUIRED, DATABASE_URL: '' }, 'web');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues.map((i) => i.variable)).toContain('DATABASE_URL');
  });
});
