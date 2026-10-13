#!/usr/bin/env node
// Fetches amenity=vending_machine from the Overpass API for a region and writes
// a slim GeoJSON file to data/vending.geojson.
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

function buildQuery() {
  return `[out:json][timeout:${TIMEOUT_S}][bbox:${BBOX}];
nwr["amenity"="vending_machine"];
out center;`;
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

function slimFeature(f) {
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
  return { type: 'Feature', id: f.id, geometry: { type: 'Point', coordinates: coords }, properties: props };
}

async function main() {
  validateBbox(BBOX);
  const query = buildQuery();
  console.log(`Region: ${REGION_NAME} [${BBOX}]`);

  const osm = process.env.OVERPASS_INPUT
    ? JSON.parse(await readFile(resolve(process.env.OVERPASS_INPUT), 'utf8'))
    : await fetchWithFallback(query);
  const base = osm.osm3s?.timestamp_osm_base || null;
  console.log(`Overpass returned ${osm.elements.length} elements (osm_base ${base})`);

  // osmtogeojson natively turns ways/relations from `out center` into center points.
  const gj = osmtogeojson(osm);

  const features = [];
  const seen = new Set();
  for (const f of gj.features) {
    const slim = slimFeature(f);
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
