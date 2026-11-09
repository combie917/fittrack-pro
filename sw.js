/* FitTrack Pro service worker.
   - Pages: network first, falling back to the cached copy when offline.
   - Same-origin files and Firebase/fonts libraries: stale-while-revalidate.
   - Firestore / Auth API calls are never touched (the Firebase SDK handles offline itself).
   Bump VERSION whenever you change sw.js or the icons. */
const VERSION = 'fittrack-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(VERSION)
            .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

function cacheable(res) {
    return res && (res.ok || res.type === 'opaque');
}

function staleWhileRevalidate(request) {
    return caches.open(VERSION).then((cache) =>
        cache.match(request).then((hit) => {
            const network = fetch(request)
                .then((res) => { if (cacheable(res)) cache.put(request, res.clone()); return res; })
                .catch(() => hit);
            return hit || network;
        })
    );
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); }
                    return res;
                })
                .catch(() => caches.match('index.html').then((hit) => hit || caches.match('./')))
        );
        return;
    }

    const sameOrigin = url.origin === self.location.origin;
    const cdn = (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) ||
        url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

    if (sameOrigin || cdn) {
        event.respondWith(staleWhileRevalidate(req));
    }
    // everything else (Firestore, Auth, analytics) goes straight to the network
});
