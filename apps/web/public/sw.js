const SHELL_CACHE = 'vire-shell-v1';
const STATIC_CACHE = 'vire-static-v1';
const IMG_CACHE = 'vire-img-v1';
// Не версионируем: это реестр скачанного пользователем, не часть шелла — activate() его не трогает.
const OFFLINE_CACHE = 'vire-offline-v1';

const CACHE_PREFIX = 'vire-';
const CURRENT_CACHES = new Set([SHELL_CACHE, STATIC_CACHE, IMG_CACHE, OFFLINE_CACHE]);
const IMG_CACHE_LIMIT = 200;
// /offline живёт под app/[locale]/offline — ru без префикса, en под /en.
const PRECACHE_URLS = ['/offline', '/en/offline', '/icon-192.png', '/icon-512.png'];

function offlineFallbackPath(pathname) {
  return pathname === '/en' || pathname.startsWith('/en/') ? '/en/offline' : '/offline';
}
// Ключ владельца шелл-кэша — синтетический Request внутри самого Cache Storage,
// отдельный IndexedDB не заводим ради одной строки.
const OWNER_KEY = '/__owner';

function strategyFor(url, request) {
  if (request.method !== 'GET') return 'bypass';
  if (request.mode === 'navigate') return 'navigate';

  const pathname = url.pathname;

  if (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    request.destination === 'font' ||
    /\.(woff2?|ttf|otf)$/.test(pathname)
  ) {
    return 'static';
  }

  if (request.destination === 'image' || pathname.startsWith('/_next/image')) {
    // Чужие домены не трогаем: fetch из воркера идёт под connect-src, который их не пускает,
    // и перехват ломал бы картинку, которую браузер сам загрузил бы по img-src.
    return url.origin === self.location.origin ? 'image' : 'bypass';
  }

  if (/^\/api\/v1\/tracks\/[^/]+\/manifest$/.test(pathname)) {
    return 'manifest';
  }

  if (pathname.endsWith('.m3u8') || pathname.endsWith('.ts')) {
    return 'hls';
  }

  return 'bypass';
}

async function trimCache(cache, limit) {
  const keys = await cache.keys();
  const excess = keys.length - limit;
  if (excess <= 0) return;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(PRECACHE_URLS);
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(offlineFallbackPath(new URL(request.url).pathname));
    if (offline) return offline;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidateImage(request, event) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
        await trimCache(cache, IMG_CACHE_LIMIT);
      }
      return response;
    })
    .catch(() => undefined);
  // Без waitUntil браузер вправе усыпить воркер сразу после ответа из кэша — фоновое обновление не доедет.
  if (cached) {
    if (event) event.waitUntil(networkPromise);
    return cached;
  }
  const network = await networkPromise;
  if (network) return network;
  // Бросок здесь всплывал бы «Uncaught (in promise)» в консоли на каждой картинке офлайна.
  return Response.error();
}

// Пишет сюда только явная загрузка со страницы: иначе прослушивание копило бы манифесты
// треков без сегментов, и офлайн-плеер брался бы играть то, чего в кэше нет.
async function networkThenCacheFallback(request, cacheName) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('manifest fetch failed, no cache');
  }
}

// Только по попаданию: промах не пишет в кэш — сегменты кладёт туда явная загрузка со страницы.
async function cacheOnlyElseNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  return fetch(request);
}

async function purgeAll() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
}

// Корневой layout персонализирован (Nav/таб-бар из сессии) — HTML-шелл прошлого
// аккаунта на общем устройстве утёк бы следующему; при смене owner пересобираем шелл.
async function setOwner(id) {
  const ownerId = id || 'anon';
  const cache = await caches.open(SHELL_CACHE);
  const savedResponse = await cache.match(OWNER_KEY);
  const saved = savedResponse ? await savedResponse.text() : null;
  if (saved === ownerId) return;

  await caches.delete(SHELL_CACHE);
  await precacheShell();
  const freshCache = await caches.open(SHELL_CACHE);
  await freshCache.put(new Request(OWNER_KEY), new Response(ownerId));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const strategy = strategyFor(url, request);

  if (strategy === 'navigate') {
    event.respondWith(networkOnlyWithOfflineFallback(request));
  } else if (strategy === 'static') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (strategy === 'image') {
    event.respondWith(staleWhileRevalidateImage(request, event));
  } else if (strategy === 'manifest') {
    event.respondWith(networkThenCacheFallback(request, OFFLINE_CACHE));
  } else if (strategy === 'hls') {
    event.respondWith(cacheOnlyElseNetwork(request, OFFLINE_CACHE));
  }
  // 'bypass' — не вызываем respondWith, браузер идёт в сеть сам.
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'PURGE_ALL') {
    event.waitUntil(purgeAll());
  } else if (data.type === 'SET_OWNER') {
    event.waitUntil(setOwner(data.id));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'VireMusic';
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});

self.__test = {
  strategyFor,
  trimCache,
  offlineFallbackPath,
  SHELL_CACHE,
  STATIC_CACHE,
  IMG_CACHE,
  OFFLINE_CACHE,
  IMG_CACHE_LIMIT,
};
