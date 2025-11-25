// sw.js
const CACHE_NAME = 'karya-shell-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/app.js',
    '/js/router.js',
    '/js/utils.js',
    '/js/api.js',
    '/js/config.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    // Network first for API/Firebase requests, Cache first for assets
    if (e.request.url.includes('firestore') || e.request.url.includes('googleapis')) {
        return; // Let Firebase SDK handle its own persistence
    }
    e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});