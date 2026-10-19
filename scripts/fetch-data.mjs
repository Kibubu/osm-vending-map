#!/usr/bin/env node
// Fetches amenity=vending_machine from the Overpass API for a region and writes
// a slim GeoJSON file to data/vending.geojson.
//
// Each machine is enriched with where it is, so it can be found by searching for a town,
// street or shop (properties starting with "loc:", derived here, not OSM tags):
//   loc:street, loc:housenumber  the machine's own addr:* or the nearest address within ADDR_M
//                                (else just the nearest named street within STREET_M)
//   loc:city                     addr:city of that address, else the nearest town/village
//   loc:place                    the nearest suburb/village/hamlet, if different from loc:city
//   loc:near                     the nearest named shop/amenity/station… within NEAR_M
//
// Config (env vars, all optional):
//   REGION_BBOX      south,west,north,east  (default: Fritzlar + ~22 km)
//   REGION_NAME      human-readable label stored in the metadata
//   OVERPASS_URLS    comma-separated endpoints, tried in order
//   OVERPASS_TIMEOUT server-side query timeout in seconds (default 300)
//   USER_AGENT       sent with every request
//   OUT_FILE         output path (default data/vending.geojson)
//   FORCE_WRITE=1    rewrite the file even if the features are unchanged
//   OVERPASS_INPUT   read a saved Overpass JSON response from this file instead of querying
//   OVERPASS_SAVE    also save the raw Overpass JSON response to this file (for OVERPASS_INPUT)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import osmtogeojson from 'osmtogeojson';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BBOX = (process.env.REGION_BBOX || '50.93,8.95,51.33,9.60').trim();
const REGION_NAME = process.env.REGION_NAME || 'Fritzlar and surroundings';
const ENDPOINTS = (process.env.OVERPASS_URLS ||
  'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter')
  .split(',').map((s) => s.trim()).filter(Boolean);
const TIMEOUT_S = Number(process.env.OVERPASS_TIMEOUT || 300);
const USER_AGENT = process.env.USER_AGENT ||
  'osm-vending-map/1.0 (static vending machine map; +https://github.com/)';
const OUT_FILE = resolve(ROOT, process.env.OUT_FILE || 'data/vending.geojson');
const SIZE_WARN_BYTES = 20 * 1024 * 1024;

const KEEP_KEYS = ['vending', 'name', 'operator', 'brand', 'opening_hours', 'level', 'note'];
const KEEP_PREFIXES = ['payment:'];

function validateBbox(b) {
  const p = b.split(',').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n)) || p[0] >= p[2] || p[1] >= p[3]) {
    throw new Error(`REGION_BBOX must be "south,west,north,east", got "${b}"`);
  }
  return p;
}

// Enrichment search radii (metres).
const ADDR_M = 30;
const STREET_M = 60;
const NEAR_M = 30;
const PLACE_M = 2500;   // for suburbs/hamlets; towns and villages use a weighted distance

function buildQuery() {
  return `[out:json][timeout:${TIMEOUT_S}][bbox:${BBOX}];
nwr["amenity"="vending_machine"]->.vm;
.vm out center;
// Context for the enrichment (see top of file).
nwr(around.vm:${Math.max(ADDR_M, NEAR_M)})["addr:street"];
out center tags;
nwr(around.vm:${NEAR_M})[name][~"^(shop|amenity|tourism|leisure|railway|public_transport|office|craft|healthcare|sport)$"~"."];
out center tags;
way(around.vm:${STREET_M})[highway][name];
out tags geom;
node[place~"^(city|town|village|suburb|quarter|neighbourhood|hamlet|isolated_dwelling)$"][name];
out;`;
}

// ---------- Enrichment ----------
const LOCALITY_WEIGHT = { city: 5, town: 2.5, village: 1 }; // a city "reaches" further than a village
const SMALL_PLACES = new Set(['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet', 'isolated_dwelling']);

/** Metres between two points (equirectangular; fine at these distances). */
function dist(lat1, lon1, lat2, lon2) {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(x, lat2 - lat1) * 111320;
}

/** Metres from a point to a polyline [{lat, lon}, …]. */
function distToLine(lat, lon, geom) {
  const k = Math.cos(lat * Math.PI / 180);
  const P = (g) => [(g.lon - lon) * k * 111320, (g.lat - lat) * 111320]; // local plane, point at origin
  let best = Infinity;
  for (let i = 1; i < geom.length; i++) {
    const [ax, ay] = P(geom[i - 1]), [bx, by] = P(geom[i]);
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

const pos = (el) => (el.lat != null ? [el.lat, el.lon] : el.center ? [el.center.lat, el.center.lon] : null);

/** Splits the Overpass answer into the machines and the context used to describe where they are. */
function splitElements(elements) {
  const vm = [], addrs = [], pois = [], streets = [], places = [];
  const seen = new Set();
  for (const el of elements) {
    const key = `${el.type}/${el.id}`;
    const tags = el.tags || {};
    if (tags.amenity === 'vending_machine') {
      if (!seen.has(key)) { seen.add(key); vm.push(el); }
      continue;
    }
    if (el.type === 'way' && tags.highway && el.geometry) { streets.push(el); continue; }
    if (el.type === 'node' && tags.place) { places.push(el); continue; }
    const p = pos(el);
    if (!p) continue;
    if (tags['addr:street']) addrs.push({ p, tags });
    if (tags.name && !tags.highway && !tags.place) pois.push({ p, tags });
  }
  return { vm, addrs, pois, streets, places };
}

function nearest(list, lat, lon, max, distOf = (x) => dist(lat, lon, x.p[0], x.p[1])) {
  let best = null, bestD = max;
  for (const x of list) {
    const d = distOf(x);
    if (d <= bestD) { best = x; bestD = d; }
  }
  return best;
}

/** loc:* properties for a machine at lat/lon with its own tags. */
function describeLocation(lat, lon, tags, ctx) {
  const loc = {};
  if (tags['addr:street']) {
    loc.street = tags['addr:street'];
    loc.housenumber = tags['addr:housenumber'];
    loc.city = tags['addr:city'] || tags['addr:place'];
  } else {
    const a = nearest(ctx.addrs, lat, lon, ADDR_M);
    if (a) {
      loc.street = a.tags['addr:street'];
      loc.housenumber = a.tags['addr:housenumber'];
      loc.city = a.tags['addr:city'] || a.tags['addr:place'];
    } else {
      const s = nearest(ctx.streets, lat, lon, STREET_M, (w) => distToLine(lat, lon, w.geometry));
      if (s) loc.street = s.tags.name;
    }
  }

  const places = ctx.places.map((n) => ({ n, d: dist(lat, lon, n.lat, n.lon) }));
  if (!loc.city) {
    let best = null;
    for (const x of places) {
      const w = LOCALITY_WEIGHT[x.n.tags.place];
      if (w && (!best || x.d / w < best.d / LOCALITY_WEIGHT[best.n.tags.place])) best = x;
    }
    if (best) loc.city = best.n.tags.name;
  }
  const small = places.filter((x) => SMALL_PLACES.has(x.n.tags.place) && x.d <= PLACE_M)
    .sort((a, b) => a.d - b.d)[0];
  if (small && small.n.tags.name !== loc.city) loc.place = small.n.tags.name;

  const own = tags.name || tags.brand;
  const near = nearest(ctx.pois.filter((x) => x.tags.name !== own), lat, lon, NEAR_M);
  if (near) loc.near = near.tags.name;

  const out = {};
  for (const k of ['street', 'housenumber', 'place', 'city', 'near']) if (loc[k]) out[`loc:${k}`] = loc[k];
  return out;
}

async function queryOverpass(endpoint, query) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (TIMEOUT_S + 60) * 1000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    // Overpass reports server-side timeouts/out-of-memory in "remark" with a 200.
    if (json.remark && /error|timed out|runtime/i.test(json.remark)) {
      throw new Error(`Overpass remark: ${json.remark}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithFallback(query) {
  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      console.log(`→ Querying ${ep}`);
      return await queryOverpass(ep, query);
    } catch (err) {
      lastErr = err;
      console.warn(`✗ ${ep} failed: ${err.message}`);
    }
  }
  throw lastErr;
}

function slimFeature(f, ctx) {
  // osmtogeojson ids look like "node/123", "way/456", "relation/789".
  const [osmType, osmId] = String(f.id).split('/');
  const src = f.properties || {};
  const props = { osm_type: osmType, osm_id: Number(osmId) };
  for (const k of Object.keys(src).sort()) {
    if (KEEP_KEYS.includes(k) || KEEP_PREFIXES.some((p) => k.startsWith(p))) props[k] = src[k];
  }
  // Ways/relations are delivered as their center point (out center).
  if (f.geometry?.type !== 'Point') return null;
  const coords = f.geometry.coordinates.map((n) => Math.round(n * 1e6) / 1e6);
  Object.assign(props, describeLocation(coords[1], coords[0], src, ctx));
  return { type: 'Feature', id: f.id, geometry: { type: 'Point', coordinates: coords }, properties: props };
}

async function main() {
  validateBbox(BBOX);
  const query = buildQuery();
  console.log(`Region: ${REGION_NAME} [${BBOX}]`);

  const osm = process.env.OVERPASS_INPUT
    ? JSON.parse(await readFile(resolve(process.env.OVERPASS_INPUT), 'utf8'))
    : await fetchWithFallback(query);
  if (process.env.OVERPASS_SAVE) await writeFile(resolve(process.env.OVERPASS_SAVE), JSON.stringify(osm));
  const base = osm.osm3s?.timestamp_osm_base || null;
  console.log(`Overpass returned ${osm.elements.length} elements (osm_base ${base})`);

  const { vm, ...ctx } = splitElements(osm.elements);
  console.log(`  ${vm.length} machines; context: ${ctx.addrs.length} addresses, ${ctx.pois.length} named places nearby, ` +
    `${ctx.streets.length} streets, ${ctx.places.length} towns/villages`);

  // osmtogeojson natively turns ways/relations from `out center` into center points.
  const gj = osmtogeojson({ ...osm, elements: vm });

  const features = [];
  const seen = new Set();
  for (const f of gj.features) {
    const slim = slimFeature(f, ctx);
    if (slim && !seen.has(slim.id)) { seen.add(slim.id); features.push(slim); }
  }
  features.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Skip writing if nothing but timestamps changed, so the workflow only commits real changes.
  if (!process.env.FORCE_WRITE) {
    try {
      const prev = JSON.parse(await readFile(OUT_FILE, 'utf8'));
      if (JSON.stringify(prev.features) === JSON.stringify(features)) {
        console.log(`No feature changes (${features.length} machines); leaving ${OUT_FILE} untouched.`);
        return;
      }
    } catch { /* no previous file */ }
  }

  const out = {
    type: 'FeatureCollection',
    metadata: {
      region: REGION_NAME,
      bbox: validateBbox(BBOX),
      timestamp_osm_base: base,
      generated: new Date().toISOString(),
      count: features.length,
      source: 'OpenStreetMap via Overpass API',
      license: 'ODbL 1.0 — © OpenStreetMap contributors',
    },
    features,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  // One feature per line: compact but produces readable git diffs.
  const body = '{"type":"FeatureCollection","metadata":' + JSON.stringify(out.metadata) +
    ',"features":[\n' + features.map((f) => JSON.stringify(f)).join(',\n') + '\n]}\n';
  await writeFile(OUT_FILE, body);

  const size = Buffer.byteLength(body);
  console.log(`✓ Wrote ${features.length} machines to ${OUT_FILE} (${(size / 1024).toFixed(1)} KiB)`);
  if (size > SIZE_WARN_BYTES) {
    console.warn('⚠ GeoJSON is larger than 20 MB — consider splitting by sub-region or narrowing REGION_BBOX.');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`Fetch failed: ${err.message}`);
  process.exit(1);
});
