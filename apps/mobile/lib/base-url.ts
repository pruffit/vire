/**
 * Разрешение базового URL — чистое, без обращения к RN и expo-constants (их подставляет
 * `lib/env.ts`), поэтому покрывается тестами напрямую.
 *
 * Порядок и его цена: до P0 последним фолбэком стоял `http://localhost:3000`, и release
 * получал его из `.env` — а release-манифест запрещает cleartext, так что собранное
 * приложение не доходило до бэкенда ни одним запросом. Отсюда правило: **LAN и localhost
 * существуют только в `__DEV__`**, прод берёт адрес из `app.json` → `extra`.
 */
import { baseUrlFromHostUri } from './lan-host';

const API_PORT = 3000;
const DEV_FALLBACK = `http://localhost:${API_PORT}`;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveBaseUrl({
  explicit,
  isDev,
  hostUri,
  production,
}: {
  /** `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WEB_BASE_URL` — ручной override. */
  explicit?: string;
  isDev: boolean;
  /** LAN-адрес Metro; учитывается только в dev. */
  hostUri?: string;
  /** `extra.apiBaseUrl` / `extra.webBaseUrl` из `app.json` — единственный источник для release. */
  production?: string;
}): string {
  const override = nonEmpty(explicit);
  if (override) return trimTrailingSlash(override);

  if (isDev) return trimTrailingSlash(baseUrlFromHostUri(nonEmpty(hostUri), API_PORT, DEV_FALLBACK));

  const configured = nonEmpty(production);
  if (!configured) {
    throw new Error(
      'VireMusic: базовый URL не сконфигурирован. Задай extra.apiBaseUrl/extra.webBaseUrl в app.json.',
    );
  }
  return trimTrailingSlash(configured);
}
