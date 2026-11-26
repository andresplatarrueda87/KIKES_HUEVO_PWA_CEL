const CACHE_NAME = 'kikes-huevo-cauca-cel-v19';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './egg.svg',
  './Kikes_image_1.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './favicon.ico',
  './lib/chart.umd.min.js',
  './lib/xlsx.full.min.js',
  './lib/mqtt.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('google.com')) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((c) => c || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
