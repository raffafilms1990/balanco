// Offline cache for Balanço. Bump VERSION when any file changes.
// The page itself is network-first (an update shows up on the next open when online);
// everything else is cache-first. Files are always fetched with cache:'reload' so a
// stale copy from GitHub's 10-minute HTTP cache never gets saved as the new version.
const VERSION = 'balanco-v3';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png',
  './vendor/pdf.min.mjs', './vendor/pdf.worker.min.mjs'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  const fromNet = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); }
    return res;
  });
  // weak signal: don't make the user wait more than 3 s for the network
  const timeout = new Promise(resolve => setTimeout(resolve, 3000)).then(() => caches.match('./index.html'));
  return Promise.race([fromNet.catch(() => caches.match('./index.html')), timeout])
    .then(res => res || fromNet)
    .catch(() => caches.match('./index.html'));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage) { e.respondWith(networkFirst(e.request)); return; }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
