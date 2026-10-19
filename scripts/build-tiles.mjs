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
//   --pbf <url|file>    an OSM PBF extract (e.g. Geofabrik), streamed through osmium-tool,
//                       so even Europe (~35 GB) needs no disk space for the extract itself
//   --opl <file>        output of `osmium tags-filter ... -f opl` (already filtered)
//   --geojson <file>    a GeoJSON FeatureCollection of points (e.g. an old data/vending.geojson)
// Options:
//   --out <dir>         output directory (default: tiles); it is replaced completely
//   --region <name>     human-readable coverage label stored in the index
//   --timestamp <iso>   data timestamp, if it can't be read from the PBF header
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

const { values: args } = parseArgs({
  options: {
    pbf: { type: 'string' }, opl: { type: 'string' }, geojson: { type: 'string' },
    out: { type: 'string', default: 'tiles' }, region: { type: 'string', default: '' },
    timestamp: { type: 'string', default: '' },
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

/** OPL escapes everything outside a safe set as %<hex code point>%. */
const unescapeOpl = (s) => s.replace(/%([0-9a-fA-F]+)%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));

function keepTags(tags) {
  const out = {};
  for (const k of Object.keys(tags).sort()) {
    if (KEEP_KEYS.includes(k) || KEEP_PREFIXES.some((p) => k.startsWith(p))) out[k] = tags[k];
  }
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
  if (args.pbf) {
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
    throw new Error('Give one of --pbf, --opl or --geojson.');
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
