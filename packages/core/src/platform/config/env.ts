import { z } from 'zod';
import { type Result, ok, err } from '../../errors';

export type EnvProfile = 'web' | 'worker';

export interface EnvIssue {
  variable: string;
  message: string;
}

export interface EnvError {
  issues: EnvIssue[];
}

export interface DegradedFeature {
  feature: string;
  missing: string[];
}

export interface ParsedEnv {
  profile: EnvProfile;
  degraded: DegradedFeature[];
}

const reqStr = z.string().min(1);
const optStr = z.string().optional();

const requiredShape = {
  DATABASE_URL: reqStr,
  REDIS_URL: reqStr,
  AUTH_SECRET: reqStr,
  S3_ENDPOINT: reqStr,
  S3_ACCESS_KEY: reqStr,
  S3_SECRET_KEY: reqStr,
  S3_BUCKET_VAULT: reqStr,
  S3_BUCKET_STREAM: reqStr,
};

export const webEnvSchema = z.object({
  ...requiredShape,
  BREVO_API_KEY: optStr,
  VAPID_PUBLIC_KEY: optStr,
  YOOKASSA_SHOP_ID: optStr,
  YOOKASSA_SECRET_KEY: optStr,
  ALERT_WEBHOOK_URL: optStr,
  TELEGRAM_ALERT_CHAT_ID: optStr,
  LASTFM_API_KEY: optStr,
  YOUTUBE_API_KEY: optStr,
  LINK_SIGNING_SECRET: optStr,
});

export const workerEnvSchema = z.object({
  ...requiredShape,
  BREVO_API_KEY: optStr,
  VAPID_PUBLIC_KEY: optStr,
  VAPID_PRIVATE_KEY: optStr,
  VAPID_SUBJECT: optStr,
  ALERT_WEBHOOK_URL: optStr,
  TELEGRAM_ALERT_CHAT_ID: optStr,
  AUTO_GENRE: optStr,
  AUTO_GENRE_MODELS_DIR: optStr,
  LINK_SIGNING_SECRET: optStr,
});

interface DegradedRule {
  feature: string;
  vars: readonly string[];
  // 'all' — фича собрана из нескольких обязательных-вместе секретов (частично не считается);
  // 'any' — независимые каналы одной фичи, деградирует только если не задан ни один.
  mode: 'all' | 'any';
}

const WEB_DEGRADED_RULES: readonly DegradedRule[] = [
  { feature: 'email', vars: ['BREVO_API_KEY'], mode: 'all' },
  { feature: 'push', vars: ['VAPID_PUBLIC_KEY'], mode: 'all' },
  { feature: 'purchases', vars: ['YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY'], mode: 'all' },
  { feature: 'alerts', vars: ['ALERT_WEBHOOK_URL', 'TELEGRAM_ALERT_CHAT_ID'], mode: 'any' },
  { feature: 'lastfm-taste', vars: ['LASTFM_API_KEY'], mode: 'all' },
  { feature: 'youtube-search', vars: ['YOUTUBE_API_KEY'], mode: 'all' },
  { feature: 'link-signing', vars: ['LINK_SIGNING_SECRET'], mode: 'all' },
];

const WORKER_DEGRADED_RULES: readonly DegradedRule[] = [
  { feature: 'email', vars: ['BREVO_API_KEY'], mode: 'all' },
  { feature: 'push', vars: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'], mode: 'all' },
  { feature: 'alerts', vars: ['ALERT_WEBHOOK_URL', 'TELEGRAM_ALERT_CHAT_ID'], mode: 'any' },
  { feature: 'auto-genre', vars: ['AUTO_GENRE'], mode: 'all' },
  { feature: 'link-signing', vars: ['LINK_SIGNING_SECRET'], mode: 'all' },
];

function computeDegraded(
  raw: Record<string, string | undefined>,
  rules: readonly DegradedRule[],
): DegradedFeature[] {
  const degraded: DegradedFeature[] = [];
  for (const rule of rules) {
    const missing = rule.vars.filter((v) => !raw[v]);
    const isDegraded = rule.mode === 'all' ? missing.length > 0 : missing.length === rule.vars.length;
    if (isDegraded) degraded.push({ feature: rule.feature, missing });
  }
  return degraded;
}

export function parseEnv(
  raw: Record<string, string | undefined>,
  profile: EnvProfile,
): Result<ParsedEnv, EnvError> {
  const schema = profile === 'web' ? webEnvSchema : workerEnvSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      variable: String(issue.path[0]),
      message: `отсутствует обязательная переменная окружения ${String(issue.path[0])}`,
    }));
    return err({ issues });
  }

  const rules = profile === 'web' ? WEB_DEGRADED_RULES : WORKER_DEGRADED_RULES;
  return ok({ profile, degraded: computeDegraded(raw, rules) });
}
