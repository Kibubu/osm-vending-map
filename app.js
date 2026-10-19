/* Vending machine map — static frontend. Data: tiles/ (prebuilt, see scripts/build-tiles.mjs). */
(function () {
  'use strict';

  const INDEX_URL = 'tiles/index.json';
  const { t } = I18N;
  const fmt = (n) => I18N.fmtNum(n);

  // Groups of OSM vending=* values (see docs/vending-values.md for the worldwide list).
  // Order matters for the legend; a machine's marker uses the group of its first vending value.
  const TYPES = [
    { key: 'drinks', emoji: '🥤', color: '#1f77b4',
      values: ["drinks", "coffee", "water", "milk", "beverages", "wine", "beer", "hot_drinks", "alcohol", "juice", "tea", "raw_milk"] },
    { key: 'food', emoji: '🥪', color: '#2ca02c',
      values: ["food", "sweets", "eggs", "bread", "pizza", "ice_cream", "snacks", "chewing_gums", "meat", "potatoes", "honey", "cheese", "rice_polishing", "sausages", "snack", "vegetables", "noodles", "fruit", "sausage", "strawberries", "fruits", "pasta", "butter", "french_fries"] },
    { key: 'tobacco', emoji: '🚬', color: '#7f4f24',
      values: ["cigarettes", "e-cigarettes", "cbd", "cannabis", "tobacco"] },
    { key: 'tickets', emoji: '🎫', color: '#3949ab',
      values: ["parking_tickets", "public_transport_tickets", "admission_tickets", "subscription", "toll", "telephone_vouchers", "tickets", "ticket_validator", "coin_change_machine", "subway_tokens", "public_transport_plans", "lottery", "sim_cards", "coin_rolls"] },
    { key: 'health', emoji: '💊', color: '#d62781',
      values: ["condoms", "contact_lenses", "feminine_hygiene", "chemist", "syringes", "pharmacy", "sex_toys", "first_aid", "toothpaste", "toothbrushes", "toothbrushs"] },
    { key: 'pets', emoji: '🐕', color: '#8c6d00',
      values: ["excrement_bags", "animal_feed", "pet", "fishing_bait", "pet_food", "fishing_tackle"] },
    { key: 'vehicles', emoji: '⛽', color: '#c92a2a',
      values: ["fuel", "bicycle_tube", "gas", "battery_swap", "gas_bottles"] },
    { key: 'services', emoji: '♻️', color: '#0b7285',
      values: ["bottle_return", "newspapers", "ice_cubes", "stamps", "parcel_pickup", "locker", "key", "photos", "ice", "parcel_mail_in", "laundry", "trash_bag", "laundry_detergent", "photo"] },
    { key: 'goods', emoji: '🎁', color: '#7048e8',
      values: ["movies", "elongated_coin", "toys", "flowers", "electronics", "candles", "art", "books", "flower_seeds", "coin", "wood_pellet", "umbrellas", "clothes", "swimming_items", "ink_cartridges"] },
    { key: 'other', emoji: '📦', color: '#6c757d', values: [] },
  ];
  TYPES.forEach((ty) => { Object.defineProperty(ty, 'label', { get: () => t(`type.${ty.key}`) }); });
  const TYPE_BY_KEY = Object.fromEntries(TYPES.map((ty) => [ty.key, ty]));
  const GROUP_OF = {};
  TYPES.forEach((t) => t.values.forEach((v) => { GROUP_OF[v] = t.key; }));

  // Common, documented values offered as quick picks in the "add a machine" form.
  const ADD_CHOICES = [
    ['drinks', '🥤'], ['coffee', '☕'], ['water', '💧'], ['milk', '🥛'],
    ['sweets', '🍫'], ['snacks', '🥨'], ['food', '🥪'], ['eggs', '🥚'],
    ['bread', '🍞'], ['ice_cream', '🍦'], ['meat', '🥩'], ['honey', '🍯'],
    ['cigarettes', '🚬'], ['e-cigarettes', '💨'],
    ['parking_tickets', '🅿️'], ['public_transport_tickets', '🚌'],
    ['admission_tickets', '🎟️'], ['condoms', '🩹'], ['feminine_hygiene', '🌸'],
    ['excrement_bags', '🐕'], ['animal_feed', '🦆'], ['fishing_bait', '🎣'],
    ['fuel', '⛽'], ['bicycle_tube', '🚲'], ['bottle_return', '♻️'],
    ['newspapers', '📰'], ['stamps', '✉️'], ['parcel_pickup', '📦'],
    ['toys', '🧸'], ['flowers', '💐'],
  ];


  const $ = (id) => document.getElementById(id);

  // ---------- Map ----------
  const map = L.map('map', { zoomControl: false, worldCopyJump: true });
  // Open at the shared link's view or the start region right away, so map tiles start loading
  // while the data is still downloading (instead of first loading a zoom-6 view we then leave).
  const REGION_BOUNDS = [[50.93, 8.95], [51.33, 9.60]]; // Fritzlar and surroundings
  {
    const h = parseHash();
    if (h.zoom != null) map.setView([h.lat, h.lon], h.zoom);
    else if (map.getSize().x && map.getSize().y) map.fitBounds(REGION_BOUNDS);
    else map.setView(L.latLngBounds(REGION_BOUNDS).getCenter(), 10); // no size yet (e.g. hidden frame): fitBounds would give zoom 0
  }
  let zoomCtl = L.control.zoom({ zoomInTitle: t('ctl.zoomIn'), zoomOutTitle: t('ctl.zoomOut') }).addTo(map);
  // Base maps: OSM (default) and satellite imagery (Esri World Imagery + labels on top).
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  // Esri's tile hosts speak HTTP/1.1 only (max. 6 parallel requests per host), so the imagery and
  // the two label layers are spread over two hosts that serve the same tiles.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
  const ESRI2 = 'https://services.arcgisonline.com/ArcGIS/rest/services';
  const ESRI_CLARITY = 'https://clarity.maptiles.arcgis.com/arcgis/rest/services';
  // crossOrigin: tiles are fetched with CORS so the service worker can keep them for offline use
  // (no-CORS responses can't be inspected and count several MB each against the storage quota).
  const BASEMAPS = {
    map: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true, attribution: OSM_ATTR }),
    satellite: L.layerGroup([
      // World Imagery mixes source mosaics with visibly different colours at mid zooms (e.g. a hard
      // dark/bright seam around Bad Wildungen at z12–15). The Clarity variant uses one consistent
      // mosaic from z14 up, but is blurry and cloudy below that, so each covers its own zoom range.
      L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 13, crossOrigin: true,
        attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
      }),
      L.tileLayer(`${ESRI_CLARITY}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { minZoom: 14, maxZoom: 19, maxNativeZoom: 18, crossOrigin: true }),
      L.tileLayer(`${ESRI2}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, opacity: 0.8 }),
      L.tileLayer(`${ESRI2}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true }),
    ]),
  };
  const BASEMAP_KEY = 'vm-basemap';
  let basemap = 'map';
  try { if (localStorage.getItem(BASEMAP_KEY) === 'satellite') basemap = 'satellite'; } catch { /* ignore */ }
  BASEMAPS[basemap].addTo(map);
  // Vending data attribution stays visible on both base maps.
  BASEMAPS.satellite.on('add', () => map.attributionControl.addAttribution(`Data ${OSM_ATTR}`));
  BASEMAPS.satellite.on('remove', () => map.attributionControl.removeAttribution(`Data ${OSM_ATTR}`));
  if (basemap === 'satellite') map.attributionControl.addAttribution(`Data ${OSM_ATTR}`);

  function setBasemap(name) {
    if (name === basemap || !BASEMAPS[name]) return;
    map.removeLayer(BASEMAPS[basemap]);
    BASEMAPS[name].addTo(map);
    basemap = name;
    map.getContainer().classList.toggle('satellite', name === 'satellite');
    try { localStorage.setItem(BASEMAP_KEY, name); } catch { /* ignore */ }
    if (typeof renderBasemapBtn === 'function') renderBasemapBtn();
  }
  map.getContainer().classList.toggle('satellite', basemap === 'satellite');

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

  /** Split "drinks;sweets" (or the common mistake "drinks,sweets") and map each value to its group; unknown values map to "other". */
  function categoriesOf(props) {
    const raw = (props.vending || '').split(/[;,]/)
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
    const cats = [];
    for (const v of raw) {
      const k = GROUP_OF[v] || 'other';
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
    const p = k.replace(/^payment:/, '');
    return I18N.tryT(`pay.${p}`) || p.replace(/_/g, ' ');
  }
  /** Human label for a raw vending value, e.g. "parking_tickets" → "Parkscheine". */
  function itemLabel(v) {
    const key = v.trim().toLowerCase().replace(/\s+/g, '_');
    return I18N.tryT(`item.${key}`) || v.trim().replace(/_/g, ' ');
  }
  function prettyVal(v) {
    if (v === 'yes') return '✅';
    if (v === 'no') return '❌';
    return esc(v);
  }

  function popupHtml(props, cats) {
    const type = props.osm_type, id = props.osm_id;
    const title = props.name || props.brand || (TYPE_BY_KEY[cats[0]] || {}).label || t('popup.title');
    const rows = [];
    const vend = (props.vending || '').split(/[;,]/).filter((v) => v.trim());
    rows.push([t('popup.type'), vend.length ? vend.map((v) => esc(itemLabel(v))).join(', ') : esc(t('popup.unknown'))]);
    for (const k of ['operator', 'brand', 'opening_hours', 'level', 'note']) {
      if (props[k] != null && props[k] !== '') rows.push([t(`popup.${k}`), esc(props[k])]);
    }
    const payments = Object.keys(props).filter((k) => k.startsWith('payment:')).sort();
    if (payments.length) {
      rows.push([t('popup.payment'), payments.map((k) => `${esc(prettyKey(k))} ${prettyVal(props[k])}`).join('<br>')]);
    }
    const tags = cats.map((c) => {
      const ty = TYPE_BY_KEY[c];
      return `<span class="tag" style="background:${ty.color}">${ty.emoji} ${esc(ty.label)}</span>`;
    }).join('');
    return `<div class="vm-popup">
      <h3>${esc(title)}</h3>
      <div class="types">${tags}</div>
      <table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>
      <div class="links">
        <a href="https://www.openstreetmap.org/${type}/${id}" target="_blank" rel="noopener">${esc(t('popup.view'))}</a>
        <a href="https://www.openstreetmap.org/edit?${type}=${id}" target="_blank" rel="noopener">${esc(t('popup.edit'))}</a>
        <a href="#" class="share-link" data-id="${type}/${id}">${esc(t('popup.share'))}</a>
      </div>
    </div>`;
  }

  // ---------- State ----------
  let entries = []; // { marker, cats }
  let overviewOn = false; // zoomed out: counts per area instead of markers (see showOverview)
  // Filter choice is remembered per browser. We store the *hidden* groups, so groups added
  // in a later version of the site show up by default.
  const FILTER_KEY = 'vm-filter-hidden';
  function loadHidden() {
    try {
      const v = JSON.parse(localStorage.getItem(FILTER_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function saveHidden() {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(TYPES.map((ty) => ty.key).filter((k) => !active.has(k))));
    } catch { /* storage unavailable (private mode etc.) — filter just won't be remembered */ }
  }
  const hiddenAtStart = new Set(loadHidden());
  const active = new Set(TYPES.map((ty) => ty.key).filter((k) => !hiddenAtStart.has(k)));

  function applyFilter() {
    const visible = entries.filter((e) => e.cats.some((c) => active.has(c))).map((e) => e.marker);
    cluster.clearLayers();
    cluster.addLayers(visible);
    updateCountText(visible.length);
  }

  function updateCountText(visibleCount) {
    if (overviewOn) return; // the overview shows its own total
    const n = visibleCount != null ? visibleCount
      : entries.filter((e) => e.cats.some((c) => active.has(c))).length;
    $('count').textContent = n === entries.length
      ? t('count.all', { n: fmt(entries.length) })
      : t('count.some', { n: fmt(n), total: fmt(entries.length) });
  }

  function buildFilters(counts) {
    const ul = $('filters');
    ul.innerHTML = '';
    for (const ty of TYPES) {
      const li = document.createElement('li');
      if (!counts[ty.key]) li.className = 'empty';
      li.innerHTML = `<label>
          <input type="checkbox" value="${ty.key}" ${active.has(ty.key) ? 'checked' : ''}>
          <span class="swatch" style="background:${ty.color}">${ty.emoji}</span>
          <span class="lbl">${esc(ty.label)}</span>
          <span class="num">${fmt(counts[ty.key] || 0)}</span>
        </label>`;
      ul.appendChild(li);
    }
  }
  $('filters').addEventListener('change', (ev) => {
    const cb = ev.target;
    if (cb.type !== 'checkbox') return;
    if (cb.checked) active.add(cb.value); else active.delete(cb.value);
    saveHidden();
    applyFilter();
  });

  function setAll(on) {
    active.clear();
    if (on) TYPES.forEach((ty) => active.add(ty.key));
    document.querySelectorAll('#filters input').forEach((cb) => { cb.checked = on; });
    saveHidden();
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
      btn.title = t('ctl.locate');
      btn.setAttribute('aria-label', t('ctl.locate'));
      btn.dataset.i18nTitle = 'ctl.locate';
      btn.dataset.i18nAria = 'ctl.locate';
      btn.textContent = '◎';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn, 'click', () => locate(btn));
      return wrap;
    },
  });
  map.addControl(new LocateControl());

  let meLayer = null;
  function locate(btn) {
    if (!('geolocation' in navigator)) { showError(t('geo.unsupported'), false); return; }
    btn.classList.add('busy');
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.classList.remove('busy');
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (meLayer) map.removeLayer(meLayer);
      meLayer = L.layerGroup([
        L.circle(ll, { radius: pos.coords.accuracy, weight: 1, color: '#0b6bcb', fillOpacity: 0.1 }),
        L.circleMarker(ll, { radius: 7, weight: 2, color: '#fff', fillColor: '#0b6bcb', fillOpacity: 1 })
          .bindTooltip(t('geo.here')),
      ]).addTo(map);
      map.flyTo(ll, Math.max(map.getZoom(), 15));
    }, (err) => {
      btn.classList.remove('busy');
      showError(t('geo.failed', { msg: err.code === 1 ? t('geo.denied') : (err.message || t('geo.denied')) }), false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  // ---------- Add a missing machine ----------
  // Upload directly with the visitor's OSM account (osm.js), open iD/JOSM at the spot,
  // or leave an anonymous OSM note for mappers.
  let addMode = false;
  let draft = null;
  let addBtn = null;

  const AddControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      addBtn = L.DomUtil.create('button', 'locate-btn add-btn', wrap);
      addBtn.type = 'button';
      addBtn.title = t('ctl.add');
      addBtn.setAttribute('aria-label', t('ctl.add'));
      addBtn.dataset.i18nTitle = 'ctl.add';
      addBtn.dataset.i18nAria = 'ctl.add';
      addBtn.setAttribute('aria-pressed', 'false');
      addBtn.textContent = '＋';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(addBtn, 'click', () => setAddMode(!addMode));
      return wrap;
    },
  });
  map.addControl(new AddControl());

  // ---------- Language picker (flag button) ----------
  const LangControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control lang-ctl');
      const btn = L.DomUtil.create('button', 'locate-btn lang-btn', wrap);
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      const menu = L.DomUtil.create('ul', 'lang-menu', wrap);
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      const render = () => {
        btn.textContent = I18N.info.flag;
        btn.title = `${t('ctl.lang')}: ${I18N.info.name}`;
        btn.setAttribute('aria-label', btn.title);
        menu.innerHTML = I18N.ordered().map((l) =>
          `<li role="option" aria-selected="${l.code === I18N.lang}" data-code="${l.code}" tabindex="0">` +
          `<span class="flag">${l.flag}</span><span>${esc(l.name)}</span>${l.code === I18N.lang ? '<span class="tick">✓</span>' : ''}</li>`).join('');
      };
      const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
      });
      const choose = (li) => { if (li) { I18N.set(li.dataset.code); close(); } };
      // Stop the click here: the menu is re-rendered while handling it, which would otherwise
      // let Leaflet treat it as a map click (closing popups / dropping an "add" pin).
      menu.addEventListener('click', (e) => { e.stopPropagation(); choose(e.target.closest('li')); });
      menu.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(e.target.closest('li')); } });
      document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
      I18N.onChange(render);
      render();
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);
      return wrap;
    },
  });
  map.addControl(new LangControl());

  // ---------- Map / satellite toggle ----------
  let renderBasemapBtn = null;
  const BasemapControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const btn = L.DomUtil.create('button', 'locate-btn basemap-btn', wrap);
      btn.type = 'button';
      renderBasemapBtn = () => {
        const toSat = basemap !== 'satellite';
        btn.textContent = toSat ? '🛰️' : '🗺️';
        btn.title = toSat ? t('ctl.satellite') : t('ctl.mapView');
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-pressed', String(!toSat));
      };
      btn.addEventListener('click', () => setBasemap(basemap === 'satellite' ? 'map' : 'satellite'));
      I18N.onChange(renderBasemapBtn);
      renderBasemapBtn();
      L.DomEvent.disableClickPropagation(wrap);
      return wrap;
    },
  });
  map.addControl(new BasemapControl());

  // ---------- Faster zooming ----------
  // When on, tile layers skip fetching intermediate zoom levels during zoom animations
  // (Leaflet's updateWhenZooming, read on every view change, so toggling the option is enough).
  // Off by default, but on by default when the browser reports data saver or a slow connection
  // (Network Information API, Chromium only). An explicit choice always wins.
  const ZOOMTILES_KEY = 'vm-zoomtiles';
  const conn = navigator.connection || {};
  let fastZoom = Boolean(conn.saveData) || ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
  try {
    const saved = localStorage.getItem(ZOOMTILES_KEY);
    if (saved) fastZoom = saved === 'fast';
  } catch { /* ignore */ }
  const tileLayers = () => [BASEMAPS.map, ...BASEMAPS.satellite.getLayers()];
  const applyFastZoom = () => tileLayers().forEach((l) => { l.options.updateWhenZooming = !fastZoom; });
  applyFastZoom();
  const FastZoomControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const btn = L.DomUtil.create('button', 'locate-btn fastzoom-btn', wrap);
      btn.type = 'button';
      btn.textContent = '⚡';
      const render = () => {
        btn.title = t(fastZoom ? 'ctl.fastZoomOn' : 'ctl.fastZoomOff');
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-pressed', String(fastZoom));
        btn.classList.toggle('active', fastZoom);
      };
      btn.addEventListener('click', () => {
        fastZoom = !fastZoom;
        applyFastZoom();
        try { localStorage.setItem(ZOOMTILES_KEY, fastZoom ? 'fast' : 'all'); } catch { /* ignore */ }
        render();
      });
      I18N.onChange(render);
      render();
      L.DomEvent.disableClickPropagation(wrap);
      return wrap;
    },
  });
  map.addControl(new FastZoomControl());

  // ---------- Outbox button + panel ----------
  let renderOutbox = null;
  const OutboxControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control outbox-ctl');
      const btn = L.DomUtil.create('button', 'locate-btn outbox-btn', wrap);
      btn.type = 'button';
      btn.innerHTML = '📤<span class="badge"></span>';
      btn.addEventListener('click', () => openOutbox());
      L.DomEvent.disableClickPropagation(wrap);
      this._wrap = wrap;
      this._btn = btn;
      return wrap;
    },
  });
  const outboxCtl = new OutboxControl();
  map.addControl(outboxCtl);

  const STATUS_CLASS = { failed: 'warn', interrupted: 'warn', pending: '', uploading: 'busy' };
  let obFlash = null; // success message shown at the top after an entry left the list

  renderOutbox = function () {
    const list = outboxAll();
    const wrap = outboxCtl._wrap, btn = outboxCtl._btn;
    wrap.style.display = list.length ? '' : 'none';
    btn.querySelector('.badge').textContent = list.length ? String(list.length) : '';
    btn.title = t('outbox.btn', { n: list.length });
    btn.setAttribute('aria-label', btn.title);
    const panel = $('outbox');
    if (!panel.hidden) renderOutboxPanel();
  };

  function renderOutboxPanel() {
    const panel = $('outbox');
    const list = outboxAll().sort((a, b) => (a.created < b.created ? 1 : -1));
    const dateFmt = (iso) => { try { return new Date(iso).toLocaleString(I18N.lang, { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; } };
    const items = list.map((x) => {
      const what = (x.tags.vending || '').split(';').filter(Boolean).map(itemLabel).join(', ') || t('popup.title');
      const err = x.lastError;
      const errLine = err ? `${err.offline ? t('outbox.offline') + ' ' : ''}${err.status ? 'HTTP ' + err.status + ' · ' : ''}${err.message}` : '';
      const log = (x.log || []).slice().reverse().map((l) =>
        `<li><time>${esc(dateFmt(l.at))}</time> ${esc(l.step || '?')}${l.status ? ' · HTTP ' + l.status : ''}${l.offline ? ' · offline' : ''}` +
        `${l.changesetId ? ' · changeset ' + esc(l.changesetId) : ''}<br>${esc(l.message)}</li>`).join('');
      return `<li class="ob-item" data-id="${esc(x.id)}">
        <div class="ob-head"><strong>${esc(what)}</strong>
          <span class="ob-status ${STATUS_CLASS[x.status] || ''}">${esc(t(`outbox.status.${x.status}`))}</span></div>
        <div class="ob-meta">${x.lat.toFixed(5)}, ${x.lng.toFixed(5)} · ${esc(t('outbox.savedAt', { date: dateFmt(x.created) }))} · ${esc(t('outbox.attempts', { n: x.attempts || 0 }))}</div>
        ${x.tags.operator || x.tags.brand ? `<div class="ob-meta">${esc([x.tags.operator, x.tags.brand].filter(Boolean).join(' · '))}</div>` : ''}
        ${errLine ? `<div class="ob-err"><b>${esc(t('outbox.lastError'))}:</b> ${esc(errLine)}</div>` : ''}
        ${x.suspect ? `<div class="ob-hint">${esc(t('outbox.maybe'))}</div>` : ''}
        ${log ? `<details><summary>${esc(t('outbox.log'))} (${(x.log || []).length})</summary><ol class="ob-log">${log}</ol></details>` : ''}
        <div class="ob-actions">
          <button type="button" data-act="retry" class="primary">${esc(t('outbox.retry'))}</button>
          <button type="button" data-act="edit">${esc(t('outbox.edit'))}</button>
          <button type="button" data-act="show">${esc(t('outbox.show'))}</button>
          <button type="button" data-act="note">${esc(t('outbox.note'))}</button>
          <button type="button" data-act="copy">${esc(t('outbox.copy'))}</button>
          <button type="button" data-act="discard" class="danger">${esc(t('outbox.discard'))}</button>
        </div>
        <p class="ob-msg" role="status" hidden></p>
      </li>`;
    }).join('');
    panel.innerHTML = `<div class="ob-box" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div class="ob-top"><h2 id="ob-title">📤 ${esc(t('outbox.title'))}</h2>
        <button type="button" class="ob-close" data-act="close" aria-label="${esc(t('outbox.close'))}">✕</button></div>
      ${obFlash ? `<p class="ob-msg status ok ob-flash" role="status">${obFlash}</p>` : ''}
      <p class="muted">${esc(list.length ? t('outbox.intro') : t('outbox.empty'))}</p>
      <ul class="ob-list">${items}</ul>
      ${list.length ? `<div class="ob-footer">
        ${list.length > 1 ? `<button type="button" data-act="retry-all" class="primary">${esc(t('outbox.retryAll'))}</button>` : ''}
        <button type="button" data-act="download">${esc(t('outbox.download'))}</button></div>` : ''}
    </div>`;
  }

  function openOutbox() { $('outbox').hidden = false; renderOutboxPanel(); }
  function closeOutbox() { $('outbox').hidden = true; obFlash = null; }

  function obMsg(li, html, kind) {
    const m = li && li.querySelector('.ob-msg');
    if (!m) return;
    m.hidden = !html;
    m.className = 'ob-msg status ' + (kind || '');
    m.innerHTML = html || '';
  }

  async function retryItem(id, li) {
    const x = outboxGet(id);
    if (!x) return false;
    if (!OSMClient.isLoggedIn()) {
      // Login first; afterwards the summary opens so the user confirms the upload.
      outboxSave({ id, lat: x.lat, lng: x.lng, tags: x.tags, comment: x.comment, status: 'pending' });
      await OSMClient.login({ action: 'createNode', lat: x.lat, lng: x.lng, tags: x.tags, comment: x.comment, outboxId: id });
      return false;
    }
    obMsg(li, esc(t('review.uploading')), 'busy');
    try {
      const res = await uploadWithOutbox({ id, lat: x.lat, lng: x.lng, tags: x.tags, comment: x.comment });
      if (res.already) {
        obFlash = tHtml('outbox.already', { link: linkTo(res.already.url, t('review.node', { id: res.already.id })) });
      } else {
        addLocalMarker(x.lat, x.lng, x.tags, res.r.nodeId);
        obFlash = tHtml('outbox.done', { link: linkTo(res.r.nodeUrl, t('review.node', { id: res.r.nodeId })) });
      }
      if (!$('outbox').hidden) renderOutboxPanel();
      return true;
    } catch (e) {
      renderOutboxPanel();
      const fresh = $('outbox').querySelector(`.ob-item[data-id="${CSS.escape(id)}"]`);
      obMsg(fresh, esc(e.message), 'warn');
      return false;
    }
  }

  $('outbox').addEventListener('click', async (ev) => {
    if (ev.target.id === 'outbox') { closeOutbox(); return; } // click on the backdrop
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const li = btn.closest('.ob-item');
    const id = li && li.dataset.id;
    const x = id && outboxGet(id);
    if (act === 'close') { closeOutbox(); return; }
    if (act === 'download') {
      const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), site: OSMClient.siteUrl, items: outboxAll() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vending-outbox-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }
    if (act === 'retry-all') {
      btn.disabled = true;
      for (const item of outboxAll()) {
        const row = $('outbox').querySelector(`.ob-item[data-id="${CSS.escape(item.id)}"]`);
        // eslint-disable-next-line no-await-in-loop
        await retryItem(item.id, row);
      }
      btn.disabled = false;
      return;
    }
    if (!x) return;
    if (act === 'retry') { btn.disabled = true; await retryItem(id, li); btn.disabled = false; return; }
    if (act === 'edit' || act === 'show') {
      closeOutbox();
      map.setView([x.lat, x.lng], 18, { animate: false });
      if (act === 'show') {
        const ring = L.circleMarker([x.lat, x.lng], { radius: 16, color: '#d1242f', weight: 3, fillOpacity: 0.1 }).addTo(map);
        setTimeout(() => map.removeLayer(ring), 4000);
        return;
      }
      map.panBy([0, -Math.round(map.getSize().y * 0.35)], { animate: false });
      const form = placeDraft(L.latLng(x.lat, x.lng));
      draft._outboxId = id;
      form.prefill(x.tags);
      return;
    }
    if (act === 'note') {
      btn.disabled = true;
      try {
        const note = await OSMClient.createNote(x.lat, x.lng, noteTextFor(x.tags));
        obFlash = tHtml('outbox.noteDone', { link: linkTo(note.url, note.id ? t('form.noteLink', { id: note.id }) : t('form.noteLinkNoId')) });
        outboxRemove(id);
      } catch (e) {
        btn.disabled = false;
        obMsg(li, esc(t('form.noteFailed', { msg: e.message })), 'warn');
      }
      return;
    }
    if (act === 'copy') {
      const text = [`${x.lat.toFixed(7)}, ${x.lng.toFixed(7)}`, ...Object.entries(x.tags).map(([k, v]) => `${k}=${v}`)].join('\n');
      try { await navigator.clipboard.writeText(text); btn.textContent = t('outbox.copied'); } catch { window.prompt(t('popup.copyPrompt'), text); }
      setTimeout(() => { btn.textContent = t('outbox.copy'); }, 2000);
      return;
    }
    if (act === 'discard') {
      if (!btn.classList.contains('confirm')) { btn.classList.add('confirm'); btn.textContent = t('outbox.confirm'); return; }
      outboxRemove(id);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('outbox').hidden) closeOutbox(); });
  I18N.onChange(() => renderOutbox());

  /** Re-renders everything language-dependent after the visitor switches language. */
  I18N.onChange(() => {
    map.removeControl(zoomCtl);
    zoomCtl = L.control.zoom({ zoomInTitle: t('ctl.zoomIn'), zoomOutTitle: t('ctl.zoomOut') });
    map.addControl(zoomCtl);
    // keep the zoom buttons at the top of the left column
    const corner = map.getContainer().querySelector('.leaflet-top.leaflet-left');
    corner.insertBefore(zoomCtl.getContainer(), corner.firstChild);
    buildFilters(counts);
    updateCountText();
    renderStamp();
    setLiveStatus('');
    // Machine popups are rebuilt on open; reopen the selected one so it shows the new language.
    const sel = selectedId && entryById.get(selectedId);
    if (sel && sel.marker.isPopupOpen()) { sel.marker.closePopup(); sel.marker.openPopup(); }
    // A half-filled "add" form keeps its values: rebuild it in the new language.
    if (draft && draft.isPopupOpen() && draft._form) draft._form.relocalize();
  });

  const hint = $('add-hint');
  $('add-cancel').addEventListener('click', () => { setAddMode(false); removeDraft(); });

  function setAddMode(on) {
    addMode = on;
    map.getContainer().classList.toggle('adding', on);
    addBtn.classList.toggle('active', on);
    addBtn.setAttribute('aria-pressed', String(on));
    hint.hidden = !on;
    if (on) map.closePopup();
  }

  function removeDraft() {
    if (draft) { map.removeLayer(draft); draft = null; }
  }

  map.on('click', (e) => {
    if (!addMode) return;
    setAddMode(false);
    placeDraft(e.latlng);
  });
  // Right-click on desktop, long-press on touch devices.
  map.on('contextmenu', (e) => placeDraft(e.latlng));

  function placeDraft(latlng) {
    removeDraft();
    draft = L.marker(latlng, {
      draggable: true,
      autoPan: true,
      zIndexOffset: 1000,
      icon: L.divIcon({ className: 'vm-icon', html: '<div class="vm-pin draft-pin">＋</div>', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }),
    }).addTo(map);
    const form = buildAddForm();
    draft._form = form;
    draft.bindPopup(form.el, {
      maxWidth: Math.min(300, window.innerWidth - 100),
      minWidth: Math.min(260, window.innerWidth - 100),
      maxHeight: Math.max(240, window.innerHeight - 170), // scrolls on short screens
      autoPanPaddingTopLeft: [50, 20],
      autoPanPaddingBottomRight: [10, 70],
    }).openPopup();
    draft.on('dragend', () => { form.updateCoords(); draft.openPopup(); });
    draft.on('popupclose', () => {
      // Keep the pin while dragging; remove it once the user closes the form.
      setTimeout(() => { if (draft && !draft.isPopupOpen() && !draft._dragging) removeDraft(); }, 250);
    });
    draft.on('dragstart', () => { draft._dragging = true; });
    draft.on('dragend', () => { draft._dragging = false; });
    return form;
  }

  const PAYMENTS = ['coins', 'notes', 'debit_cards', 'credit_cards', 'contactless', 'app'];

  function buildAddForm() {
    const el = document.createElement('div');
    el.className = 'vm-popup add-form';
    el.innerHTML = `
      <form class="step step-edit" novalidate>
        <h3>${esc(t('form.title'))}</h3>
        <p class="muted">${esc(t('form.drag'))} <span class="coords"></span></p>
        <fieldset class="type-chips"><legend>${esc(t('form.sells'))} <span class="req">*</span></legend>
          ${ADD_CHOICES.map(([v, emoji]) =>
            `<label class="chip"><input type="checkbox" name="vending" value="${v}"><span>${emoji} ${esc(t(`item.${v}`))}</span></label>`).join('')}
          <input type="text" name="vending_other" placeholder="${esc(t('form.otherPh'))}" maxlength="80">
        </fieldset>
        <div class="grid2">
          <label class="field">${esc(t('form.operator'))}<input type="text" name="operator" maxlength="120" placeholder="${esc(t('form.operatorPh'))}"></label>
          <label class="field">${esc(t('form.brand'))}<input type="text" name="brand" maxlength="120" placeholder="${esc(t('form.brandPh'))}"></label>
        </div>
        <label class="field">${esc(t('form.name'))} <span class="muted">${esc(t('form.nameHint'))}</span><input type="text" name="name" maxlength="120"></label>
        <fieldset class="type-chips"><legend>${esc(t('form.payment'))}</legend>
          ${PAYMENTS.map((v) =>
            `<label class="chip"><input type="checkbox" name="payment" value="${v}"><span>${esc(t(`pay.${v}`))}</span></label>`).join('')}
        </fieldset>
        <div class="grid2">
          <label class="field">${esc(t('form.hours'))}
            <input type="text" name="opening_hours" maxlength="120" placeholder="${esc(t('form.hoursPh'))}">
            <span class="inline"><input type="checkbox" name="always"> 24/7</span>
          </label>
          <label class="field">${esc(t('form.level'))} <span class="muted">${esc(t('form.levelHint'))}</span><input type="text" name="level" maxlength="10" placeholder="${esc(t('form.levelPh'))}"></label>
        </div>
        <label class="field">${esc(t('form.note'))} <span class="muted">${esc(t('form.optional'))}</span>
          <textarea name="note" rows="2" maxlength="255" placeholder="${esc(t('form.notePh'))}"></textarea>
        </label>
        <div class="add-actions">
          <button type="submit" class="primary">${esc(t('form.review'))}</button>
          <button type="button" class="secondary send-note">${esc(t('form.sendNote'))}</button>
        </div>
        <p class="muted small other-editors">${esc(t('form.orOpen'))}
          <a class="editor-link" target="_blank" rel="noopener">iD</a> ·
          <a class="josm-link" target="_blank" rel="noopener" title="${esc(t('form.josmTitle'))}">${esc(t('form.josm'))}</a></p>
        <p class="status" role="status" hidden></p>
      </form>

      <div class="step step-review" hidden>
        <h3>${esc(t('review.title'))}</h3>
        <p class="muted review-intro"></p>
        <table class="tag-table"></table>
        <div class="dupes" hidden></div>
        <div class="auth-box"></div>
        <div class="add-actions">
          <button type="button" class="primary upload">${esc(t('review.upload'))}</button>
          <div class="btn-row">
            <button type="button" class="secondary back">${esc(t('review.edit'))}</button>
            <button type="button" class="secondary cancel">${esc(t('review.cancel'))}</button>
          </div>
        </div>
        <p class="muted small">${esc(t('review.disclaimer', { tag: OSMClient.hashtag }))}</p>
        <p class="status" role="status" hidden></p>
      </div>

      <div class="step step-done" hidden></div>`;

    const q = (sel) => el.querySelector(sel);
    const form = q('.step-edit');
    const review = q('.step-review');
    const done = q('.step-done');

    function show(step) {
      [form, review, done].forEach((s) => { s.hidden = s !== step; });
      if (draft) draft.getPopup().update();
    }

    function setStatus(scope, html, kind) {
      const status = scope.querySelector('.status');
      status.hidden = !html;
      status.className = 'status ' + (kind || '');
      status.innerHTML = html || '';
    }

    function norm(v) { return v.trim().toLowerCase().replace(/\s+/g, '_'); }

    /** Builds the OSM tags from the form. */
    function collectTags() {
      const fd = new FormData(form);
      const vending = [...new Set([
        ...fd.getAll('vending'),
        ...String(fd.get('vending_other') || '').split(/[;,]/).map(norm).filter(Boolean),
      ])];
      const tags = { amenity: 'vending_machine' };
      if (vending.length) tags.vending = vending.join(';');
      for (const k of ['name', 'operator', 'brand', 'level', 'note']) {
        const v = String(fd.get(k) || '').trim().replace(/\s+/g, ' ');
        if (v) tags[k] = v;
      }
      const oh = fd.get('always') ? '24/7' : String(fd.get('opening_hours') || '').trim();
      if (oh) tags.opening_hours = oh;
      for (const p of fd.getAll('payment')) tags[`payment:${p}`] = 'yes';
      return tags;
    }

    function updateLinks() {
      const { lat, lng } = draft.getLatLng();
      const coords = `(${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      el.querySelectorAll('.coords').forEach((c) => { c.textContent = coords; });
      q('.review-intro').textContent = t('review.intro', { coords });
      const tags = collectTags();
      // iD cannot take tags via URL, but it can limit the preset list and prefill the changeset.
      const presets = ['amenity/vending_machine', ...(tags.vending || '').split(';').filter(Boolean).map((v) => `amenity/vending_machine/${v}`)];
      const idHash = new URLSearchParams({
        map: `20/${lat.toFixed(6)}/${lng.toFixed(6)}`,
        presets: presets.join(','),
        comment: changesetComment(tags),
        hashtags: OSMClient.hashtag.replace('#', ''),
      });
      q('.editor-link').href = `${OSMClient.web}/edit?editor=id#${idHash.toString().replace(/\+/g, '%20')}`;
      // JOSM Remote Control creates the node with all tags at once.
      const addtags = Object.entries(tags).map(([k, v]) => `${k}=${v.replace(/\|/g, '/')}`).join('|');
      q('.josm-link').href = `http://127.0.0.1:8111/add_node?lat=${lat.toFixed(7)}&lon=${lng.toFixed(7)}&addtags=${encodeURIComponent(addtags)}`;
    }

    function changesetComment(tags) {
      return `Add vending machine${tags.vending ? ` (${tags.vending.replace(/;/g, ', ')})` : ''}`;
    }

    function noteText(tags) {
      const lines = ['Missing vending machine here. Suggested tags:'];
      for (const [k, v] of Object.entries(tags)) lines.push(`${k}=${v}`);
      lines.push('', `(reported via ${OSMClient.siteUrl})`);
      return lines.join('\n');
    }

    function validate(tags) {
      if (!tags.vending) return t('form.pickOne');
      if (tags.opening_hours && tags.opening_hours.length > 255) return t('form.hoursLong');
      return '';
    }

    form.addEventListener('input', () => { updateLinks(); setStatus(form, ''); });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'always') form.elements.opening_hours.disabled = e.target.checked;
      updateLinks();
    });

    // ---- Note fallback ----
    q('.send-note').addEventListener('click', async () => {
      const tags = collectTags();
      const err = validate(tags);
      if (err) { setStatus(form, err, 'warn'); return; }
      const { lat, lng } = draft.getLatLng();
      const btn = q('.send-note');
      btn.disabled = true;
      setStatus(form, esc(t('form.sendingNote')));
      try {
        const note = await OSMClient.createNote(lat, lng, noteText(tags));
        const label = note.id ? t('form.noteLink', { id: note.id }) : t('form.noteLinkNoId');
        finish(esc(t('form.noteSent', { link: '\u0000' })).replace('\u0000', `<a href="${note.url}" target="_blank" rel="noopener">${esc(label)}</a>`));
      } catch (e) {
        btn.disabled = false;
        setStatus(form, esc(t('form.noteFailed', { msg: e.message })), 'warn');
      }
    });

    // ---- Review step ----
    function openReview(statusHtml) {
      const tags = collectTags();
      const err = validate(tags);
      if (err) { show(form); setStatus(form, err, 'warn'); return; }
      q('.tag-table').innerHTML = Object.entries(tags)
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
      setStatus(review, statusHtml || '', statusHtml ? 'ok' : '');
      show(review);
      renderAuth();
      checkDupes();
    }
    form.addEventListener('submit', (ev) => { ev.preventDefault(); openReview(); });
    q('.back').addEventListener('click', () => { setStatus(review, ''); show(form); });
    q('.cancel').addEventListener('click', () => {
      // An entry that was only parked for the login and never tried is dropped; failed ones stay in the outbox.
      const item = draft && draft._outboxId && outboxGet(draft._outboxId);
      if (item && !item.attempts && item.status === 'pending') outboxRemove(item.id);
      map.closePopup();
      removeDraft();
    });

    /** Fills the form from OSM tags (used when coming back from the OSM login). */
    function prefill(tags) {
      const known = new Set(ADD_CHOICES.map(([v]) => v));
      const vend = (tags.vending || '').split(';').filter(Boolean);
      form.querySelectorAll('input[name=vending]').forEach((c) => { c.checked = vend.includes(c.value); });
      form.elements.vending_other.value = vend.filter((v) => !known.has(v)).join(', ');
      for (const k of ['name', 'operator', 'brand', 'level', 'note']) form.elements[k].value = tags[k] || '';
      const always = tags.opening_hours === '24/7';
      form.elements.always.checked = always;
      form.elements.opening_hours.disabled = always;
      form.elements.opening_hours.value = always ? '' : (tags.opening_hours || '');
      form.querySelectorAll('input[name=payment]').forEach((c) => { c.checked = tags[`payment:${c.value}`] === 'yes'; });
      updateLinks();
    }

    async function checkDupes() {
      const box = q('.dupes');
      box.hidden = true;
      const { lat, lng } = draft.getLatLng();
      const here = L.latLng(lat, lng);
      let near = [];
      try {
        near = (await OSMClient.nearbyVending(lat, lng, 20))
          .map((n) => Object.assign(n, { dist: here.distanceTo([n.lat, n.lon]) }))
          .filter((n) => n.dist <= 20);
      } catch {
        // Fall back to the prebuilt data if the live check fails.
        near = entries.map((e) => ({ m: e.marker, dist: here.distanceTo(e.marker.getLatLng()) }))
          .filter((n) => n.dist <= 20).map((n) => ({ dist: n.dist, tags: {}, url: null }));
      }
      if (!near.length) return;
      box.hidden = false;
      box.innerHTML = `⚠️ ${esc(near.length === 1 ? t('review.dupe1') : t('review.dupeN', { n: near.length }))}` +
        '<ul>' + near.slice(0, 5).map((n) => {
          const what = (n.tags && n.tags.vending) ? n.tags.vending.split(';').map(itemLabel).join(', ')
            : ((n.tags && n.tags.name) || t('review.dupeDefault'));
          return `<li>${esc(what)}, ${Math.round(n.dist)} m${n.url ? ` — <a href="${n.url}" target="_blank" rel="noopener">${esc(t('review.dupeView'))}</a>` : ''}</li>`;
        }).join('') +
        `</ul>${esc(t('review.dupeHint'))}`;
      if (draft) draft.getPopup().update();
    }

    async function renderAuth() {
      const box = q('.auth-box');
      const upload = q('.upload');
      if (!OSMClient.isConfigured()) {
        box.innerHTML = `<p class="status warn">${esc(t('review.notConfigured'))}</p>`;
        upload.disabled = true;
        return;
      }
      upload.disabled = false;
      if (!OSMClient.isLoggedIn()) {
        box.innerHTML = `<p class="muted">${esc(t('review.loginFirst'))}</p>`;
        upload.textContent = t('review.loginUpload');
        return;
      }
      box.innerHTML = `<p class="muted">${esc(t('review.checking'))}</p>`;
      try {
        const u = await OSMClient.currentUser();
        box.innerHTML = `<p class="muted">${esc(t('review.as', { user: '\u0000' })).replace('\u0000', `<strong>${esc(u.display_name)}</strong>`)}` +
          `${OSMClient.isDev ? ` <strong>${esc(t('review.dev'))}</strong>` : ''} · <a href="#" class="logout">${esc(t('review.logout'))}</a></p>`;
        upload.textContent = t('review.upload');
        q('.logout').addEventListener('click', (e) => { e.preventDefault(); OSMClient.logout(); renderAuth(); });
      } catch (e) {
        box.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
        upload.textContent = t('review.loginUpload');
      }
    }

    q('.upload').addEventListener('click', async () => {
      const btn = q('.upload');
      btn.disabled = true;
      const tags = collectTags();
      const { lat, lng } = draft.getLatLng();
      const comment = changesetComment(tags);
      try {
        if (!OSMClient.isLoggedIn()) {
          // Keep a copy in the outbox in case the login round trip goes wrong, then leave for OSM.
          const item = outboxSave({ id: draft._outboxId, lat, lng, tags, comment, status: 'pending' });
          draft._outboxId = item.id;
          setStatus(review, esc(t('review.toOsm')));
          await OSMClient.login({ action: 'createNode', lat, lng, tags, comment, outboxId: item.id });
          return;
        }
        setStatus(review, esc(t('review.uploading')));
        const res = await uploadWithOutbox({ id: draft._outboxId, lat, lng, tags, comment });
        if (res.already) {
          finish(tHtml('outbox.already', { link: linkTo(res.already.url, t('review.node', { id: res.already.id })) }));
        } else {
          addLocalMarker(lat, lng, tags, res.r.nodeId);
          finish(addedHtml(res.r));
        }
      } catch (e) {
        console.error(e);
        if (e.outboxId) draft._outboxId = e.outboxId;
        btn.disabled = false;
        setStatus(review, `${esc(e.message)}<br><strong>${esc(t('outbox.saved'))}</strong>`, 'warn');
        renderAuth();
      }
    });

    function finish(html) {
      done.innerHTML = `<h3>${esc(t('review.thanks'))}</h3><p class="status ok">${html}</p>`;
      show(done);
      if (draft) draft.dragging.disable();
    }

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    updateLinks();
    /** Rebuilds the form texts in the current language, keeping what the user entered. */
    function relocalize() {
      const tags = collectTags();
      const step = !review.hidden ? 'review' : (!done.hidden ? 'done' : 'edit');
      if (step === 'done') return;
      const fresh = buildAddForm();
      draft._form = fresh;
      draft.setPopupContent(fresh.el);
      fresh.prefill(tags);
      if (step === 'review') fresh.openReview();
    }

    return { el, updateCoords: updateLinks, prefill, openReview, relocalize };
  }

  // ---------- Outbox: machines entered here that are not (yet) on OSM ----------
  // Saved to localStorage *before* each upload attempt and removed only after OSM confirms the
  // new node, so nothing typed in is lost when an upload fails, the tab closes or the login breaks.
  // Each entry keeps a log of every attempt (time, step, HTTP status, OSM message).
  const OUTBOX_KEY = 'vm-outbox';
  function outboxAll() {
    try { const v = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function outboxWrite(list) {
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); } catch (e) { console.error('[outbox] could not save', e); }
    if (typeof renderOutbox === 'function') renderOutbox();
  }
  const outboxGet = (id) => outboxAll().find((x) => x.id === id) || null;
  function outboxPut(item) {
    const list = outboxAll().filter((x) => x.id !== item.id);
    list.push(item);
    outboxWrite(list);
    return item;
  }
  function outboxRemove(id) { outboxWrite(outboxAll().filter((x) => x.id !== id)); }

  /** Creates or updates an entry with the latest data. */
  function outboxSave({ id, lat, lng, tags, comment, status }) {
    const now = new Date().toISOString();
    const prev = id ? outboxGet(id) : null;
    const item = Object.assign({ id: id || `vm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, created: now, attempts: 0, log: [] },
      prev || {}, { lat, lng, tags, comment, updated: now, status: status || (prev && prev.status) || 'pending' });
    return outboxPut(item);
  }

  function describeError(e) {
    return {
      at: new Date().toISOString(),
      step: e.step || null,
      status: e.status || null,
      message: String(e.message || e).slice(0, 400),
      offline: Boolean(e.offline || !navigator.onLine),
      changesetId: e.changesetId || null,
      maybeCreated: Boolean(e.maybeCreated),
    };
  }

  function outboxLog(id, e) {
    const item = outboxGet(id);
    if (!item) return null;
    const entry = describeError(e);
    item.log = (item.log || []).concat(entry).slice(-20);
    item.lastError = entry;
    item.status = 'failed';
    if (entry.maybeCreated) item.suspect = true;
    console.error('[outbox] upload failed', { id, ...entry });
    return outboxPut(item);
  }

  // Entries still marked "uploading" from an earlier visit were interrupted (tab closed, crash…).
  (function markInterrupted() {
    const list = outboxAll();
    let changed = false;
    list.forEach((x) => { if (x.status === 'uploading') { x.status = 'interrupted'; x.suspect = true; changed = true; } });
    if (changed) outboxWrite(list);
  })();
  renderOutbox();

  /** Looks for an identical machine that may already have been created by an earlier attempt. */
  async function findExisting(lat, lng, tags) {
    try {
      const here = L.latLng(lat, lng);
      const near = await OSMClient.nearbyVending(lat, lng, 10);
      return near.find((n) => here.distanceTo([n.lat, n.lon]) < 6 && (n.tags.vending || '') === (tags.vending || '')) || null;
    } catch { return null; }
  }

  /** The one place uploads happen: saves to the outbox first, removes it only after success. */
  async function uploadWithOutbox({ id, lat, lng, tags, comment }) {
    let item = outboxSave({ id, lat, lng, tags, comment, status: 'uploading' });
    if (item.attempts > 0 || item.suspect) {
      const dup = await findExisting(lat, lng, tags);
      if (dup) { outboxRemove(item.id); return { already: dup }; }
    }
    item.attempts += 1;
    item.lastAttempt = new Date().toISOString();
    outboxPut(item);
    try {
      const r = await OSMClient.createNode(lat, lng, tags, comment);
      outboxRemove(item.id);
      return { r };
    } catch (e) {
      outboxLog(item.id, e);
      e.outboxId = item.id;
      throw e;
    }
  }

  const linkTo = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${esc(text)}</a>`;
  /** Replaces {placeholder} in an escaped translation with ready-made HTML. */
  function tHtml(key, html) {
    const names = Object.keys(html);
    const marks = Object.fromEntries(names.map((k, i) => [k, String.fromCharCode(1 + i)]));
    let out = esc(t(key, marks));
    names.forEach((k, i) => { out = out.split(String.fromCharCode(1 + i)).join(html[k]); });
    return out;
  }

  function noteTextFor(tags) {
    const lines = ['Missing vending machine here. Suggested tags:'];
    for (const [k, v] of Object.entries(tags)) lines.push(`${k}=${v}`);
    lines.push('', `(reported via ${OSMClient.siteUrl})`);
    return lines.join('\n');
  }

  /** "✅ Added! Node 123 in changeset 456 …" with links, in the current language. */
  function addedHtml(r) {
    const node = `<a href="${r.nodeUrl}" target="_blank" rel="noopener">${esc(t('review.node', { id: r.nodeId }))}</a>`;
    const cs = `<a href="${r.changesetUrl}" target="_blank" rel="noopener">${esc(t('review.changeset', { id: r.changesetId }))}</a>`;
    return esc(t('review.added', { node: '\u0001', changeset: '\u0002' })).replace('\u0001', node).replace('\u0002', cs);
  }

  /** After returning from the OSM login page: finish the upload the user had started. */
  async function resumeAfterLogin() {
    let res;
    try {
      res = await OSMClient.resume();
    } catch (e) {
      const p = e.payload;
      if (p && p.outboxId) { e.step = e.step || 'login'; outboxLog(p.outboxId, e); }
      if (p && p.lat != null) {
        map.setView([p.lat, p.lng], 18);
        L.popup({ maxWidth: 300 }).setLatLng([p.lat, p.lng])
          .setContent(`<div class="vm-popup add-form"><h3>${esc(t('review.notUploaded'))}</h3><p class="status warn">${esc(e.message)}</p>` +
            `<p class="muted small">${esc(t('review.nothingChanged'))}${p.outboxId ? ' ' + esc(t('outbox.saved')) : ''}</p></div>`).openOn(map);
      } else {
        showError(e.message, false);
      }
      return;
    }
    if (!res || !res.payload || res.payload.action !== 'createNode') return;
    // Logged in now — reopen the draft with everything filled in and let the user confirm.
    const { lat, lng, tags } = res.payload;
    // Put the pin low on the screen so the (tall) summary popup above it fits.
    map.setView([lat, lng], 18, { animate: false });
    map.panBy([0, -Math.round(map.getSize().y * 0.35)], { animate: false });
    const form = placeDraft(L.latLng(lat, lng));
    draft._outboxId = res.payload.outboxId || null;
    form.prefill(tags);
    form.openReview();

  }

  // ---------- Machine store (prebuilt file + live Overpass + own uploads) ----------
  const seenIds = new Set();
  const entryById = new Map();
  const counts = {};
  const KEEP_KEYS = ['vending', 'name', 'operator', 'brand', 'opening_hours', 'level', 'note'];

  /** Adds one machine unless it is already on the map. Returns the marker entry or null. */
  function addMachine(id, lat, lon, props) {
    if (seenIds.has(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    seenIds.add(id);
    const cats = categoriesOf(props);
    cats.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
    const marker = L.marker([lat, lon], { icon: iconFor(cats[0]), title: props.name || props.vending || '' });
    marker.bindPopup(() => popupHtml(props, cats), { maxWidth: 300 });
    marker._vmId = id;
    const entry = { id, marker, cats, props };
    entries.push(entry);
    entryById.set(id, entry);
    return entry;
  }

  /** Adds new entries to the visible cluster (respecting the filter) and refreshes counts. */
  function showAdded(added) {
    if (!added.length) return;
    cluster.addLayers(added.filter((e) => e.cats.some((c) => active.has(c))).map((e) => e.marker));
    buildFilters(counts);
    updateCountText();
  }

  /** Shows a freshly uploaded machine immediately, before the nightly data refresh. */
  function addLocalMarker(lat, lon, tags, nodeId) {
    const props = Object.assign({ osm_type: 'node', osm_id: nodeId }, tags);
    delete props.amenity;
    const e = addMachine(`node/${nodeId}`, lat, lon, props);
    if (e) showAdded([e]);
  }

  // ---------- Tiles: machines are loaded per grid cell as the map moves ----------
  // tiles/index.json lists every cell that has machines as [level, i, j, count, hash] (see
  // scripts/build-tiles.mjs). Zoomed out, the map shows how many machines each area has, straight
  // from the index (one small download). Zoomed in, it fetches the cells on screen, nearest first,
  // a few at a time; cells that scrolled away are cancelled. The hash in the URL changes only when
  // a cell's content does, so cached cells stay valid across nightly data updates.
  const TILES = {
    base: 'tiles/',
    minZoom: 10,        // below this: counts per area instead of single machines
    concurrency: 3,
    // Also load cells this fraction of the view beyond its edges (after the visible ones),
    // except on data saver or a slow connection.
    pad: conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType) ? 0 : 0.25,
    timeoutMs: 30000,
    debounceMs: 250,
    bubblePx: 72,       // rough on-screen size of one counted area when zoomed out
  };
  let tileIndex = null;          // { cell, cells: [{ name, n, h, lat, lon, size, bounds }] }
  const loadedTiles = new Set(); // cell names
  const failedTiles = new Set();
  const tileJobs = new Map();    // name -> { ctrl, cell, timedOut }
  let tileQueue = [];
  let tileWorkers = 0;
  let tileTimer = null;
  let tileIdle = [];             // resolvers waiting for all loads to finish

  function setTileIndex(ix) {
    tileIndex = {
      cell: ix.cell,
      cells: ix.cells.map(([level, i, j, n, h]) => {
        const size = ix.cell / 2 ** level;
        return { name: `${level}_${i}_${j}`, n, h, size, lat: i * size, lon: j * size,
          bounds: L.latLngBounds([i * size, j * size], [(i + 1) * size, (j + 1) * size]) };
      }),
    };
  }

  /** Tile row [id, lat, lon, tags] with id like "n123" -> what addMachine takes. */
  const OSM_TYPES = { n: 'node', w: 'way', r: 'relation' };
  function fromTile([sid, lat, lon, tags]) {
    const type = OSM_TYPES[sid[0]], osmId = Number(sid.slice(1));
    return [`${type}/${osmId}`, lat, lon, Object.assign({ osm_type: type, osm_id: osmId }, tags)];
  }
  function addCompact(list) {
    const added = [];
    for (const [id, lat, lon, props] of list) {
      const entry = addMachine(id, lat, lon, props);
      if (entry) added.push(entry);
    }
    return added;
  }

  function setLiveStatus(text, kind) {
    const el = $('live-status');
    el.hidden = !text;
    el.className = 'live-status ' + (kind || '');
    el.textContent = text || '';
  }

  function scheduleTiles() {
    clearTimeout(tileTimer);
    tileTimer = setTimeout(updateTiles, TILES.debounceMs);
  }
  map.on('moveend', scheduleTiles);
  window.addEventListener('online', scheduleTiles);

  /** Loads what the current view needs; resolves once nothing is loading any more. */
  function updateTiles() {
    if (!tileIndex) return Promise.resolve();
    const zoomedOut = map.getZoom() < TILES.minZoom;
    showOverview(zoomedOut);
    const view = map.getBounds();
    const area = view.pad(TILES.pad);
    for (const job of tileJobs.values()) if (zoomedOut || !job.cell.bounds.intersects(area)) job.ctrl.abort();
    const center = map.getCenter();
    tileQueue = zoomedOut ? [] : tileIndex.cells
      .filter((c) => !loadedTiles.has(c.name) && !tileJobs.has(c.name) && c.bounds.intersects(area))
      .map((c) => ({ c, d: (c.bounds.intersects(view) ? 0 : 1e8) + center.distanceTo(c.bounds.getCenter()) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.c);
    if (tileQueue.length) failedTiles.clear();
    while (tileWorkers < TILES.concurrency && tileQueue.length) tileWorker();
    renderTileStatus();
    return tileWorkers ? new Promise((resolve) => tileIdle.push(resolve)) : Promise.resolve();
  }

  async function tileWorker() {
    tileWorkers++;
    while (tileQueue.length) {
      const cell = tileQueue.shift();
      if (loadedTiles.has(cell.name) || tileJobs.has(cell.name)) continue;
      const job = { ctrl: new AbortController(), cell, timedOut: false };
      tileJobs.set(cell.name, job);
      renderTileStatus();
      const timer = setTimeout(() => { job.timedOut = true; job.ctrl.abort(); }, TILES.timeoutMs);
      try {
        const res = await fetch(`${TILES.base}c/${cell.name}.json?h=${cell.h}`, { signal: job.ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        loadedTiles.add(cell.name);
        failedTiles.delete(cell.name);
        showAdded(addCompact(rows.map(fromTile)));
      } catch (err) {
        if (err.name !== 'AbortError' || job.timedOut) { failedTiles.add(cell.name); console.warn('Tile failed', cell.name, err); }
      } finally {
        clearTimeout(timer);
        tileJobs.delete(cell.name);
        renderTileStatus();
      }
    }
    if (--tileWorkers === 0) { tileIdle.forEach((resolve) => resolve()); tileIdle = []; }
  }

  function renderTileStatus() {
    const busy = tileJobs.size + tileQueue.length;
    if (busy) setLiveStatus(t('live.loading'), 'busy');
    else if (failedTiles.size) setLiveStatus(t('live.busy'), 'warn');
    else setLiveStatus('');
  }

  // ---- overview: machine counts per area when zoomed out ----
  const overview = L.layerGroup();
  const compactNum = (n) => {
    try { return new Intl.NumberFormat(I18N.lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch { return String(n); }
  };
  function showOverview(on) {
    overviewOn = on;
    if (on) {
      if (map.hasLayer(cluster)) map.removeLayer(cluster);
      if (!map.hasLayer(overview)) map.addLayer(overview);
      renderOverview();
    } else if (map.hasLayer(overview)) {
      map.removeLayer(overview);
      map.addLayer(cluster);
      updateCountText();
    }
  }
  function renderOverview() {
    overview.clearLayers();
    // Group cells into blocks of 2^k level-0 cells so each block is about bubblePx wide on screen.
    const cellPx = tileIndex.cell / 360 * 256 * 2 ** map.getZoom();
    const block = tileIndex.cell * 2 ** Math.max(0, Math.ceil(Math.log2(TILES.bubblePx / cellPx)));
    const groups = new Map();
    for (const c of tileIndex.cells) {
      const key = `${Math.floor(c.lat / block)}_${Math.floor(c.lon / block)}`;
      let g = groups.get(key);
      if (!g) groups.set(key, g = { n: 0, lat: 0, lon: 0, bounds: L.latLngBounds(c.bounds.getSouthWest(), c.bounds.getNorthEast()) });
      g.n += c.n;
      g.lat += c.n * (c.lat + c.size / 2);
      g.lon += c.n * (c.lon + c.size / 2);
      g.bounds.extend(c.bounds);
    }
    const view = map.getBounds();
    const area = view.pad(0.2);
    let inView = 0;
    for (const g of groups.values()) {
      const pos = L.latLng(g.lat / g.n, g.lon / g.n);
      if (view.contains(pos)) inView += g.n;
      if (!area.contains(pos)) continue;
      const cls = g.n < 100 ? 'small' : g.n < 1000 ? 'medium' : 'large';
      const m = L.marker(pos, {
        icon: L.divIcon({ className: `marker-cluster marker-cluster-${cls}`, html: `<div><span>${compactNum(g.n)}</span></div>`, iconSize: [40, 40] }),
        title: t('count.all', { n: fmt(g.n) }),
      });
      m.on('click', () => map.fitBounds(g.bounds));
      overview.addLayer(m);
    }
    // Counts from the index ignore the category filter (they are totals per area).
    $('count').textContent = t('count.all', { n: fmt(inView) });
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && addMode) setAddMode(false); });

  // ---------- Shareable links (#map=zoom/lat/lon&m=node/123) ----------
  let selectedId = null;
  let hashTimer = null;
  let hashReady = false;

  function parseHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const out = {};
    const m = (h.get('map') || '').split('/').map(Number);
    if (m.length === 3 && m.every(Number.isFinite) && Math.abs(m[1]) <= 90 && Math.abs(m[2]) <= 180) {
      out.zoom = Math.min(19, Math.max(2, Math.round(m[0])));
      out.lat = m[1];
      out.lon = m[2];
    }
    const sel = h.get('m');
    if (sel && /^(node|way|relation)\/\d+$/.test(sel)) out.selected = sel;
    return out;
  }

  function hashFor(zoom, lat, lon, sel) {
    return `#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}${sel ? `&m=${sel}` : ''}`;
  }

  /** Keeps the address bar in sync with the view, so it can be copied at any time. */
  function updateHash() {
    if (!hashReady) return;
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const c = map.getCenter();
      const h = hashFor(map.getZoom(), c.lat, c.lng, selectedId);
      if (location.hash !== h) history.replaceState(history.state, '', location.pathname + location.search + h);
    }, 200);
  }

  function shareUrlFor(id) {
    const e = entryById.get(id);
    const ll = e ? e.marker.getLatLng() : map.getCenter();
    return location.origin + location.pathname + location.search + hashFor(Math.max(map.getZoom(), 17), ll.lat, ll.lng, id);
  }

  map.on('moveend', updateHash);
  map.on('popupopen', (e) => {
    const id = (e.popup._source && e.popup._source._vmId) || e.popup._vmId;
    if (id) { selectedId = id; updateHash(); }
  });
  map.on('popupclose', (e) => {
    const id = (e.popup._source && e.popup._source._vmId) || e.popup._vmId;
    if (id && id === selectedId) { selectedId = null; updateHash(); }
  });

  // Share button inside machine popups: native share sheet on phones, clipboard elsewhere.
  document.addEventListener('click', async (ev) => {
    const a = ev.target.closest && ev.target.closest('.share-link');
    if (!a) return;
    ev.preventDefault();
    const url = shareUrlFor(a.dataset.id);
    const e = entryById.get(a.dataset.id);
    const title = (e && (e.props.name || e.props.brand)) || t('popup.title');
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      a.textContent = t('popup.copied');
    } catch (err) {
      if (err && err.name === 'AbortError') return; // share sheet dismissed
      window.prompt(t('popup.copyPrompt'), url);
    }
    setTimeout(() => { a.textContent = t('popup.share'); }, 2000);
  });

  /** Opens the popup of a machine by id, loading it from OSM first if it isn't on the map yet. */
  async function selectMachine(id, fly) {
    let e = entryById.get(id);
    if (!e) {
      const [type, osmId] = id.split('/');
      try {
        const el = await OSMClient.fetchElement(type, osmId);
        if (el && el.tags.amenity === 'vending_machine') {
          const props = { osm_type: type, osm_id: Number(osmId) };
          for (const k of Object.keys(el.tags)) if (KEEP_KEYS.includes(k) || k.startsWith('payment:')) props[k] = el.tags[k];
          e = addMachine(id, el.lat, el.lon, props);
          if (e) showAdded([e]);
        }
      } catch (err) { console.warn('Could not load shared machine', err); }
    }
    if (!e) {
      showError(t('err.notFound'), false);
      return;
    }
    selectedId = id;
    if (fly) map.setView(e.marker.getLatLng(), Math.max(map.getZoom(), 17), { animate: false });
    const standalone = () => {
      const pop = L.popup({ maxWidth: 300 }).setLatLng(e.marker.getLatLng()).setContent(popupHtml(e.props, e.cats));
      pop._vmId = id;
      pop.openOn(map);
      updateHash();
    };
    if (!cluster.hasLayer(e.marker)) { standalone(); return; } // hidden by the visitor's own filter
    // zoomToShowLayer doesn't always call back after spiderfying close markers, so we also
    // listen for 'spiderfied' and fall back to a timer; whichever comes first opens the popup.
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      if (e.marker._icon) e.marker.openPopup(); else standalone();
    };
    cluster.once('spiderfied', () => setTimeout(open, 50));
    cluster.zoomToShowLayer(e.marker, open);
    setTimeout(open, 1500);
  }

  /** Applies a pasted/opened link. Returns true if the hash set the view. */
  function applyHash() {
    const h = parseHash();
    let setView = false;
    if (h.zoom != null) { map.setView([h.lat, h.lon], h.zoom, { animate: false }); setView = true; }
    if (h.selected) selectMachine(h.selected, !setView);
    return setView;
  }
  window.addEventListener('hashchange', () => { applyHash(); });

  // ---------- Overlays ----------
  function showError(msg, retry) {
    const box = $('error');
    box.innerHTML = `<strong>${esc(t('err.title'))}</strong><span>${esc(msg)}</span>` +
      `<button type="button">${esc(retry ? t('err.retry') : t('err.dismiss'))}</button>`;
    box.hidden = false;
    box.querySelector('button').onclick = () => { box.hidden = true; if (retry) load(); };
  }

  function formatStamp(iso) {
    if (!iso) return t('stamp.unknown');
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString(I18N.lang, { dateStyle: 'medium', timeStyle: 'short' });
  }

  let dataMeta = null;
  let dataOffline = false; // the service worker answered with its cached copy (no or too slow network)
  function renderStamp() {
    if (!dataMeta) return;
    $('stamp').textContent = t('stamp.asOf', { date: formatStamp(dataMeta.timestamp_osm_base) }) +
      (dataOffline ? ` · ${t('stamp.offline')}` : '');
    $('stamp').title = dataMeta.region ? t('stamp.region', { region: dataMeta.region }) : '';
  }

  // ---------- Load data ----------
  // With the service worker, a slow network falls back to the cached copy after a few seconds.
  // Without it (first visit, old browser) we wait up to LOAD_TIMEOUT_MS, then offer a retry,
  // which also happens by itself once the browser reports it is back online.
  const LOAD_TIMEOUT_MS = 45000;
  const SLOW_HINT_MS = 8000;
  let loadFailed = false;
  window.addEventListener('online', () => { if (loadFailed) load(); });

  async function load() {
    $('loading').hidden = false;
    $('error').hidden = true;
    loadFailed = false;
    const loadingText = $('loading').querySelector('span');
    loadingText.textContent = t('loading');
    const slowTimer = setTimeout(() => { loadingText.textContent = t('loading.slow'); }, SLOW_HINT_MS);
    const ctrl = new AbortController();
    const abortTimer = setTimeout(() => ctrl.abort(), LOAD_TIMEOUT_MS);
    try {
      let res;
      try {
        res = await fetch(INDEX_URL, { cache: 'no-cache', signal: ctrl.signal });
      } catch (e) {
        throw new Error(ctrl.signal.aborted ? t('err.timeout') : !navigator.onLine ? t('err.offline') : e.message);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${INDEX_URL}`);
      dataOffline = res.headers.get('X-VM-Offline') === '1';
      const ix = await res.json();
      if (!ix || !Array.isArray(ix.cells)) throw new Error('Tile index is not valid.');
      setTileIndex(ix);
      dataMeta = ix;
      renderStamp();
      buildFilters(counts);
      updateCountText();
      $('loading').hidden = true; // from here on the status pill shows progress per area
      // Load the cells on screen before opening a shared machine, so it is found among them.
      await updateTiles();
      applyHash();
    } catch (err) {
      console.error(err);
      loadFailed = true;
      showError(t('err.load', { msg: err.name === 'AbortError' ? t('err.timeout') : err.message }), true);
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      $('loading').hidden = true;
    }
    resumeAfterLogin();
    hashReady = true;
    updateHash();
  }

  load();

  // ---------- Offline support ----------
  // sw.js caches the app, the data and every map tile seen, so the map opens without signal.
  // Off on a local dev server (it would serve stale files while editing) unless ?sw=1 is given.
  if ('serviceWorker' in navigator) {
    const dev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!dev || new URLSearchParams(location.search).has('sw')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw] registration failed', e));
      });
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
  }
})();
