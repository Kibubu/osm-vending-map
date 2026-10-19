/* Service worker: lets the map open and work on a weak or missing mobile signal.
 *
 * - App shell (HTML, CSS, JS, Leaflet): cached on install. The page itself is fetched from the
 *   network first but falls back to the cached copy after NAV_TIMEOUT_MS; versioned files
 *   (?v=…) and vendor/ are served from the cache.
 * - Vending data index (tiles/index.json): network first, cached copy after DATA_TIMEOUT_MS
 *   (marked with X-VM-Offline so the page can say it shows an offline copy). A late network
 *   answer still refreshes the cache.
 * - Vending data cells (tiles/c/*.json?h=<hash>): the hash changes with the content, so a cached
 *   cell with the same hash is served without asking the network. Without signal, an older copy
 *   of the same cell is served instead.
 * - Map tiles: every tile you have seen is kept (up to MAX_TILES, oldest dropped first) and served
 *   from the cache; tiles older than TILE_MAX_AGE_MS are refreshed in the background.
 *   Nothing is prefetched (OSM tile usage policy).
 *
 * Bump VERSION together with the ?v= query strings in index.html on every deploy.
 */
const VERSION = '20';
const SHELL_CACHE = `vm-shell-v${VERSION}`;
const DATA_CACHE = 'vm-data';
const TILE_CACHE = 'vm-tiles';

const SHELL_FILES = [
  './',
  'land.html',
  `style.css?v=${VERSION}`,
  `i18n.js?v=${VERSION}`,
  `osm.js?v=${VERSION}`,
  `app.js?v=${VERSION}`,
  `search.js?v=${VERSION}`,
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/leaflet.js',
  'vendor/markercluster/MarkerCluster.css',
  'vendor/markercluster/MarkerCluster.Default.css',
  'vendor/markercluster/leaflet.markercluster.js',
];
const DATA_PATH = 'tiles/index.json';
const CELL_PATH = 'tiles/c/';
const TILE_HOSTS = new Set(['tile.openstreetmap.org', 'server.arcgisonline.com', 'services.arcgisonline.com', 'clarity.maptiles.arcgis.com']);

const NAV_TIMEOUT_MS = 4000;
const DATA_TIMEOUT_MS = 6000;
const TILE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MAX_TILES = 3000;          // ~50–90 MB with satellite tiles; the browser may evict more under pressure
const TRIM_EVERY = 50;           // check the tile count every n stored tiles

const scope = new URL(self.registration.scope);
const DATA_URL = new URL(DATA_PATH, scope).href;
const CELL_URL = new URL(CELL_PATH, scope).href;

self.addEventListener('install', (event) => {
  // Default cache mode: right after the first visit these come out of the HTTP cache, so
  // installing costs (almost) no extra data on a slow connection.
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_FILES);
    try {
      const res = await fetch(DATA_URL);
      if (res.ok) await (await caches.open(DATA_CACHE)).put(DATA_URL, res);
    } catch { /* fetched again on next use */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE, TILE_CACHE]);
    for (const key of await caches.keys()) if (key.startsWith('vm-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (TILE_HOSTS.has(url.hostname)) { event.respondWith(tile(event)); return; }
  if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return;

  if (req.mode === 'navigate') { event.respondWith(page(event)); return; }
  if (url.origin + url.pathname === DATA_URL) { event.respondWith(data(event)); return; }
  if (url.href.startsWith(CELL_URL)) { event.respondWith(cell(event)); return; }
  event.respondWith(shellAsset(req));
});

/** Resolves with the network response, or with null after ms (the fetch keeps running). */
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function page(event) {
  const req = event.request;
  const key = new URL(req.url);
  key.search = ''; key.hash = '';
  const cache = await caches.open(SHELL_CACHE);
  const network = fetch(req).then((res) => {
    // A redirected response can't answer a later navigation, so only plain 200s are kept.
    if (res.ok && !res.redirected) event.waitUntil(cache.put(key.href, res.clone()));
    return res;
  });
  network.catch(() => {});
  const isIndex = key.href === scope.href || key.href === scope.href + 'index.html';
  const cached = (await cache.match(key.href)) || (isIndex ? await cache.match(scope.href) : undefined);
  if (!cached) return network;
  try {
    return (await withTimeout(network, NAV_TIMEOUT_MS)) || cached;
  } catch {
    return cached;
  }
}

async function shellAsset(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function data(event) {
  const cache = await caches.open(DATA_CACHE);
  const network = fetch(event.request).then((res) => {
    if (res.ok) event.waitUntil(cache.put(DATA_URL, res.clone()));
    return res;
  });
  network.catch(() => {});
  const cached = await cache.match(DATA_URL);
  if (!cached) return network;
  const offline = async () => {
    const headers = new Headers(cached.headers);
    headers.set('X-VM-Offline', '1');
    return new Response(await cached.blob(), { status: 200, headers });
  };
  try {
    const res = await withTimeout(network, DATA_TIMEOUT_MS);
    return res && res.ok ? res : offline();
  } catch {
    return offline();
  }
}

async function cell(event) {
  const req = event.request;
  const cache = await caches.open(DATA_CACHE);
  const exact = await cache.match(req.url);
  if (exact) return exact;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil((async () => {
        // Keep one copy per cell: drop versions with another hash.
        for (const old of await cache.keys(req.url, { ignoreSearch: true })) await cache.delete(old);
        await cache.put(req.url, copy);
      })());
      return res;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const older = await cache.match(req.url, { ignoreSearch: true });
    if (!older) throw err;
    const headers = new Headers(older.headers);
    headers.set('X-VM-Offline', '1');
    return new Response(await older.blob(), { status: 200, headers });
  }
}

let storedTiles = 0;
async function tile(event) {
  const req = event.request;
  const cache = await caches.open(TILE_CACHE);
  const store = async (res) => {
    // Opaque (no-CORS) responses would count several MB each against the storage quota.
    if (!res.ok || res.type === 'opaque') return;
    await cache.put(req.url, res);
    if (++storedTiles % TRIM_EVERY === 0) await trimTiles(cache);
  };
  const cached = await cache.match(req.url);
  if (cached) {
    const age = Date.now() - new Date(cached.headers.get('date') || 0).getTime();
    if (age > TILE_MAX_AGE_MS && self.navigator.onLine !== false) {
      event.waitUntil(fetch(req).then(store).catch(() => {}));
    }
    return cached;
  }
  const res = await fetch(req);
  event.waitUntil(store(res.clone()).catch(() => {}));
  return res;
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}
