#!/usr/bin/env node
// Builds the vending machine tiles the map loads: a small index of all grid cells plus one
// file per cell with the machines in it.
//
//   tiles/index.json            metadata + [level, i, j, count, hash] for every cell with machines
//   tiles/c/{level}_{i}_{j}.json [[id, lat, lon, tags], ...]  (id like "n123", "w45", "r6")
//
// A cell at level L is CELL / 2^L degrees wide: (L, i, j) covers lat [i*size, (i+1)*size) and
// lon [j*size, (j+1)*size). Cells with more than MAX_PER_CELL machines (city centres) are split
// into four, so no single file gets large on a slow connection. The hash changes only when a
// cell's content changes, so after a nightly rebuild browsers re-download just those cells.
//
// Input (one of):
//   --postpass <s,w,n,e> query the Postpass API (SQL over a minutely updated OSM database,
//                       postpass.geofabrik.de) for the machines in this box. Small download
//                       (~100 KB for a district, ~80 MB for all of Europe); the default choice,
//                       and the only input with location enrichment (loc:*, see below)
//   --pbf <url|file>    an OSM PBF extract (e.g. Geofabrik), streamed through osmium-tool,
//                       so even Europe (~35 GB) needs no disk space for the extract itself
//   --opl <file>        output of `osmium tags-filter ... -f opl` (already filtered)
//   --geojson <file>    a GeoJSON FeatureCollection of points (e.g. an old data/vending.geojson)
// Options:
//   --out <dir>         output directory (default: tiles); it is replaced completely
//   --region <name>     human-readable coverage label stored in the index
//   --bbox <s,w,n,e>    keep only machines inside this box (south,west,north,east)
//   --timestamp <iso>   data timestamp, if it can't be read from the PBF header
//   --no-enrich         --postpass without the location enrichment (see below)
//
// Ways and relations come out of the extract without coordinates (single streaming pass), so
// their centres are looked up on Overpass by id (a handful; skipped if Overpass is down).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CELL = 0.25;          // degrees (~28 km north-south) at level 0
const MAX_PER_CELL = 1000;  // split cells with more machines (~15 KB gzipped)
const MAX_LEVEL = 4;        // smallest cell: 0.25° / 16 ≈ 1.7 km
const KEEP_KEYS = ['vending', 'name', 'operator', 'brand', 'opening_hours', 'level', 'note'];
const KEEP_PREFIXES = ['payment:'];
const OVERPASS = (process.env.OVERPASS_URLS ||
  'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter')
  .split(',').map((s) => s.trim()).filter(Boolean);
const USER_AGENT = process.env.USER_AGENT || 'osm-vending-map/1.0 (tile builder)';
const POSTPASS = process.env.POSTPASS_URL || 'https://postpass.geofabrik.de/api/interpreter';

const { values: args } = parseArgs({
  options: {
    postpass: { type: 'string' }, pbf: { type: 'string' }, opl: { type: 'string' }, geojson: { type: 'string' },
    out: { type: 'string', default: 'tiles' }, region: { type: 'string', default: '' },
    timestamp: { type: 'string', default: '' }, bbox: { type: 'string', default: '' },
    'no-enrich': { type: 'boolean', default: false },
  },
});

function run(cmd, argv, { stdout = 'pipe' } = {}) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', stdout, 'inherit'] });
    let out = '';
    if (p.stdout) p.stdout.on('data', (d) => { out += d; });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`${cmd} exited with ${code}`))));
  });
}

/** Streams the PBF (URL or file) through osmium and returns [OPL text, replication timestamp]. */
async function filterPbf(src) {
  const dir = await mkdtemp(join(tmpdir(), 'vm-tiles-'));
  const filtered = join(dir, 'vending.osm.pbf');
  const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  const reader = /^https?:/.test(src) ? `curl -sSfL --retry 3 ${q(src)}` : `cat ${q(src)}`;
  console.log(`→ Filtering ${src}`);
  const t0 = Date.now();
  await run('bash', ['-o', 'pipefail', '-c',
    `${reader} | osmium tags-filter -F pbf -R - nwr/amenity=vending_machine -o ${q(filtered)} --overwrite`], { stdout: 'inherit' });
  console.log(`  done in ${Math.round((Date.now() - t0) / 1000)} s`);
  const stamp = (await run('osmium', ['fileinfo', '-g', 'header.option.osmosis_replication_timestamp', filtered])).trim();
  const opl = await run('osmium', ['cat', filtered, '-f', 'opl']);
  await rm(dir, { recursive: true, force: true });
  return [opl, stamp];
}

function parseBbox(str, flag) {
  const b = str.split(',').map(Number);
  if (b.length !== 4 || b.some((n) => !Number.isFinite(n)) || b[0] >= b[2] || b[1] >= b[3]) {
    throw new Error(`${flag} must be "south,west,north,east", got "${str}"`);
  }
  return b;
}

// Location enrichment (--postpass): every machine gets loc:* properties describing where it is,
// so the popup can show it and search can find it by town, street or shop. They are derived in
// the same Postpass query (nearest-neighbour joins in PostGIS), not OSM tags:
//   loc:street, loc:housenumber  the machine's own addr:* or the nearest address within ADDR_M
//                                (else just the nearest named street within STREET_M)
//   loc:city                     addr:city of that address, else the nearest town/village
//   loc:place                    the nearest suburb/village/hamlet, if different from loc:city
//   loc:near                     the nearest named shop/amenity/station… within NEAR_M
const ADDR_M = 30;
const STREET_M = 60;
const NEAR_M = 30;
const PLACE_M = 2500;      // for suburbs/hamlets; towns and villages use a weighted distance
const NEAR_MAX_M2 = 20000; // larger areas (parks, fare zones…) would win "near" just by containing the machine
const POI_KEYS = ['shop', 'amenity', 'tourism', 'leisure', 'railway', 'public_transport', 'office', 'craft', 'healthcare', 'sport'];

/**
 * SQL for the machines in the box, ways/relations as their centre; with `enrich` also the
 * columns describeLocation() needs. Tag conditions are written as `tags->>'k' IS NOT NULL`, not
 * `tags ? 'k'`: the latter makes PostgreSQL use the tag index (millions of rows) instead of the
 * geometry index for every machine.
 */
function postpassSql([s, w, n, e], enrich) {
  const env = `ST_MakeEnvelope(${w},${s},${e},${n},4326)`;
  const where = `tags->>'amenity'='vending_machine' AND geom && ${env}`;
  const machines = [
    `SELECT osm_type, osm_id, tags, geom FROM postpass_point WHERE ${where}`,
    `SELECT osm_type, osm_id, tags, ST_Centroid(geom) AS geom FROM postpass_polygon WHERE ${where}`,
    `SELECT osm_type, osm_id, tags, ST_Centroid(geom) AS geom FROM postpass_line WHERE ${where}`,
  ].join(' UNION ALL ');
  if (!enrich) return machines;

  // Candidates near the machine: bbox on the geometry index first, then the exact distance.
  const deg = (m) => (m / 111320 / Math.cos(Math.max(Math.abs(s), Math.abs(n)) * Math.PI / 180)).toFixed(5);
  const d = 'ST_Distance(x.geom::geography, vm.geom::geography)';
  const near = (m) => `x.geom && ST_Expand(vm.geom, ${deg(m)}) AND ST_DWithin(x.geom::geography, vm.geom::geography, ${m})`;
  const poi = (table, extra = '') => `SELECT x.tags->>'name' AS name, ${d} AS d FROM ${table} x
      WHERE ${near(NEAR_M)} AND coalesce(x.tags->>'name', '') <> ''
        AND x.tags->>'highway' IS NULL AND x.tags->>'place' IS NULL
        AND x.tags->>'amenity' IS DISTINCT FROM 'vending_machine'
        AND x.tags->>'name' IS DISTINCT FROM coalesce(vm.tags->>'name', vm.tags->>'brand')
        AND coalesce(${POI_KEYS.map((k) => `x.tags->>'${k}'`).join(', ')}) IS NOT NULL ${extra}`;
  return `WITH vm AS MATERIALIZED (${machines}),
pl AS MATERIALIZED (
  SELECT tags->>'name' AS name, tags->>'place' AS place, geom FROM postpass_point
  WHERE geom && ST_Expand(${env}, 0.3) AND coalesce(tags->>'name', '') <> ''
    AND tags->>'place' IN ('city','town','village','suburb','quarter','neighbourhood','hamlet','isolated_dwelling'))
SELECT vm.osm_type, vm.osm_id, vm.tags, vm.geom,
  a.tags->>'addr:street' AS a_street, a.tags->>'addr:housenumber' AS a_housenumber,
  coalesce(a.tags->>'addr:city', a.tags->>'addr:place') AS a_city,
  st.name AS street, poi.name AS near, c.name AS city, sp.name AS place
FROM vm
LEFT JOIN LATERAL (
  SELECT x.tags FROM postpass_pointpolygon x WHERE ${near(ADDR_M)} AND x.tags->>'addr:street' IS NOT NULL
  ORDER BY ${d} LIMIT 1) a ON true
LEFT JOIN LATERAL (
  SELECT x.tags->>'name' AS name FROM postpass_line x
  WHERE ${near(STREET_M)} AND x.tags->>'highway' IS NOT NULL AND coalesce(x.tags->>'name', '') <> ''
  ORDER BY ${d} LIMIT 1) st ON true
LEFT JOIN LATERAL (
  SELECT name FROM (${poi('postpass_point')} UNION ALL ${poi('postpass_polygon', `AND x.area_m2 < ${NEAR_MAX_M2}`)}) y
  ORDER BY d LIMIT 1) poi ON true
LEFT JOIN LATERAL (
  -- smallest distance / weight: a city 5 km away wins over a village 2 km away
  SELECT name FROM pl WHERE place IN ('city','town','village')
  ORDER BY ST_Distance(pl.geom::geography, vm.geom::geography)
    / CASE place WHEN 'city' THEN 5 WHEN 'town' THEN 2.5 ELSE 1 END LIMIT 1) c ON true
LEFT JOIN LATERAL (
  SELECT name FROM pl WHERE place NOT IN ('city','town')
    AND ST_DWithin(pl.geom::geography, vm.geom::geography, ${PLACE_M})
  ORDER BY ST_Distance(pl.geom::geography, vm.geom::geography) LIMIT 1) sp ON true`;
}

/** loc:* from the machine's own addr:* and the columns of the enriched query. */
function describeLocation(tags, p) {
  const loc = {};
  if (tags['addr:street']) Object.assign(loc, { street: tags['addr:street'], housenumber: tags['addr:housenumber'] });
  else if (p.a_street) Object.assign(loc, { street: p.a_street, housenumber: p.a_housenumber, city: p.a_city });
  else loc.street = p.street;
  loc.city = tags['addr:city'] || tags['addr:place'] || loc.city || p.city;
  if (p.place !== loc.city) loc.place = p.place;
  loc.near = p.near;
  const out = {};
  for (const k of ['street', 'housenumber', 'place', 'city', 'near']) if (loc[k]) out[`loc:${k}`] = loc[k];
  return out;
}

/**
 * Asks Postpass for all vending machines in the box with their loc:*; ways/relations come as
 * their centre. If the enriched query keeps failing, the machines are fetched without it.
 */
async function queryPostpass(bboxStr, enrich = true) {
  const sql = postpassSql(parseBbox(bboxStr, '--postpass'), enrich);
  console.log(`→ Querying Postpass for ${bboxStr}${enrich ? ' with location enrichment' : ''}`);
  const t0 = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(POSTPASS, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(sql),
        signal: AbortSignal.timeout(15 * 60 * 1000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const gj = JSON.parse(text);
      console.log(`  ${gj.features.length} features in ${Math.round((Date.now() - t0) / 1000)} s`);
      const machines = gj.features.filter((f) => f.geometry?.type === 'Point').map((f) => {
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const tags = p.tags || {};
        return { id: p.osm_type.toLowerCase() + p.osm_id, lat, lon, tags: enrich ? { ...tags, ...describeLocation(tags, p) } : tags };
      });
      return [machines, gj.postpass_properties?.timestamp || ''];
    } catch (err) {
      lastErr = err;
      console.warn(`  ✗ attempt ${attempt}: ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 30000 * attempt));
    }
  }
  if (enrich) {
    console.warn('  Location enrichment failed; fetching the machines without it');
    return queryPostpass(bboxStr, false);
  }
  throw lastErr;
}

/** OPL escapes everything outside a safe set as %<hex code point>%. */
const unescapeOpl = (s) => s.replace(/%([0-9a-fA-F]+)%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));

function keepTags(tags) {
  const out = {};
  for (const k of Object.keys(tags).sort()) {
    if (KEEP_KEYS.includes(k) || KEEP_PREFIXES.some((p) => k.startsWith(p))) out[k] = tags[k];
  }
  // The machine's own address as loc:* (what app.js shows in the popup and search.js searches).
  // loc:* already present (from --geojson input) is kept as it is.
  const addr = { street: tags['addr:street'], housenumber: tags['addr:housenumber'], city: tags['addr:city'] || tags['addr:place'] };
  for (const [k, v] of Object.entries(addr)) if (v) out[`loc:${k}`] = v;
  for (const k of ['street', 'housenumber', 'place', 'city', 'near']) if (tags[`loc:${k}`]) out[`loc:${k}`] = tags[`loc:${k}`];
  return out;
}

/** Parses OPL lines into machines {id, lat, lon, tags}; ways/relations get lat/lon = null. */
function parseOpl(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const m = { id: line[0] + line.slice(1, line.indexOf(' ')), lat: null, lon: null, tags: {} };
    for (const field of line.split(' ')) {
      const v = field.slice(1);
      if (field[0] === 'x' && v) m.lon = Number(v);
      else if (field[0] === 'y' && v) m.lat = Number(v);
      else if (field[0] === 'T' && v) {
        for (const kv of v.split(',')) {
          const eq = kv.indexOf('=');
          if (eq > 0) m.tags[unescapeOpl(kv.slice(0, eq))] = unescapeOpl(kv.slice(eq + 1));
        }
      }
    }
    out.push(m);
  }
  return out;
}

function parseGeojson(gj) {
  return gj.features.filter((f) => f.geometry?.type === 'Point').map((f) => {
    const p = f.properties || {};
    const [type, id] = String(f.id || `${p.osm_type}/${p.osm_id}`).split('/');
    const [lon, lat] = f.geometry.coordinates;
    return { id: type[0] + id, lat, lon, tags: p };
  });
}

/** Fills in centres of ways/relations from Overpass (by id, so the queries are cheap). */
async function resolveCentres(machines) {
  const todo = machines.filter((m) => m.lat == null);
  if (!todo.length) return;
  console.log(`→ Looking up centres of ${todo.length} ways/relations on Overpass`);
  const byId = new Map(todo.map((m) => [m.id, m]));
  for (let k = 0; k < todo.length; k += 500) {
    const batch = todo.slice(k, k + 500);
    const ids = (p) => batch.filter((m) => m.id[0] === p).map((m) => m.id.slice(1)).join(',');
    const parts = [ids('w') && `way(id:${ids('w')});`, ids('r') && `relation(id:${ids('r')});`].filter(Boolean);
    const query = `[out:json][timeout:120];(${parts.join('')});out center;`;
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const el of (await res.json()).elements || []) {
          const m = byId.get(el.type[0] + el.id);
          if (m && el.center) { m.lat = el.center.lat; m.lon = el.center.lon; }
        }
        break;
      } catch (err) {
        console.warn(`  ✗ ${url}: ${err.message}`);
      }
    }
  }
  const missing = todo.filter((m) => m.lat == null).length;
  if (missing) console.warn(`  ${missing} ways/relations left out (no centre)`);
}

async function main() {
  let machines, stamp = args.timestamp;
  if (args.postpass) {
    [machines, stamp] = await queryPostpass(args.postpass, !args['no-enrich']);
    stamp = args.timestamp || stamp;
  } else if (args.pbf) {
    let opl;
    [opl, stamp] = await filterPbf(args.pbf);
    machines = parseOpl(opl);
    stamp = args.timestamp || stamp;
  } else if (args.opl) {
    machines = parseOpl(await readFile(args.opl, 'utf8'));
  } else if (args.geojson) {
    const gj = JSON.parse(await readFile(args.geojson, 'utf8'));
    machines = parseGeojson(gj);
    stamp = stamp || gj.metadata?.timestamp_osm_base || '';
  } else {
    throw new Error('Give one of --postpass, --pbf, --opl or --geojson.');
  }
  if (args.bbox) {
    const b = parseBbox(args.bbox, '--bbox');
    // Ways/relations have no position yet; keep them until their centre is known.
    const inside = (m) => m.lat == null || (m.lat >= b[0] && m.lat <= b[2] && m.lon >= b[1] && m.lon <= b[3]);
    machines = machines.filter(inside);
    await resolveCentres(machines);
    machines = machines.filter((m) => m.lat != null && inside(m));
  }
  console.log(`Found ${machines.length} vending machines`);
  await resolveCentres(machines);

  const r6 = (n) => Math.round(n * 1e6) / 1e6;
  const rows = machines.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon))
    .map((m) => [m.id, r6(m.lat), r6(m.lon), keepTags(m.tags)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  // Group into level-0 cells, then split crowded cells into quarters until they are small enough.
  const leaves = [];
  const split = (level, i, j, list) => {
    if (list.length <= MAX_PER_CELL || level === MAX_LEVEL) { leaves.push([level, i, j, list]); return; }
    const size = CELL / 2 ** (level + 1);
    const quads = new Map();
    for (const row of list) {
      const key = `${Math.floor(row[1] / size)}_${Math.floor(row[2] / size)}`;
      if (!quads.has(key)) quads.set(key, []);
      quads.get(key).push(row);
    }
    for (const [key, sub] of quads) split(level + 1, ...key.split('_').map(Number), sub);
  };
  const top = new Map();
  for (const row of rows) {
    const key = `${Math.floor(row[1] / CELL)}_${Math.floor(row[2] / CELL)}`;
    if (!top.has(key)) top.set(key, []);
    top.get(key).push(row);
  }
  for (const [key, list] of top) split(0, ...key.split('_').map(Number), list);

  const out = resolve(ROOT, args.out);
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'c'), { recursive: true });

  const index = [];
  let total = 0, biggest = ['', 0];
  leaves.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  for (const [level, i, j, list] of leaves) {
    const name = `${level}_${i}_${j}`;
    const body = JSON.stringify(list);
    await writeFile(join(out, 'c', `${name}.json`), body);
    index.push([level, i, j, list.length, createHash('sha1').update(body).digest('hex').slice(0, 6)]);
    total += list.length;
    if (body.length > biggest[1]) biggest = [name, body.length];
  }

  await writeFile(join(out, 'index.json'), JSON.stringify({
    format: 1,
    cell: CELL,
    region: args.region,
    timestamp_osm_base: stamp || null,
    generated: new Date().toISOString(),
    count: total,
    license: 'ODbL 1.0 — © OpenStreetMap contributors',
    cells: index,
  }));
  console.log(`✓ ${total} machines in ${index.length} cells → ${out}` +
    ` (largest cell ${biggest[0]}: ${(biggest[1] / 1024).toFixed(1)} KiB uncompressed)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
