const CACHE_NAME = 'karya-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/app.js',
    '/js/router.js',
    '/js/utils.js',
    '/js/api.js',
    '/js/config.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('firestore') || e.request.url.includes('googleapis')) return;
    e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});