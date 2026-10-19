/* Search box: vending machines in the loaded data (as you type) and places via Nominatim (on Enter). */
(function () {
  'use strict';

  const { t } = I18N;
  const VM = window.VM;
  const { map, esc } = VM;

  // Nominatim usage policy: no autocomplete, max. 1 request per second, identify via Referer.
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const NOMINATIM_GAP_MS = 1100;
  const MAX_MACHINES = 8;
  const MAX_PLACES = 6;

  const box = document.getElementById('search');
  const form = box.querySelector('form');
  const input = box.querySelector('input');
  const clearBtn = box.querySelector('.search-clear');
  const list = box.querySelector('.search-results');

  // Lowercase, without accents, so "cafe" finds "Café" and "strasse" finds "Straße".
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/ß/g, 'ss').replace(/[_;,]+/g, ' ');

  // ---------- Machines ----------
  /** Text a machine can be found by, in the current language (rebuilt on language change). */
  const hayCache = new WeakMap();
  function haystack(e) {
    let h = hayCache.get(e);
    if (h && h.lang === I18N.lang) return h.text;
    const p = e.props;
    const vend = (p.vending || '').split(/[;,]/).filter((v) => v.trim());
    const parts = [p.name, p.brand, p.operator, p.note, ...vend, ...vend.map(VM.itemLabel),
      ...e.cats.map((c) => VM.typeOf(c).label)];
    h = { lang: I18N.lang, text: norm(parts.filter(Boolean).join(' ')) };
    hayCache.set(e, h);
    return h.text;
  }

  function findMachines(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return { hits: [], total: 0 };
    const center = map.getCenter();
    const hits = VM.entries
      .filter((e) => { const h = haystack(e); return words.every((w) => h.includes(w)); })
      .map((e) => ({ e, dist: center.distanceTo(e.marker.getLatLng()) }))
      .sort((a, b) => a.dist - b.dist);
    return { hits: hits.slice(0, MAX_MACHINES), total: hits.length };
  }

  function fmtDist(m) {
    return m < 1000 ? `${I18N.fmtNum(Math.round(m / 10) * 10)} m` : `${I18N.fmtNum(Math.round(m / 100) / 10)} km`;
  }

  // ---------- Places (Nominatim) ----------
  const placeCache = new Map();
  let lastPlaceReq = 0;
  let placeCtrl = null;

  async function findPlaces(q) {
    const key = `${I18N.lang}|${q}`;
    if (placeCache.has(key)) return placeCache.get(key);
    if (placeCtrl) placeCtrl.abort();
    const ctrl = placeCtrl = new AbortController();
    const wait = lastPlaceReq + NOMINATIM_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (ctrl.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    lastPlaceReq = Date.now();
    // Prefer results near the current view, but don't exclude the rest of the world.
    const b = map.getBounds().pad(0.5);
    const params = new URLSearchParams({
      q, format: 'jsonv2', limit: String(MAX_PLACES), 'accept-language': I18N.lang,
      viewbox: [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].map((n) => n.toFixed(4)).join(','),
    });
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${NOMINATIM}?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const places = (await res.json()).map((p) => ({
        name: p.name || p.display_name.split(',')[0],
        detail: p.display_name,
        lat: Number(p.lat), lon: Number(p.lon),
        bbox: p.boundingbox && p.boundingbox.map(Number), // [south, north, west, east]
      })).filter((p, i, all) => all.findIndex((o) => o.detail === p.detail) === i); // e.g. a town and its municipality
      placeCache.set(key, places);
      return places;
    } finally {
      clearTimeout(timer);
      if (placeCtrl === ctrl) placeCtrl = null;
    }
  }

  /** "51.1254, 9.2814" (or with a space) → { lat, lon }. */
  function parseCoords(q) {
    const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]), lon = Number(m[2]);
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
  }

  // ---------- Results list ----------
  let items = [];      // [{ el, run }]
  let active = -1;
  let places = null;   // null: not searched yet for this text; [] none found
  let placeState = ''; // '', 'busy', 'error'
  let placeErr = '';

  function render() {
    const q = input.value.trim();
    clearBtn.hidden = !input.value;
    if (!q) { close(); return; }
    const parts = [];
    items = [];
    const add = (html, run, cls) => {
      const i = items.length;
      items.push({ run });
      parts.push(`<li role="option" id="search-opt-${i}" class="search-item ${cls || ''}" data-i="${i}">${html}</li>`);
    };
    const head = (text) => parts.push(`<li class="search-head" role="presentation">${esc(text)}</li>`);

    const coords = parseCoords(q);
    if (coords) {
      head(t('search.coords'));
      add(`<span class="si-icon">📍</span><span class="si-text"><b>${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}</b></span>`,
        () => goTo(coords.lat, coords.lon, null, `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`));
    }

    const { hits, total } = findMachines(q);
    head(total ? t('search.machines', { n: I18N.fmtNum(total) }) : t('search.machinesNone'));
    for (const { e, dist } of hits) {
      const ty = VM.typeOf(e.cats[0]);
      const p = e.props;
      const vend = (p.vending || '').split(/[;,]/).filter((v) => v.trim()).map(VM.itemLabel).join(', ');
      const title = p.name || p.brand || vend || ty.label;
      const sub = [title !== vend ? vend : '', p.operator && p.operator !== title ? p.operator : ''].filter(Boolean).join(' · ');
      add(`<span class="si-icon" style="background:${ty.color}">${ty.emoji}</span>` +
        `<span class="si-text"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>` +
        `<span class="si-dist">${esc(fmtDist(dist))}</span>`,
      () => { close(); input.blur(); VM.selectMachine(e.id, true); });
    }
    if (total > hits.length) parts.push(`<li class="search-more" role="presentation">${esc(t('search.more', { n: I18N.fmtNum(total - hits.length) }))}</li>`);

    head(t('search.places'));
    if (placeState === 'busy') {
      parts.push(`<li class="search-note busy" role="presentation">${esc(t('search.searching'))}</li>`);
    } else if (placeState === 'error') {
      parts.push(`<li class="search-note warn" role="presentation">${esc(placeErr)}</li>`);
      add(`<span class="si-icon">🔁</span><span class="si-text">${esc(t('search.retry'))}</span>`, searchPlaces);
    } else if (places) {
      if (!places.length) parts.push(`<li class="search-note" role="presentation">${esc(t('search.placesNone'))}</li>`);
      for (const pl of places) {
        add(`<span class="si-icon">📍</span><span class="si-text"><b>${esc(pl.name)}</b><small>${esc(pl.detail)}</small></span>`,
          () => goTo(pl.lat, pl.lon, pl.bbox, pl.name));
      }
    } else {
      add(`<span class="si-icon">🔍</span><span class="si-text">${esc(t('search.findPlace', { q }))}</span>`, searchPlaces, 'search-place-btn');
    }

    list.innerHTML = parts.join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(Math.min(active, items.length - 1));
  }

  function setActive(i) {
    active = i;
    list.querySelectorAll('.search-item').forEach((li) => li.classList.toggle('active', Number(li.dataset.i) === i));
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', `search-opt-${i}`);
      const li = list.querySelector(`#search-opt-${i}`);
      if (li) li.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function close() {
    list.hidden = true;
    list.innerHTML = '';
    items = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  async function searchPlaces() {
    const q = input.value.trim();
    if (!q) return;
    placeState = 'busy';
    render();
    try {
      const res = await findPlaces(q);
      if (input.value.trim() !== q) return; // the text changed meanwhile
      places = res;
      placeState = '';
      render();
    } catch (e) {
      if (e.name === 'AbortError' && input.value.trim() !== q) return;
      placeState = 'error';
      placeErr = navigator.onLine ? t('search.failed') : t('search.offline');
      render();
    }
  }

  // ---------- Showing a place ----------
  let marker = null;
  function goTo(lat, lon, bbox, label) {
    close();
    input.blur();
    if (marker) map.removeLayer(marker);
    marker = L.circleMarker([lat, lon], { radius: 9, weight: 3, color: '#d1242f', fillColor: '#fff', fillOpacity: 0.9 })
      .bindTooltip(esc(label), { direction: 'top', offset: [0, -8] })
      .addTo(map);
    marker.on('click', () => { map.removeLayer(marker); marker = null; });
    if (bbox && bbox.every(Number.isFinite) && (bbox[1] - bbox[0] > 0.002 || bbox[3] - bbox[2] > 0.002)) {
      map.fitBounds([[bbox[0], bbox[2]], [bbox[1], bbox[3]]], { maxZoom: 17 });
    } else {
      map.setView([lat, lon], Math.max(map.getZoom(), 17));
    }
  }

  // ---------- Events ----------
  input.addEventListener('input', () => {
    places = null;
    placeState = '';
    if (placeCtrl) placeCtrl.abort();
    active = -1;
    render();
  });
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) { render(); return; }
      e.preventDefault();
      const n = items.length;
      if (!n) return;
      setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
    } else if (e.key === 'Escape') {
      if (!list.hidden) close(); else { input.value = ''; clearBtn.hidden = true; input.blur(); }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) { items[active].run(); return; }
    const coords = parseCoords(input.value);
    if (coords) { goTo(coords.lat, coords.lon, null, input.value.trim()); return; }
    // Enter without a highlighted row: look up places (that's what Enter is for in a map search).
    // A second Enter goes to the best place found.
    if (places && places.length) { const p = places[0]; goTo(p.lat, p.lon, p.bbox, p.name); return; }
    if (!places && placeState !== 'busy') searchPlaces();
  });
  // mousedown (not click) so it runs before the input loses focus
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.search-item');
    if (!li) return;
    e.preventDefault();
    const it = items[Number(li.dataset.i)];
    if (it) it.run();
  });
  list.addEventListener('mousemove', (e) => {
    const li = e.target.closest('.search-item');
    if (li && Number(li.dataset.i) !== active) setActive(Number(li.dataset.i));
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    places = null;
    placeState = '';
    close();
    clearBtn.hidden = true;
    if (marker) { map.removeLayer(marker); marker = null; }
    input.focus();
  });
  document.addEventListener('mousedown', (e) => { if (!box.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => {
    // "/" focuses the search, like on many map sites (not while typing elsewhere).
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      e.preventDefault();
      input.focus();
    }
  });
  L.DomEvent.disableClickPropagation(box);
  L.DomEvent.disableScrollPropagation(box);

  function relocalize() {
    input.placeholder = t('search.placeholder');
    input.setAttribute('aria-label', t('search.placeholder'));
    clearBtn.title = t('search.clear');
    clearBtn.setAttribute('aria-label', t('search.clear'));
    if (!list.hidden) { places = null; placeState = ''; render(); }
  }
  I18N.onChange(relocalize);
  relocalize();
})();
