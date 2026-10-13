/* Minimal OpenStreetMap client for a static site:
 * - OAuth 2.0 login (Authorization Code + PKCE, public client, no secret)
 * - create a single node in its own changeset
 * - anonymous notes
 * - look up existing vending machines near a point
 *
 * Every upload is made with the visitor's own OSM account.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // CONFIG: register an OAuth2 app at https://www.openstreetmap.org/oauth2/applications/new
  //   - Redirect URIs: https://<user>.github.io/osm-vending-map/land.html
  //                    http://127.0.0.1:8000/land.html   (local testing)
  //   - "Confidential application": UNCHECKED
  //   - Permissions: "Read user preferences" + "Modify the map"
  // Then paste the Client ID below. It is public by design (PKCE, no secret).
  // For the dev/test server (open the site with ?osm=dev) register a second app at
  // https://master.apis.dev.openstreetmap.org/oauth2/applications/new.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    live: {
      web: 'https://www.openstreetmap.org',
      api: 'https://api.openstreetmap.org',
      clientId: 'qI6Aq2qyfA89Wf3rXP4l5Yg_T5oFEcgxn68l2cDthYw', // public OAuth2 client (PKCE, no secret)
    },
    dev: {
      web: 'https://master.apis.dev.openstreetmap.org',
      api: 'https://master.apis.dev.openstreetmap.org',
      clientId: '',            // ← optional: Client ID from the dev server
    },
  };
  const APP_NAME = 'osm-vending-map';
  const APP_VERSION = '1.1';
  const HASHTAG = '#osm-vending-map';
  const SCOPE = 'read_prefs write_api';

  const isDev = new URLSearchParams(location.search).get('osm') === 'dev';
  const cfg = isDev ? CONFIG.dev : CONFIG.live;
  const TOKEN_KEY = `osm-token-${isDev ? 'dev' : 'live'}`;
  const RESULT_KEY = 'osm-oauth-result';
  const REDIRECT_URI = location.origin + location.pathname.replace(/[^/]*$/, '') + 'land.html';
  const SITE_URL = location.origin + location.pathname.replace(/index\.html$/, '');

  // ---------- storage helpers (storage can throw in private mode) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  // ---------- PKCE ----------
  function b64url(bytes) {
    let s = '';
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function randomString(len = 48) {
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return b64url(a);
  }
  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return b64url(new Uint8Array(digest));
  }

  // ---------- auth ----------
  let user = null; // { id, display_name }

  function token() { return store.get(TOKEN_KEY); }
  function isConfigured() { return Boolean(cfg.clientId); }
  function isLoggedIn() { return Boolean(token()); }

  /** Opens the OSM login in a popup (new tab on phones) and resolves when land.html reports back. */
  async function login() {
    if (!isConfigured()) throw new Error('Direct upload is not configured (missing OAuth Client ID).');
    // Open the window synchronously (still inside the click) so pop-up blockers allow it.
    const popup = window.open('', 'osm-login', 'width=560,height=720');
    if (!popup) throw new Error('The login window was blocked — please allow pop-ups for this site.');
    const verifier = randomString(48);
    const state = randomString(16);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cfg.clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state,
      code_challenge: await challengeFor(verifier),
      code_challenge_method: 'S256',
    });
    store.del(RESULT_KEY);
    popup.location.href = `${cfg.web}/oauth2/authorize?${params}`;

    const result = await new Promise((resolve, reject) => {
      let done = false;
      const finish = (msg) => {
        if (done || !msg || msg.type !== 'osm-oauth') return;
        done = true;
        cleanup();
        resolve(msg);
      };
      const onMessage = (ev) => { if (ev.origin === location.origin) finish(ev.data); };
      const onStorage = (ev) => {
        if (ev.key === RESULT_KEY && ev.newValue) { try { finish(JSON.parse(ev.newValue)); } catch { /* ignore */ } }
      };
      const timer = setInterval(() => {
        // Fallback: poll storage; give up if the window was closed without an answer.
        const raw = store.get(RESULT_KEY);
        if (raw) { try { finish(JSON.parse(raw)); } catch { /* ignore */ } }
        else if (popup.closed) {
          setTimeout(() => { if (!done) { done = true; cleanup(); reject(new Error('Login window closed.')); } }, 800);
        }
      }, 500);
      function cleanup() {
        clearInterval(timer);
        window.removeEventListener('message', onMessage);
        window.removeEventListener('storage', onStorage);
        store.del(RESULT_KEY);
      }
      window.addEventListener('message', onMessage);
      window.addEventListener('storage', onStorage);
    });

    if (result.error) throw new Error(`Login failed: ${result.error}`);
    if (result.state !== state) throw new Error('Login failed: state mismatch.');

    const res = await fetch(`${cfg.web}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: result.code,
        redirect_uri: REDIRECT_URI,
        client_id: cfg.clientId,
        code_verifier: verifier,
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status}).`);
    const json = await res.json();
    if (!json.access_token) throw new Error('Token exchange failed: no access token.');
    store.set(TOKEN_KEY, json.access_token);
    user = null;
    return currentUser();
  }

  function logout() {
    const t = token();
    store.del(TOKEN_KEY);
    user = null;
    if (t && cfg.clientId) {
      fetch(`${cfg.web}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: t, client_id: cfg.clientId }),
      }).catch(() => {});
    }
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers);
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(cfg.api + path, Object.assign({}, opts, { headers }));
    if (res.status === 401) {
      store.del(TOKEN_KEY);
      user = null;
      throw new Error('Your OSM login expired — please log in again.');
    }
    if (!res.ok) throw new Error(`OSM API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }

  async function currentUser() {
    if (!isLoggedIn()) return null;
    if (user) return user;
    const res = await api('/api/0.6/user/details.json');
    const json = await res.json();
    user = { id: json.user.id, display_name: json.user.display_name };
    return user;
  }

  // ---------- writing ----------
  function xmlAttr(v) {
    return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
      .replace(/\n/g, '&#10;').replace(/\r/g, '').replace(/\t/g, '&#9;');
  }
  function tagsXml(tags) {
    return Object.entries(tags).map(([k, v]) => `<tag k="${xmlAttr(k)}" v="${xmlAttr(v)}"/>`).join('');
  }

  /**
   * Creates exactly one node in a new changeset and closes the changeset.
   * Returns { nodeId, changesetId, nodeUrl, changesetUrl }.
   */
  async function createNode(lat, lon, tags, comment) {
    if (!isLoggedIn()) throw new Error('Not logged in.');
    for (const [k, v] of Object.entries(tags)) {
      if (!k || k.length > 255 || String(v).length > 255) throw new Error(`Invalid tag ${k}=${v}`);
    }
    const csTags = {
      created_by: `${APP_NAME} ${APP_VERSION}`,
      comment: comment.slice(0, 255),
      hashtags: HASHTAG,
      host: SITE_URL,
    };
    const csRes = await api('/api/0.6/changeset/create', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml' },
      body: `<osm><changeset>${tagsXml(csTags)}</changeset></osm>`,
    });
    const changesetId = (await csRes.text()).trim();
    try {
      const change = `<osmChange version="0.6" generator="${APP_NAME}"><create>` +
        `<node id="-1" changeset="${changesetId}" lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">${tagsXml(tags)}</node>` +
        `</create></osmChange>`;
      const diff = await api(`/api/0.6/changeset/${changesetId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: change,
      });
      const doc = new DOMParser().parseFromString(await diff.text(), 'text/xml');
      const nodeId = doc.querySelector('node')?.getAttribute('new_id');
      return {
        nodeId,
        changesetId,
        nodeUrl: `${cfg.web}/node/${nodeId}`,
        changesetUrl: `${cfg.web}/changeset/${changesetId}`,
      };
    } finally {
      api(`/api/0.6/changeset/${changesetId}/close`, { method: 'PUT' }).catch(() => {});
    }
  }

  /** Anonymous note (works without login). Returns { id, url }. */
  async function createNote(lat, lon, text) {
    const res = await fetch(`${cfg.api}/api/0.6/notes.json`, {
      method: 'POST',
      body: new URLSearchParams({ lat: lat.toFixed(7), lon: lon.toFixed(7), text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const id = json && json.properties && json.properties.id;
    return { id, url: id ? `${cfg.web}/note/${id}` : cfg.web };
  }

  /** Live check for vending machines already in OSM near a point (radius in metres, approximate box). */
  async function nearbyVending(lat, lon, radius = 20) {
    const dLat = radius / 111320;
    const dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
    const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(7)).join(',');
    const res = await fetch(`${cfg.api}/api/0.6/map.json?bbox=${bbox}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.elements || [])
      .filter((e) => e.type === 'node' && e.tags && e.tags.amenity === 'vending_machine')
      .map((e) => ({ id: e.id, lat: e.lat, lon: e.lon, tags: e.tags, url: `${cfg.web}/node/${e.id}` }));
  }

  window.OSMClient = {
    isDev, isConfigured, isLoggedIn, login, logout, currentUser,
    createNode, createNote, nearbyVending,
    web: cfg.web, siteUrl: SITE_URL, hashtag: HASHTAG, appName: APP_NAME,
  };
})();
