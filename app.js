/* Vending machine map — static frontend. Data: data/vending.geojson (prebuilt). */
(function () {
  'use strict';

  const DATA_URL = 'data/vending.geojson';
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
  // Open at the shared link's view or the prebuilt region right away, so tiles start loading
  // while the data is still downloading (instead of first loading a zoom-6 view we then leave).
  const REGION_BOUNDS = [[50.93, 8.95], [51.33, 9.60]]; // keep in sync with REGION_BBOX in scripts/fetch-data.mjs
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
  // crossOrigin: tiles are fetched with CORS so the service worker can keep them for offline use
  // (no-CORS responses can't be inspected and count several MB each against the storage quota).
  const BASEMAPS = {
    map: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true, attribution: OSM_ATTR }),
    satellite: L.layerGroup([
      L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19, maxNativeZoom: 18, crossOrigin: true,
        attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
      }),
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

  /** "Schladenweg 3, Haddamar, Fritzlar" from the loc:* properties added by scripts/fetch-data.mjs. */
  function whereText(props) {
    const street = [props['loc:street'], props['loc:housenumber']].filter(Boolean).join(' ');
    return [street, props['loc:place'], props['loc:city']].filter(Boolean).join(', ');
  }

  function popupHtml(props, cats) {
    const type = props.osm_type, id = props.osm_id;
    const title = props.name || props.brand || (TYPE_BY_KEY[cats[0]] || {}).label || t('popup.title');
    const rows = [];
    const vend = (props.vending || '').split(/[;,]/).filter((v) => v.trim());
    rows.push([t('popup.type'), vend.length ? vend.map((v) => esc(itemLabel(v))).join(', ') : esc(t('popup.unknown'))]);
    const where = whereText(props);
    if (where) rows.push([t('popup.where'), esc(where)]);
    if (props['loc:near']) rows.push([t('popup.near'), esc(props['loc:near'])]);
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

  // ---------- Live loading for areas outside the prebuilt region ----------
  // The map is split into a grid of cells. When the view settles on cells we have no data for,
  // one Overpass query fetches them (debounced, one request at a time, cached for the session).
  const LIVE = {
    enabled: false,        // live Overpass loading outside the prebuilt region (off: too slow in practice)
    cell: 0.2,             // degrees (~22 km north-south); cache unit
    block: 2,              // cells per side per request (0.4° ≈ 45 × 30 km) — small queries answer fast
    minZoom: 10,           // below this the area is too large to query politely
    maxCells: 80,          // safety cap per view
    debounceMs: 400,
    concurrency: 2,        // public Overpass allows ~2 parallel requests per client
    timeoutS: 25,          // short server timeout = scheduled sooner by Overpass
    cacheTtlMs: 12 * 3600 * 1000,
    endpoints: ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'],
  };
  const loadedCells = new Set();
  const pendingCells = new Set();
  const inflight = new Map();   // blockKey -> { ctrl, bounds, cells }
  let liveTimer = null;
  let liveUsed = false;
  let liveHooked = false;
  let liveRun = 0;

  const cellKey = (i, j) => `${i}:${j}`;
  function cellsIn(bounds) {
    const out = [];
    const i0 = Math.floor(bounds.getSouth() / LIVE.cell), i1 = Math.floor(bounds.getNorth() / LIVE.cell);
    const j0 = Math.floor(bounds.getWest() / LIVE.cell), j1 = Math.floor(bounds.getEast() / LIVE.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push([i, j]);
    return out;
  }
  const cellOf = (lat, lon) => [Math.floor(lat / LIVE.cell), Math.floor(lon / LIVE.cell)];
  const cellBounds = ([i, j]) => L.latLngBounds([i * LIVE.cell, j * LIVE.cell], [(i + 1) * LIVE.cell, (j + 1) * LIVE.cell]);

  /** Marks grid cells that lie completely inside the prebuilt bbox as already loaded. */
  function markPrebuilt(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return;
    const [s, w, n, e] = bbox;
    for (const [i, j] of cellsIn(L.latLngBounds([s, w], [n, e]))) {
      const cs = i * LIVE.cell, cw = j * LIVE.cell;
      if (cs >= s && cw >= w && cs + LIVE.cell <= n && cw + LIVE.cell <= e) loadedCells.add(cellKey(i, j));
    }
  }

  // ---- per-cell cache in localStorage (instant revisits, also after reload) ----
  const CACHE_PREFIX = 'vm-cell:';
  if (!LIVE.enabled) {
    // Feature is off: free the storage used by earlier versions.
    try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  }
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v || Date.now() - v.t > LIVE.cacheTtlMs) { localStorage.removeItem(CACHE_PREFIX + key); return null; }
      return v.e;
    } catch { return null; }
  }
  function cacheSet(key, elements) {
    const val = JSON.stringify({ t: Date.now(), e: elements });
    try { localStorage.setItem(CACHE_PREFIX + key, val); } catch {
      // Storage full: drop all cached cells once and try again; give up silently otherwise.
      try {
        Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(CACHE_PREFIX + key, val);
      } catch { /* no caching then */ }
    }
  }

  /** Overpass element -> compact [id, lat, lon, props] (what we cache and add to the map). */
  function compact(el) {
    const lat = el.lat != null ? el.lat : el.center && el.center.lat;
    const lon = el.lon != null ? el.lon : el.center && el.center.lon;
    const props = { osm_type: el.type, osm_id: el.id };
    const tags = el.tags || {};
    for (const k of Object.keys(tags)) if (KEEP_KEYS.includes(k) || k.startsWith('payment:')) props[k] = tags[k];
    return [`${el.type}/${el.id}`, lat, lon, props];
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

  function scheduleLive() {
    if (!LIVE.enabled) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(loadLive, LIVE.debounceMs);
  }

  async function loadLive() {
    const run = ++liveRun;
    const view = map.getBounds();

    // Cancel requests for areas that are no longer on screen.
    for (const [key, job] of inflight) {
      if (!job.bounds.intersects(view)) {
        job.ctrl.abort();
        job.cells.forEach((c) => pendingCells.delete(c));
        inflight.delete(key);
      }
    }

    let missing = cellsIn(view).filter(([i, j]) => !loadedCells.has(cellKey(i, j)) && !pendingCells.has(cellKey(i, j)));
    if (!missing.length) { if (!inflight.size) setLiveStatus(''); return; }
    if (map.getZoom() < LIVE.minZoom || missing.length > LIVE.maxCells) {
      setLiveStatus(t('live.zoomIn'), 'hint');
      return;
    }

    // 1) Cached cells show up immediately.
    const fromCache = [];
    missing = missing.filter(([i, j]) => {
      const cached = cacheGet(cellKey(i, j));
      if (!cached) return true;
      fromCache.push(...cached);
      loadedCells.add(cellKey(i, j));
      return false;
    });
    let addedTotal = 0;
    if (fromCache.length) { const a = addCompact(fromCache); addedTotal += a.length; showAdded(a); markLive(); }
    if (!missing.length) { finishStatus(addedTotal); return; }

    // 2) Group the rest into small blocks, nearest to the map centre first.
    const groups = new Map();
    for (const [i, j] of missing) {
      const key = `${Math.floor(i / LIVE.block)}:${Math.floor(j / LIVE.block)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([i, j]);
    }
    const center = map.getCenter();
    const blocks = [...groups.entries()].map(([key, cells]) => {
      const bounds = cells.reduce((b, c) => b.extend(cellBounds(c)), cellBounds(cells[0]));
      return { key, cells, bounds, dist: center.distanceTo(bounds.getCenter()) };
    }).sort((x, y) => x.dist - y.dist);
    blocks.forEach((b) => b.cells.forEach(([i, j]) => pendingCells.add(cellKey(i, j))));

    let done = 0, failed = 0;
    const total = blocks.length;
    const progress = () => { if (run === liveRun) setLiveStatus(`${t('live.loading')} (${done}/${total})`, 'busy'); };
    progress();

    const queue = blocks.slice();
    async function worker() {
      while (queue.length) {
        const b = queue.shift();
        if (!b.bounds.intersects(map.getBounds())) { b.cells.forEach(([i, j]) => pendingCells.delete(cellKey(i, j))); done++; continue; }
        const ctrl = new AbortController();
        inflight.set(b.key + '#' + run, { ctrl, bounds: b.bounds, cells: b.cells.map(([i, j]) => cellKey(i, j)) });
        try {
          const json = await overpass(blockQuery(b.bounds), ctrl.signal);
          // Split the answer per cell for the cache, then add to the map right away.
          const perCell = new Map(b.cells.map(([i, j]) => [cellKey(i, j), []]));
          for (const el of json.elements || []) {
            const c = compact(el);
            if (!Number.isFinite(c[1]) || !Number.isFinite(c[2])) continue;
            const k = cellKey(...cellOf(c[1], c[2]));
            if (perCell.has(k)) perCell.get(k).push(c);
          }
          for (const [k, list] of perCell) { cacheSet(k, list); loadedCells.add(k); }
          const added = addCompact([...perCell.values()].flat());
          addedTotal += added.length;
          showAdded(added);
          markLive();
        } catch (err) {
          if (err.name !== 'AbortError') { failed++; console.warn('Live block failed', err); }
        } finally {
          b.cells.forEach(([i, j]) => pendingCells.delete(cellKey(i, j)));
          inflight.delete(b.key + '#' + run);
          done++;
          progress();
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(LIVE.concurrency, blocks.length) }, worker));
    if (run !== liveRun && inflight.size) return; // a newer run is still busy; let it report
    if (failed) setLiveStatus(t('live.busy'), 'warn');
    else finishStatus(addedTotal);
  }

  function blockQuery(bounds) {
    const bb = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].map((n) => n.toFixed(4)).join(',');
    return `[out:json][timeout:${LIVE.timeoutS}][bbox:${bb}];nwr["amenity"="vending_machine"];out center qt;`;
  }

  function markLive() { if (!liveUsed) { liveUsed = true; renderStamp(); } }

  function finishStatus(n) {
    setLiveStatus(n ? (n === 1 ? t('live.loaded1') : t('live.loadedN', { n: fmt(n) })) : t('live.none'), 'ok');
    setTimeout(() => { if ($('live-status').classList.contains('ok')) setLiveStatus(''); }, 2500);
  }

  async function overpass(query, signal) {
    let lastErr;
    for (const url of LIVE.endpoints) {
      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      if (signal) { if (signal.aborted) ctrl.abort(); else signal.addEventListener('abort', onAbort); }
      const timer = setTimeout(() => ctrl.abort(), (LIVE.timeoutS + 20) * 1000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error(json.remark);
        return json;
      } catch (err) {
        if (signal && signal.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
        lastErr = err;
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    }
    throw lastErr;
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
      (dataOffline ? ` · ${t('stamp.offline')}` : '') + (liveUsed ? ` · ${t('stamp.live')}` : '');
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
        res = await fetch(DATA_URL, { cache: 'no-cache', signal: ctrl.signal });
      } catch (e) {
        throw new Error(ctrl.signal.aborted ? t('err.timeout') : !navigator.onLine ? t('err.offline') : e.message);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${DATA_URL}`);
      dataOffline = res.headers.get('X-VM-Offline') === '1';
      const gj = await res.json();
      if (!gj || !Array.isArray(gj.features)) throw new Error('Data file is not valid GeoJSON.');

      const added = [];
      for (const f of gj.features) {
        if (!f.geometry || f.geometry.type !== 'Point') continue;
        const [lon, lat] = f.geometry.coordinates;
        const props = f.properties || {};
        const id = f.id || `${props.osm_type}/${props.osm_id}`;
        const entry = addMachine(id, lat, lon, props);
        if (entry) added.push(entry);
      }
      buildFilters(counts);
      applyFilter();

      const meta = gj.metadata || {};
      dataMeta = meta;
      renderStamp();
      markPrebuilt(meta.bbox);

      const fromLink = applyHash();
      if (fromLink) {
        // view came from a shared link
      } else if (Array.isArray(meta.bbox) && meta.bbox.length === 4 && String(meta.bbox) !== String(REGION_BOUNDS.flat())) {
        // the data covers another region than the one the map opened at (REGION_BOUNDS out of sync)
        const [s, w, n, e] = meta.bbox;
        map.fitBounds([[s, w], [n, e]], { animate: false });
      }
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
    // Live loading starts with the first map move (not on page load), to spare Overpass.
    if (!liveHooked) {
      liveHooked = true;
      map.on('moveend', scheduleLive);
      if (location.hash) scheduleLive(); // opened via a link: load the area it points to
    }
    hashReady = true;
    updateHash();
  }

  load();

  // What search.js needs from the map (kept small so the two files stay independent).
  window.VM = {
    map, esc, itemLabel, selectMachine, whereText,
    get entries() { return entries; },
    typeOf: (key) => TYPE_BY_KEY[key],
  };

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
