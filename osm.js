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
      clientId: 'fuY9JrJw19145JBKU5O9NkjN4Qf_rcfzDl1WRdcnds4', // dev-server OAuth2 client (PKCE, no secret)
    },
  };
  const APP_NAME = 'osm-vending-map';
  const tr = (key, fallback) => (window.I18N ? window.I18N.t(key) : fallback);
  const APP_VERSION = '1.1';
  const HASHTAG = '#osm-vending-map';
  const SCOPE = 'read_prefs write_api';

  const isDev = new URLSearchParams(location.search).get('osm') === 'dev';
  const cfg = isDev ? CONFIG.dev : CONFIG.live;
  const TOKEN_KEY = `osm-token-${isDev ? 'dev' : 'live'}`;
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

  // ---------- login: full-page redirect (no popup) ----------
  // Popups are unreliable with OSM: its Cross-Origin-Opener-Policy severs the popup from this
  // page, blockers interfere and phones open tabs. So we redirect this tab to OSM, land.html
  // sends us back here, and the pending action (payload) survives in sessionStorage.
  const PENDING_KEY = 'osm-oauth-pending';
  const SESSION_RESULT_KEY = 'osm-oauth-result';
  const sstore = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  };

  /** Leaves the page to log in at OSM. `payload` is handed back by resume() after the round trip. */
  async function login(payload) {
    if (!isConfigured()) throw new Error(tr('osm.notConfigured', 'Direct upload is not configured (missing OAuth Client ID).'));
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
    sstore.del(SESSION_RESULT_KEY);
    const pending = JSON.stringify({ verifier, state, payload: payload || null, returnTo: location.href, t: Date.now() });
    // sessionStorage is per tab; localStorage is the fallback if the login ends in another tab.
    sstore.set(PENDING_KEY, pending);
    store.set(PENDING_KEY, pending);
    location.assign(`${cfg.web}/oauth2/authorize?${params}`);
    return new Promise(() => {}); // the page is navigating away
  }

  /**
   * Call once on page load. If we just came back from the OSM login, exchanges the code for a
   * token and returns { user, payload }. Returns null when there is nothing to resume.
   * Throws an Error with `.payload` attached if the login failed.
   */
  async function resume() {
    const rawResult = sstore.get(SESSION_RESULT_KEY);
    if (!rawResult) return null;
    const rawPending = sstore.get(PENDING_KEY) || store.get(PENDING_KEY);
    sstore.del(PENDING_KEY);
    store.del(PENDING_KEY);
    sstore.del(SESSION_RESULT_KEY);
    if (!rawPending) return null;
    let pending, result;
    try { pending = JSON.parse(rawPending); result = JSON.parse(rawResult); } catch { return null; }
    const fail = (msg) => { const e = new Error(msg); e.payload = pending.payload; throw e; };
    if (result.error) fail(result.error === 'access_denied' ? tr('osm.loginCancelled', 'Login was cancelled on OpenStreetMap.') : `Login failed: ${result.error}`);
    if (!result.code || result.state !== pending.state) fail(tr('osm.stateMismatch', 'Login failed: state mismatch — please try again.'));
    if (Date.now() - pending.t > 30 * 60 * 1000) fail(tr('osm.tooLong', 'Login took too long — please try again.'));

    const res = await fetch(`${cfg.web}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: result.code,
        redirect_uri: REDIRECT_URI,
        client_id: cfg.clientId,
        code_verifier: pending.verifier,
      }),
    });
    if (!res.ok) fail(`Token exchange failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    if (!json.access_token) fail('Token exchange failed: no access token.');
    store.set(TOKEN_KEY, json.access_token);
    user = null;
    return { user: await currentUser(), payload: pending.payload };
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
      const err = new Error(tr('osm.expired', 'Your OSM login expired — please log in again.'));
      err.status = 401;
      throw err;
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      const err = new Error(`OSM API error ${res.status}: ${body}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
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
    // Every failure is tagged with the step it happened in (and the changeset, if one was opened),
    // so the app can log it and decide whether a retry might create a duplicate.
    const step = async (name, fn, extra) => {
      try { return await fn(); } catch (e) {
        e.step = name;
        if (extra) Object.assign(e, extra);
        if (!navigator.onLine) e.offline = true;
        throw e;
      }
    };
    const csRes = await step('changeset/create', () => api('/api/0.6/changeset/create', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml' },
      body: `<osm><changeset>${tagsXml(csTags)}</changeset></osm>`,
    }));
    const changesetId = (await csRes.text()).trim();
    try {
      const change = `<osmChange version="0.6" generator="${APP_NAME}"><create>` +
        `<node id="-1" changeset="${changesetId}" lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">${tagsXml(tags)}</node>` +
        `</create></osmChange>`;
      const diff = await step('changeset/upload', () => api(`/api/0.6/changeset/${changesetId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: change,
      }), { changesetId });
      const doc = new DOMParser().parseFromString(await diff.text(), 'text/xml');
      const nodeId = doc.querySelector('node')?.getAttribute('new_id');
      if (!nodeId) {
        // The upload was accepted but the answer is unreadable: the node may exist.
        const e = new Error('OSM accepted the upload but returned no node id.');
        Object.assign(e, { step: 'changeset/upload', changesetId, maybeCreated: true });
        throw e;
      }
      return {
        nodeId,
        changesetId,
        nodeUrl: `${cfg.web}/node/${nodeId}`,
        changesetUrl: `${cfg.web}/changeset/${changesetId}`,
      };
    } catch (e) {
      // A network error during the upload means we can't know whether the node was created.
      if (e.step === 'changeset/upload' && !e.status) e.maybeCreated = true;
      throw e;
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

  /** Fetches one vending machine by type/id for shared links. Returns { lat, lon, tags } or null. */
  async function fetchElement(type, id) {
    if (!/^(node|way)$/.test(type) || !/^\d+$/.test(String(id))) return null;
    const path = type === 'node' ? `/api/0.6/node/${id}.json` : `/api/0.6/way/${id}/full.json`;
    const res = await fetch(cfg.api + path);
    if (!res.ok) return null; // deleted (410) or unknown (404)
    const els = (await res.json()).elements || [];
    const el = els.find((e) => e.type === type && String(e.id) === String(id));
    if (!el) return null;
    if (type === 'node') return { lat: el.lat, lon: el.lon, tags: el.tags || {} };
    const nodes = els.filter((e) => e.type === 'node');
    if (!nodes.length) return null;
    return {
      lat: nodes.reduce((a, n) => a + n.lat, 0) / nodes.length,
      lon: nodes.reduce((a, n) => a + n.lon, 0) / nodes.length,
      tags: el.tags || {},
    };
  }

  window.OSMClient = {
    isDev, isConfigured, isLoggedIn, login, resume, logout, currentUser,
    createNode, createNote, nearbyVending, fetchElement,
    web: cfg.web, siteUrl: SITE_URL, hashtag: HASHTAG, appName: APP_NAME,
  };
})();
