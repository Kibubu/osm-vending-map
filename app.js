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
      localStorage.setItem(FILTER_KEY, JSON.stringify(TYPES.map((t) => t.key).filter((k) => !active.has(k))));
    } catch { /* storage unavailable (private mode etc.) — filter just won't be remembered */ }
  }
  const hiddenAtStart = new Set(loadHidden());
  const active = new Set(TYPES.map((t) => t.key).filter((k) => !hiddenAtStart.has(k)));

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
      ? `${entries.length.toLocaleString()} machines`
      : `${n.toLocaleString()} of ${entries.length.toLocaleString()} machines`;
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
    saveHidden();
    applyFilter();
  });

  function setAll(on) {
    active.clear();
    if (on) TYPES.forEach((t) => active.add(t.key));
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
    return form;
  }

  const PAYMENTS = [
    ['coins', 'Coins'], ['notes', 'Notes'], ['debit_cards', 'Debit card'],
    ['credit_cards', 'Credit card'], ['contactless', 'Contactless'], ['app', 'App'],
  ];

  function buildAddForm() {
    const el = document.createElement('div');
    el.className = 'vm-popup add-form';
    el.innerHTML = `
      <form class="step step-edit" novalidate>
        <h3>Add a vending machine</h3>
        <p class="muted">Drag the pin to the exact spot. <span class="coords"></span></p>
        <fieldset class="type-chips"><legend>What does it sell? <span class="req">*</span></legend>
          ${ADD_CHOICES.map(([v, label]) =>
            `<label class="chip"><input type="checkbox" name="vending" value="${v}"><span>${esc(label)}</span></label>`).join('')}
          <input type="text" name="vending_other" placeholder="Other (e.g. potatoes, cheese)" maxlength="80">
        </fieldset>
        <div class="grid2">
          <label class="field">Operator<input type="text" name="operator" maxlength="120" placeholder="e.g. Tabakwaren Union"></label>
          <label class="field">Brand<input type="text" name="brand" maxlength="120" placeholder="e.g. Selecta"></label>
        </div>
        <label class="field">Name <span class="muted">(only if signposted)</span><input type="text" name="name" maxlength="120"></label>
        <fieldset class="type-chips"><legend>Payment</legend>
          ${PAYMENTS.map(([v, label]) =>
            `<label class="chip"><input type="checkbox" name="payment" value="${v}"><span>${esc(label)}</span></label>`).join('')}
        </fieldset>
        <div class="grid2">
          <label class="field">Opening hours
            <input type="text" name="opening_hours" maxlength="120" placeholder="Mo-Sa 06:00-22:00">
            <span class="inline"><input type="checkbox" name="always"> 24/7</span>
          </label>
          <label class="field">Level <span class="muted">(indoors)</span><input type="text" name="level" maxlength="10" placeholder="0, -1, 1…"></label>
        </div>
        <label class="field">Note for mappers <span class="muted">(optional)</span>
          <textarea name="note" rows="2" maxlength="255" placeholder="e.g. inside the station hall, next to the ticket office"></textarea>
        </label>
        <div class="add-actions">
          <button type="submit" class="primary">Review &amp; add to OSM</button>
          <button type="button" class="secondary send-note">No OSM account? Send as a note</button>
        </div>
        <p class="muted small other-editors">Or open it in
          <a class="editor-link" target="_blank" rel="noopener">iD</a> ·
          <a class="josm-link" target="_blank" rel="noopener" title="Needs JOSM running with Remote Control enabled">JOSM (prefilled)</a></p>
        <p class="status" role="status" hidden></p>
      </form>

      <div class="step step-review" hidden>
        <h3>Check before upload</h3>
        <p class="muted">A new node will be created at <span class="coords"></span> with these tags:</p>
        <table class="tag-table"></table>
        <div class="dupes" hidden></div>
        <div class="auth-box"></div>
        <div class="add-actions">
          <button type="button" class="primary upload">Upload to OpenStreetMap</button>
          <div class="btn-row">
            <button type="button" class="secondary back">✏️ Edit</button>
            <button type="button" class="secondary cancel">✕ Cancel</button>
          </div>
        </div>
        <p class="muted small">Uploaded under your own OSM account with the changeset comment and hashtag ${esc(OSMClient.hashtag)}. Only add machines you have seen yourself.</p>
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
      el.querySelectorAll('.coords').forEach((c) => { c.textContent = `(${lat.toFixed(5)}, ${lng.toFixed(5)})`; });
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
      if (!tags.vending) return 'Please pick at least one thing it sells.';
      if (tags.opening_hours && tags.opening_hours.length > 255) return 'Opening hours are too long.';
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
      setStatus(form, 'Sending note…');
      try {
        const note = await OSMClient.createNote(lat, lng, noteText(tags));
        finish(`✅ Thanks! <a href="${note.url}" target="_blank" rel="noopener">Note${note.id ? ' #' + note.id : ''}</a> created. A mapper will add the machine.`);
      } catch (e) {
        btn.disabled = false;
        setStatus(form, `Could not send the note (${esc(e.message)}).`, 'warn');
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
    q('.cancel').addEventListener('click', () => { map.closePopup(); removeDraft(); });

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
      box.innerHTML = `⚠️ ${near.length === 1 ? 'There is already a vending machine' : `There are already ${near.length} vending machines`} within 20 m:` +
        '<ul>' + near.slice(0, 5).map((n) =>
          `<li>${esc((n.tags && (n.tags.vending || n.tags.name)) || 'vending machine')}, ${Math.round(n.dist)} m${n.url ? ` — <a href="${n.url}" target="_blank" rel="noopener">view</a>` : ''}</li>`).join('') +
        '</ul>Only upload if this is a different machine.';
      if (draft) draft.getPopup().update();
    }

    async function renderAuth() {
      const box = q('.auth-box');
      const upload = q('.upload');
      if (!OSMClient.isConfigured()) {
        box.innerHTML = '<p class="status warn">Direct upload isn\'t set up on this site yet. Use the note option or the iD/JOSM links instead.</p>';
        upload.disabled = true;
        return;
      }
      upload.disabled = false;
      if (!OSMClient.isLoggedIn()) {
        box.innerHTML = '<p class="muted">You\'ll be asked to log in to OpenStreetMap first (free account).</p>';
        upload.textContent = 'Log in & upload to OpenStreetMap';
        return;
      }
      box.innerHTML = '<p class="muted">Checking login…</p>';
      try {
        const u = await OSMClient.currentUser();
        box.innerHTML = `<p class="muted">Uploading as <strong>${esc(u.display_name)}</strong>${OSMClient.isDev ? ' on the <strong>dev server</strong>' : ''} · <a href="#" class="logout">log out</a></p>`;
        upload.textContent = 'Upload to OpenStreetMap';
        q('.logout').addEventListener('click', (e) => { e.preventDefault(); OSMClient.logout(); renderAuth(); });
      } catch (e) {
        box.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
        upload.textContent = 'Log in & upload to OpenStreetMap';
      }
    }

    q('.upload').addEventListener('click', async () => {
      const btn = q('.upload');
      btn.disabled = true;
      try {
        const tags = collectTags();
        const { lat, lng } = draft.getLatLng();
        if (!OSMClient.isLoggedIn()) {
          // Leaves the page; the upload continues automatically after the OSM login (resumeAfterLogin).
          setStatus(review, 'Taking you to OpenStreetMap to log in…');
          await OSMClient.login({ action: 'createNode', lat, lng, tags, comment: changesetComment(tags) });
          return;
        }
        setStatus(review, 'Uploading…');
        const r = await OSMClient.createNode(lat, lng, tags, changesetComment(tags));
        addLocalMarker(lat, lng, tags, r.nodeId);
        finish(`✅ Added! <a href="${r.nodeUrl}" target="_blank" rel="noopener">Node ${esc(r.nodeId)}</a> in ` +
          `<a href="${r.changesetUrl}" target="_blank" rel="noopener">changeset ${esc(r.changesetId)}</a>. ` +
          'It shows here now and for everyone after the next nightly data update.');
      } catch (e) {
        console.error(e);
        btn.disabled = false;
        setStatus(review, esc(e.message), 'warn');
        renderAuth();
      }
    });

    function finish(html) {
      done.innerHTML = `<h3>Thank you!</h3><p class="status ok">${html}</p>`;
      show(done);
      if (draft) draft.dragging.disable();
    }

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    updateLinks();
    return { el, updateCoords: updateLinks, prefill, openReview };
  }

  /** After returning from the OSM login page: finish the upload the user had started. */
  async function resumeAfterLogin() {
    let res;
    try {
      res = await OSMClient.resume();
    } catch (e) {
      const p = e.payload;
      if (p && p.lat != null) {
        map.setView([p.lat, p.lng], 18);
        L.popup({ maxWidth: 300 }).setLatLng([p.lat, p.lng])
          .setContent(`<div class="vm-popup add-form"><h3>Not uploaded</h3><p class="status warn">${esc(e.message)}</p>` +
            '<p class="muted small">Nothing was changed on OpenStreetMap. Tap ＋ to try again.</p></div>').openOn(map);
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
    form.prefill(tags);
    form.openReview();

  }

  // ---------- Machine store (prebuilt file + live Overpass + own uploads) ----------
  const seenIds = new Set();
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
    const entry = { marker, cats };
    entries.push(entry);
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
    cell: 0.2,           // degrees (~22 km north-south)
    minZoom: 10,         // below this the area is too large to query politely
    maxCells: 60,        // safety cap per request
    debounceMs: 800,
    endpoints: ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'],
  };
  const loadedCells = new Set();
  let liveTimer = null;
  let liveCtrl = null;
  let liveBusy = false;
  let liveUsed = false;
  let liveHooked = false;

  const cellKey = (i, j) => `${i}:${j}`;
  function cellsIn(bounds) {
    const out = [];
    const i0 = Math.floor(bounds.getSouth() / LIVE.cell), i1 = Math.floor(bounds.getNorth() / LIVE.cell);
    const j0 = Math.floor(bounds.getWest() / LIVE.cell), j1 = Math.floor(bounds.getEast() / LIVE.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push([i, j]);
    return out;
  }
  /** Marks grid cells that lie completely inside the prebuilt bbox as already loaded. */
  function markPrebuilt(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return;
    const [s, w, n, e] = bbox;
    for (const [i, j] of cellsIn(L.latLngBounds([s, w], [n, e]))) {
      const cs = i * LIVE.cell, cw = j * LIVE.cell;
      if (cs >= s && cw >= w && cs + LIVE.cell <= n && cw + LIVE.cell <= e) loadedCells.add(cellKey(i, j));
    }
  }

  function setLiveStatus(text, kind) {
    const el = $('live-status');
    el.hidden = !text;
    el.className = 'live-status ' + (kind || '');
    el.textContent = text || '';
  }

  function scheduleLive() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(loadLive, LIVE.debounceMs);
  }

  async function loadLive() {
    if (liveBusy) { scheduleLive(); return; }
    const view = map.getBounds();
    const missing = cellsIn(view).filter(([i, j]) => !loadedCells.has(cellKey(i, j)));
    if (!missing.length) { setLiveStatus(''); return; }
    if (map.getZoom() < LIVE.minZoom || missing.length > LIVE.maxCells) {
      setLiveStatus('Zoom in to load vending machines in this area', 'hint');
      return;
    }
    const s = Math.min(...missing.map(([i]) => i)) * LIVE.cell;
    const n = (Math.max(...missing.map(([i]) => i)) + 1) * LIVE.cell;
    const w = Math.min(...missing.map(([, j]) => j)) * LIVE.cell;
    const e = (Math.max(...missing.map(([, j]) => j)) + 1) * LIVE.cell;
    const query = `[out:json][timeout:60][bbox:${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}];` +
      'nwr["amenity"="vending_machine"];out center;';

    liveBusy = true;
    setLiveStatus('Loading vending machines in this area…', 'busy');
    try {
      const json = await overpass(query);
      const added = [];
      for (const el of json.elements || []) {
        const lat = el.lat != null ? el.lat : el.center && el.center.lat;
        const lon = el.lon != null ? el.lon : el.center && el.center.lon;
        const tags = el.tags || {};
        const props = { osm_type: el.type, osm_id: el.id };
        for (const k of Object.keys(tags)) if (KEEP_KEYS.includes(k) || k.startsWith('payment:')) props[k] = tags[k];
        const entry = addMachine(`${el.type}/${el.id}`, lat, lon, props);
        if (entry) added.push(entry);
      }
      missing.forEach(([i, j]) => loadedCells.add(cellKey(i, j)));
      showAdded(added);
      if (!liveUsed) { liveUsed = true; $('stamp').textContent += ' · live outside'; }
      setLiveStatus(added.length ? `${added.length} more machine${added.length === 1 ? '' : 's'} loaded` : 'No vending machines found here yet', 'ok');
      setTimeout(() => { if ($('live-status').classList.contains('ok')) setLiveStatus(''); }, 2500);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Live load failed', err);
      setLiveStatus('Could not load this area (Overpass is busy). Move the map to try again.', 'warn');
    } finally {
      liveBusy = false;
    }
  }

  async function overpass(query) {
    let lastErr;
    for (const url of LIVE.endpoints) {
      liveCtrl = new AbortController();
      const timer = setTimeout(() => liveCtrl.abort(), 70000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: liveCtrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error(json.remark);
        return json;
      } catch (err) {
        lastErr = err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
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
      $('stamp').textContent = `OSM data as of ${formatStamp(meta.timestamp_osm_base)}`;
      $('stamp').title = meta.region ? `Region: ${meta.region}` : '';
      markPrebuilt(meta.bbox);

      if (entries.length) {
        map.fitBounds(L.latLngBounds(entries.map((e) => e.marker.getLatLng())), { padding: [30, 30], maxZoom: 16, animate: false });
      } else if (Array.isArray(meta.bbox) && meta.bbox.length === 4) {
        const [s, w, n, e] = meta.bbox;
        map.fitBounds([[s, w], [n, e]], { animate: false });
      }
    } catch (err) {
      console.error(err);
      showError(`Could not load the vending machine data. ${err.message}`, true);
    } finally {
      $('loading').hidden = true;
    }
    resumeAfterLogin();
    // Live loading starts with the first map move (not on page load), to spare Overpass.
    if (!liveHooked) { liveHooked = true; map.on('moveend', scheduleLive); }
  }

  load();
})();
