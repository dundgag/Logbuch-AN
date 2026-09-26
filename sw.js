/* Anästhesie-Logbuch – Service Worker (Offline-Betrieb)
 *
 * - Die App selbst (index.html) wird "Netz zuerst" geladen: online kommt
 *   immer die neueste Version, offline die zuletzt gespeicherte.
 * - Bibliotheken von CDNs (feste Versionen) werden beim ersten Laden
 *   gespeichert und danach aus dem Speicher genommen – die App funktioniert
 *   dadurch auch ganz ohne Netz.
 * - Anfragen an Google (Synchronisierung) werden nie gespeichert.
 * Diese Datei gehört neben die index.html ins GitHub-Repository.
 */
const CACHE = 'logbuch-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/google(usercontent)?\.com$/.test(url.hostname)) return; // Sync nie zwischenspeichern

  // Bibliotheken: Speicher zuerst
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Eigene Dateien: Netz zuerst, offline aus dem Speicher
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
  }
});
