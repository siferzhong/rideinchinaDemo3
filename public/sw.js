/* Ride In China - Service Worker：离线缓存应用壳与基础资源 */
const CACHE_NAME = 'ride-in-china-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/index.css',
];

const EXTERNAL_PREFETCH = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://webapi.amap.com/maps?v=2.0&key=7669d040ad427ec4d361f7bbd152e6e3&plugin=AMap.Autocomplete,AMap.PlaceSearch,AMap.Driving',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).then(() => {
        return Promise.allSettled(
          EXTERNAL_PREFETCH.map((url) =>
            fetch(url, { mode: 'cors' }).then((res) => {
              if (res.ok) return cache.put(url, res);
            })
          )
        );
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !EXTERNAL_PREFETCH.some((u) => url.href.startsWith(u))) {
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const clone = res.clone();
        if (res.ok && (request.method === 'GET') && (url.origin === self.location.origin || EXTERNAL_PREFETCH.some((u) => url.href.startsWith(u)))) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503, statusText: 'Offline' }));
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
