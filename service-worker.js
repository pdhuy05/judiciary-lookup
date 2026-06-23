'use strict';

/* =========================================================
   SERVICE WORKER — TRA CỨU NHÂN SỰ
   Cache-first cho tài sản tĩnh, network-first cho dữ liệu JSON
   ========================================================= */

const CACHE_VERSION = 'tracuu-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DATA_CACHE = CACHE_VERSION + '-data';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

const NETWORK_FIRST_PATTERNS = [/\/$/, /index\.html$/, /\/css\/style\.css$/, /\/js\/script\.js$/];

function isNetworkFirstAsset(pathname) {
  return NETWORK_FIRST_PATTERNS.some((re) => re.test(pathname));
}

/* ---------------------------------------------------------
   INSTALL: cache toàn bộ tài sản tĩnh
   --------------------------------------------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------------------------------------------------------
   ACTIVATE: xóa cache cũ
   --------------------------------------------------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ---------------------------------------------------------
   FETCH: chiến lược theo loại tài nguyên
   --------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Dữ liệu JSON: network-first, fallback cache (luôn cố lấy bản mới nhất)
  if (url.pathname.endsWith('/data/staffs.json') || url.pathname.endsWith('staffs.json')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  if (isNetworkFirstAsset(url.pathname)) {
    event.respondWith(networkFirst(event.request, STATIC_CACHE));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}