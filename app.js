/* Vending machine map — static frontend. Data: data/vending.geojson (prebuilt). */
(function () {
  'use strict';

  const DATA_URL = 'data/vending.geojson';

  // Order matters: the first matching type picks the marker icon.
  const TYPES = [
    { key: 'drinks',                   label: 'Drinks',            emoji: '🥤', color: '#1f77b4' },
    { key: 'sweets',                   label: 'Sweets',            emoji: '🍫', color: '#d62781' },
    { key: 'food',                     label: 'Food',              emoji: '🥪', color: '#2ca02c' },
    { key: 'cigarettes',               label: 'Cigarettes',        emoji: '🚬', color: '#7f4f24' },
    { key: 'parking_tickets',          label: 'Parking tickets',   emoji: '🅿️', color: '#3949ab' },
    { key: 'public_transport_tickets', label: 'Transport tickets', emoji: '🎫', color: '#e67700' },
    { key: 'other',                    label: 'Other / unknown',   emoji: '📦', color: '#6c757d' },
  ];
  const TYPE_BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));
  const KNOWN = new Set(TYPES.map((t) => t.key).filter((k) => k !== 'other'));

  const $ = (id) => document.getElementById(id);

  // ---------- Map ----------
  const map = L.map('map', { zoomControl: true, worldCopyJump: true }).setView([51.16, 10.45], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
  });
  map.addLayer(cluster);

  // ---------- Helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Split "drinks;sweets" (or the common mistake "drinks,sweets") into known categories; anything else maps to "other". */
  function categoriesOf(props) {
    const raw = (props.vending || '').split(/[;,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const cats = [];
    for (const v of raw) {
      const k = KNOWN.has(v) ? v : 'other';
      if (!cats.includes(k)) cats.push(k);
    }
    return cats.length ? cats : ['other'];
  }

  const iconCache = {};
  function iconFor(typeKey) {
    if (!iconCache[typeKey]) {
      const t = TYPE_BY_KEY[typeKey];
      iconCache[typeKey] = L.divIcon({
        className: 'vm-icon',
        html: `<div class="vm-pin" style="background:${t.color}">${t.emoji}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      });
    }
    return iconCache[typeKey];
  }

  function prettyKey(k) {
    return k.replace(/^payment:/, '').replace(/_/g, ' ');
  }
  function prettyVal(v) {
    if (v === 'yes') return '✅';
    if (v === 'no') return '❌';
    return esc(v);
  }

  function popupHtml(props, cats) {
    const type = props.osm_type, id = props.osm_id;
    const title = props.name || props.brand || (TYPE_BY_KEY[cats[0]] || {}).label || 'Vending machine';
    const rows = [];
    rows.push(['Type', esc(props.vending || 'unknown').replace(/;/g, ', ')]);
    for (const k of ['operator', 'brand', 'opening_hours', 'level', 'note']) {
      if (props[k] != null && props[k] !== '') rows.push([k.replace('_', ' '), esc(props[k])]);
    }
    const payments = Object.keys(props).filter((k) => k.startsWith('payment:')).sort();
    if (payments.length) {
      rows.push(['payment', payments.map((k) => `${esc(prettyKey(k))} ${prettyVal(props[k])}`).join('<br>')]);
    }
    const tags = cats.map((c) => {
      const t = TYPE_BY_KEY[c];
      return `<span class="tag" style="background:${t.color}">${t.emoji} ${esc(t.label)}</span>`;
    }).join('');
    return `<div class="vm-popup">
      <h3>${esc(title)}</h3>
      <div class="types">${tags}</div>
      <table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>
      <div class="links">
        <a href="https://www.openstreetmap.org/${type}/${id}" target="_blank" rel="noopener">View on OSM</a>
        <a href="https://www.openstreetmap.org/edit?${type}=${id}" target="_blank" rel="noopener">Edit on OSM</a>
      </div>
    </div>`;
  }

  // ---------- State ----------
  let entries = []; // { marker, cats }
  const active = new Set(TYPES.map((t) => t.key));

  function applyFilter() {
    const visible = entries.filter((e) => e.cats.some((c) => active.has(c))).map((e) => e.marker);
    cluster.clearLayers();
    cluster.addLayers(visible);
    $('count').textContent = visible.length === entries.length
      ? `${entries.length.toLocaleString()} machines`
      : `${visible.length.toLocaleString()} of ${entries.length.toLocaleString()} machines`;
  }

  function buildFilters(counts) {
    const ul = $('filters');
    ul.innerHTML = '';
    for (const t of TYPES) {
      const li = document.createElement('li');
      if (!counts[t.key]) li.className = 'empty';
      li.innerHTML = `<label>
          <input type="checkbox" value="${t.key}" ${active.has(t.key) ? 'checked' : ''}>
          <span class="swatch" style="background:${t.color}">${t.emoji}</span>
          <span class="lbl">${esc(t.label)}</span>
          <span class="num">${(counts[t.key] || 0).toLocaleString()}</span>
        </label>`;
      ul.appendChild(li);
    }
  }
  $('filters').addEventListener('change', (ev) => {
    const cb = ev.target;
    if (cb.type !== 'checkbox') return;
    if (cb.checked) active.add(cb.value); else active.delete(cb.value);
    applyFilter();
  });

  function setAll(on) {
    active.clear();
    if (on) TYPES.forEach((t) => active.add(t.key));
    document.querySelectorAll('#filters input').forEach((cb) => { cb.checked = on; });
    applyFilter();
  }
  $('all-on').addEventListener('click', () => setAll(true));
  $('all-off').addEventListener('click', () => setAll(false));

  // ---------- Panel collapse ----------
  const panel = $('panel');
  const toggle = $('panel-toggle');
  function setCollapsed(c) {
    panel.classList.toggle('collapsed', c);
    toggle.setAttribute('aria-expanded', String(!c));
  }
  toggle.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
  if (window.matchMedia('(max-width: 640px)').matches) setCollapsed(true);
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);

  // ---------- Locate me ----------
  const LocateControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const btn = L.DomUtil.create('button', 'locate-btn', wrap);
      btn.type = 'button';
      btn.title = 'Locate me';
      btn.setAttribute('aria-label', 'Locate me');
      btn.textContent = '◎';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn, 'click', () => locate(btn));
      return wrap;
    },
  });
  map.addControl(new LocateControl());

  let meLayer = null;
  function locate(btn) {
    if (!('geolocation' in navigator)) { showError('Geolocation is not supported by this browser.', false); return; }
    btn.classList.add('busy');
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.classList.remove('busy');
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (meLayer) map.removeLayer(meLayer);
      meLayer = L.layerGroup([
        L.circle(ll, { radius: pos.coords.accuracy, weight: 1, color: '#0b6bcb', fillOpacity: 0.1 }),
        L.circleMarker(ll, { radius: 7, weight: 2, color: '#fff', fillColor: '#0b6bcb', fillOpacity: 1 })
          .bindTooltip('You are here'),
      ]).addTo(map);
      map.flyTo(ll, Math.max(map.getZoom(), 15));
    }, (err) => {
      btn.classList.remove('busy');
      showError(`Could not get your location: ${err.message || 'permission denied'}.`, false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  // ---------- Overlays ----------
  function showError(msg, retry) {
    const box = $('error');
    box.innerHTML = `<strong>Something went wrong</strong><span>${esc(msg)}</span>` +
      `<button type="button">${retry ? 'Retry' : 'Dismiss'}</button>`;
    box.hidden = false;
    box.querySelector('button').onclick = () => { box.hidden = true; if (retry) load(); };
  }

  function formatStamp(iso) {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  // ---------- Load data ----------
  async function load() {
    $('loading').hidden = false;
    $('error').hidden = true;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${DATA_URL}`);
      const gj = await res.json();
      if (!gj || !Array.isArray(gj.features)) throw new Error('Data file is not valid GeoJSON.');

      const counts = {};
      entries = [];
      for (const f of gj.features) {
        if (!f.geometry || f.geometry.type !== 'Point') continue;
        const [lon, lat] = f.geometry.coordinates;
        const props = f.properties || {};
        const cats = categoriesOf(props);
        cats.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
        const marker = L.marker([lat, lon], { icon: iconFor(cats[0]), title: props.name || props.vending || '' });
        marker.bindPopup(() => popupHtml(props, cats), { maxWidth: 300 });
        entries.push({ marker, cats });
      }

      buildFilters(counts);
      applyFilter();

      const meta = gj.metadata || {};
      $('stamp').textContent = `OSM data as of ${formatStamp(meta.timestamp_osm_base)}`;
      $('stamp').title = meta.region ? `Region: ${meta.region}` : '';

      if (entries.length) {
        map.fitBounds(L.latLngBounds(entries.map((e) => e.marker.getLatLng())), { padding: [30, 30], maxZoom: 16 });
      } else if (Array.isArray(meta.bbox) && meta.bbox.length === 4) {
        const [s, w, n, e] = meta.bbox;
        map.fitBounds([[s, w], [n, e]]);
      }
    } catch (err) {
      console.error(err);
      showError(`Could not load the vending machine data. ${err.message}`, true);
    } finally {
      $('loading').hidden = true;
    }
  }

  load();
})();
