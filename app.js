/* Vending machine map — static frontend. Data: data/vending.geojson (prebuilt). */
(function () {
  'use strict';

  const DATA_URL = 'data/vending.geojson';

  // Groups of OSM vending=* values (see docs/vending-values.md for the worldwide list).
  // Order matters for the legend; a machine's marker uses the group of its first vending value.
  const TYPES = [
    { key: 'drinks', label: 'Drinks', emoji: '🥤', color: '#1f77b4',
      values: ["drinks", "coffee", "water", "milk", "beverages", "wine", "beer", "hot_drinks", "alcohol", "juice", "tea", "raw_milk"] },
    { key: 'food', label: 'Food & snacks', emoji: '🥪', color: '#2ca02c',
      values: ["food", "sweets", "eggs", "bread", "pizza", "ice_cream", "snacks", "chewing_gums", "meat", "potatoes", "honey", "cheese", "rice_polishing", "sausages", "snack", "vegetables", "noodles", "fruit", "sausage", "strawberries", "fruits", "pasta", "butter", "french_fries"] },
    { key: 'tobacco', label: 'Tobacco', emoji: '🚬', color: '#7f4f24',
      values: ["cigarettes", "e-cigarettes", "cbd", "cannabis", "tobacco"] },
    { key: 'tickets', label: 'Tickets & payment', emoji: '🎫', color: '#3949ab',
      values: ["parking_tickets", "public_transport_tickets", "admission_tickets", "subscription", "toll", "telephone_vouchers", "tickets", "ticket_validator", "coin_change_machine", "subway_tokens", "public_transport_plans", "lottery", "sim_cards", "coin_rolls"] },
    { key: 'health', label: 'Health & hygiene', emoji: '💊', color: '#d62781',
      values: ["condoms", "contact_lenses", "feminine_hygiene", "chemist", "syringes", "pharmacy", "sex_toys", "first_aid", "toothpaste", "toothbrushes", "toothbrushs"] },
    { key: 'pets', label: 'Pets & animals', emoji: '🐕', color: '#8c6d00',
      values: ["excrement_bags", "animal_feed", "pet", "fishing_bait", "pet_food", "fishing_tackle"] },
    { key: 'vehicles', label: 'Fuel & bikes', emoji: '⛽', color: '#c92a2a',
      values: ["fuel", "bicycle_tube", "gas", "battery_swap", "gas_bottles"] },
    { key: 'services', label: 'Services & returns', emoji: '♻️', color: '#0b7285',
      values: ["bottle_return", "newspapers", "ice_cubes", "stamps", "parcel_pickup", "locker", "key", "photos", "ice", "parcel_mail_in", "laundry", "trash_bag", "laundry_detergent", "photo"] },
    { key: 'goods', label: 'Goods & novelties', emoji: '🎁', color: '#7048e8',
      values: ["movies", "elongated_coin", "toys", "flowers", "electronics", "candles", "art", "books", "flower_seeds", "coin", "wood_pellet", "umbrellas", "clothes", "swimming_items", "ink_cartridges"] },
    { key: 'other', label: 'Other / unknown', emoji: '📦', color: '#6c757d', values: [] },
  ];
  const TYPE_BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));
  const GROUP_OF = {};
  TYPES.forEach((t) => t.values.forEach((v) => { GROUP_OF[v] = t.key; }));

  // Common, documented values offered as quick picks in the "add a machine" form.
  const ADD_CHOICES = [
    ['drinks', '🥤 Drinks'], ['coffee', '☕ Coffee'], ['water', '💧 Water'], ['milk', '🥛 Milk'],
    ['sweets', '🍫 Sweets'], ['snacks', '🥨 Snacks'], ['food', '🥪 Food'], ['eggs', '🥚 Eggs'],
    ['bread', '🍞 Bread'], ['ice_cream', '🍦 Ice cream'], ['meat', '🥩 Meat'], ['honey', '🍯 Honey'],
    ['cigarettes', '🚬 Cigarettes'], ['e-cigarettes', '💨 E-cigarettes'],
    ['parking_tickets', '🅿️ Parking'], ['public_transport_tickets', '🚌 Transport tickets'],
    ['admission_tickets', '🎟️ Admission'], ['condoms', '🩹 Condoms'], ['feminine_hygiene', '🌸 Feminine hygiene'],
    ['excrement_bags', '🐕 Dog bags'], ['animal_feed', '🦆 Animal feed'], ['fishing_bait', '🎣 Fishing bait'],
    ['fuel', '⛽ Fuel'], ['bicycle_tube', '🚲 Bicycle tubes'], ['bottle_return', '♻️ Bottle return'],
    ['newspapers', '📰 Newspapers'], ['stamps', '✉️ Stamps'], ['parcel_pickup', '📦 Parcel pickup'],
    ['toys', '🧸 Toys'], ['flowers', '💐 Flowers'],
  ];

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

  // ---------- Add a missing machine ----------
  // Two ways to contribute: open the OSM editor (iD) at that spot, or leave an
  // anonymous OSM note that mappers can turn into a proper node.
  const OSM_API = 'https://api.openstreetmap.org/api/0.6';
  const SITE_URL = location.origin + location.pathname;
  let addMode = false;
  let draft = null;
  let addBtn = null;

  const AddControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      addBtn = L.DomUtil.create('button', 'locate-btn add-btn', wrap);
      addBtn.type = 'button';
      addBtn.title = 'Add a missing vending machine';
      addBtn.setAttribute('aria-label', 'Add a missing vending machine');
      addBtn.setAttribute('aria-pressed', 'false');
      addBtn.textContent = '＋';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(addBtn, 'click', () => setAddMode(!addMode));
      return wrap;
    },
  });
  map.addControl(new AddControl());

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
  }

  function buildAddForm() {
    const el = document.createElement('form');
    el.className = 'vm-popup add-form';
    el.noValidate = true;
    el.innerHTML = `
      <h3>Add a vending machine</h3>
      <p class="muted">Drag the pin to the exact spot. <span class="coords"></span></p>
      <fieldset class="type-chips"><legend>What does it sell?</legend>
        ${ADD_CHOICES.map(([v, label]) =>
          `<label class="chip"><input type="checkbox" name="vending" value="${v}"><span>${esc(label)}</span></label>`).join('')}
        <input type="text" name="vending_other" placeholder="Other (e.g. eggs, excrement_bags)" maxlength="80">
      </fieldset>
      <label class="field">Details <span class="muted">(optional)</span>
        <textarea name="details" rows="3" maxlength="1500" placeholder="Operator/brand, payment (coins, cards…), opening hours, indoors/level…"></textarea>
      </label>
      <div class="add-actions">
        <button type="submit" class="primary">Send as OSM note</button>
        <a class="editor-link" target="_blank" rel="noopener">Add it myself in the OSM editor ↗</a>
      </div>
      <p class="muted small">Notes are public on openstreetmap.org and need no account. A mapper reviews them and adds the machine. New machines show up here after the next nightly data update.</p>
      <p class="status" role="status" hidden></p>`;

    const coordsEl = el.querySelector('.coords');
    const editorLink = el.querySelector('.editor-link');
    const status = el.querySelector('.status');
    const submit = el.querySelector('button[type=submit]');

    function updateCoords() {
      const { lat, lng } = draft.getLatLng();
      coordsEl.textContent = `(${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      editorLink.href = `https://www.openstreetmap.org/edit?editor=id#map=20/${lat.toFixed(6)}/${lng.toFixed(6)}`;
    }

    function noteText() {
      const types = [...el.querySelectorAll('input[name=vending]:checked')].map((c) => c.value);
      const other = el.querySelector('input[name=vending_other]').value.trim()
        .split(/[;,]/).map((s) => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
      const vending = [...types, ...other].join(';');
      const details = el.querySelector('textarea').value.trim();
      const lines = ['Missing vending machine here.', 'Suggested tags: amenity=vending_machine' + (vending ? `, vending=${vending}` : '')];
      if (details) lines.push('', details);
      lines.push('', `(reported via ${SITE_URL})`);
      return { text: lines.join('\n'), hasInfo: Boolean(vending || details) };
    }

    function setStatus(html, kind) {
      status.hidden = false;
      status.className = 'status ' + (kind || '');
      status.innerHTML = html;
    }

    el.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const { text, hasInfo } = noteText();
      if (!hasInfo) { setStatus('Please pick a type or add a few details first.', 'warn'); return; }
      const { lat, lng } = draft.getLatLng();
      submit.disabled = true;
      setStatus('Sending…');
      try {
        const body = new URLSearchParams({ lat: lat.toFixed(7), lon: lng.toFixed(7), text });
        const res = await fetch(`${OSM_API}/notes.json`, { method: 'POST', body });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const note = await res.json();
        const id = note && note.properties && note.properties.id;
        const url = id ? `https://www.openstreetmap.org/note/${id}` : 'https://www.openstreetmap.org/';
        setStatus(`✅ Thanks! Note ${id ? '#' + id + ' ' : ''}created — <a href="${url}" target="_blank" rel="noopener">view it on OSM</a>.`, 'ok');
        el.querySelectorAll('input, textarea').forEach((i) => { i.disabled = true; });
        if (draft) draft.dragging.disable();
      } catch (err) {
        console.error(err);
        submit.disabled = false;
        setStatus(`Could not send the note (${esc(err.message)}). You can still use the OSM editor link.`, 'warn');
      }
    });

    el.addEventListener('input', () => { if (status.classList.contains('warn')) status.hidden = true; });
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    updateCoords();
    return { el, updateCoords };
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && addMode) setAddMode(false); });

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
