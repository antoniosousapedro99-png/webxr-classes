// Always use the latest version of every file.
// GitHub Pages lets browsers reuse files for 10 minutes, so straight after an update a headset could mix
// new and old files (and a lesson could fail to start). This worker asks the server every time instead;
// unchanged files come back as a quick "not modified", so nothing is downloaded twice.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // (a page request can't be copied with new options, so it is fetched by URL)
  const fresh = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(req, { cache: 'no-cache' });
  e.respondWith(fresh.catch(() => fetch(req)));
});
