/* eslint-disable */
// k6-сценарий «путь слушателя» — нагрузочный тест VireMusic (§9.5 дорожной карты).
//
// k6 — отдельный бинарь (https://k6.io), не npm-пакет. Установка: `winget install k6`
// (Windows) / `brew install k6` (macOS) / `apt install k6` (Linux).
//
// Запуск (примеры):
//   k6 run scripts/loadtest/listener-journey.js
//   BASE_URL=https://viremusic.ru VUS=50 DURATION=2m k6 run scripts/loadtest/listener-journey.js
//   BASE_URL=http://localhost:3000 ARTIST_SLUG=kotlaev RELEASE_ID=… TRACK_ID=… k6 run ...
//
// Цель — найти потолок одновременных слушателей: при каком VUS p95-латентность и
// доля ошибок начинают расти. Параллельно смотри /admin/system (RAM/CPU/очереди),
// чтобы увидеть, во что упирается (память/CPU/Postgres). Тестируем Next-приложение
// (страницы + API); HLS-сегменты отдаёт CDN/S3 отдельно и здесь не нагружаются.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '1m';

// Опциональные id для детальных страниц/манифеста — без них шаги пропускаются.
const ARTIST_SLUG = __ENV.ARTIST_SLUG || '';
const RELEASE_ID = __ENV.RELEASE_ID || '';
const TRACK_ID = __ENV.TRACK_ID || '';

const errors = new Rate('journey_errors');

export const options = {
  scenarios: {
    listeners: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: VUS },          // разгон
        { duration: DURATION, target: VUS },        // плато
        { duration: '10s', target: 0 },             // спад
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],                 // <2% ошибок
    http_req_duration: ['p(95)<1500'],              // p95 < 1.5с
    journey_errors: ['rate<0.02'],
  },
};

function get(path, name) {
  const res = http.get(`${BASE}${path}`, { tags: { name } });
  const ok = check(res, { [`${name} 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400 });
  errors.add(!ok);
  return res;
}

export default function () {
  group('discovery', () => {
    get('/', 'home');
    sleep(1);
    get('/artists', 'artists');
    get('/releases', 'releases');
    get('/search?q=a', 'search');
  });

  group('content', () => {
    if (ARTIST_SLUG) get(`/artists/${ARTIST_SLUG}`, 'artist');
    if (ARTIST_SLUG && RELEASE_ID) get(`/artists/${ARTIST_SLUG}/releases/${RELEASE_ID}`, 'release');
    // Эндпоинт, который реально дёргает плеер перед воспроизведением:
    if (TRACK_ID) get(`/api/v1/tracks/${TRACK_ID}/manifest`, 'manifest');
  });

  group('infra', () => {
    get('/api/health', 'health');
  });

  sleep(Math.random() * 2 + 1); // «думает» 1–3с, как живой слушатель
}
