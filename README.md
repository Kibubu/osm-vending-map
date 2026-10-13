# osm-vending-map

A static map of **vending machines** (`amenity=vending_machine`) from [OpenStreetMap](https://www.openstreetmap.org/), currently covering **Fritzlar and surroundings** (roughly Fritzlar, Homberg (Efze), Gudensberg, Felsberg, Bad Wildungen, Borken, Wabern and southern Kassel).

- Pure static site (HTML/CSS/JS), no backend, no build step.
- [Leaflet 1.9.4](https://leafletjs.com/) + [Leaflet.markercluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster) from unpkg (pinned, with SRI hashes).
- Data is prebuilt into `data/vending.geojson` by a nightly GitHub Action that queries the Overpass API.

Features: marker clustering, filter panel by `vending` type with counts (`drinks;sweets` counts for both), per-type colored emoji markers, popups with operator/brand/payment/opening hours/level/note and *View/Edit on OSM* links, "Locate me", data timestamp + total count, mobile layout with a collapsible panel.

## Adding missing machines

Tap the **＋** button and then tap the map, or right-click / long-press anywhere. A red pin appears, which you can drag to the exact spot, along with two options:

- **Send as OSM note.** The page posts an anonymous [OSM note](https://wiki.openstreetmap.org/wiki/Notes) (no account needed) with suggested tags (`amenity=vending_machine`, `vending=…`) plus your details. Local mappers resolve notes and add the node.
- **Add it myself in the OSM editor.** Opens iD zoomed to that spot. Add a point there and choose the "Vending Machine" preset (needs an OSM account).

Either way, the new machine appears on this map after the next nightly data update, once it exists in OSM. Notes are public, so don't put personal info in them.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | The site |
| `data/vending.geojson` | Prebuilt data (one feature per line for readable diffs) |
| `scripts/fetch-data.mjs` | Overpass → osmtogeojson → slim GeoJSON |
| `.github/workflows/update-data.yml` | Nightly + manual data refresh, commits only on change |

## Enable GitHub Pages

1. Push the repo to GitHub (see below).
2. **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, Branch: `main`, folder: `/ (root)` → Save.
3. After a minute the site is at `https://<your-user>.github.io/osm-vending-map/`.

## Update the data

**Automatically:** the workflow runs nightly at 02:17 UTC.

**Manually:** Actions tab → *Update vending machine data* → **Run workflow**, or:

```bash
gh workflow run update-data.yml
gh run watch
```

The workflow needs `permissions: contents: write` (already set in the file). If your repo/org restricts it, also check **Settings → Actions → General → Workflow permissions → Read and write**.

The script only rewrites the file when the set of machines or their tags actually changed, so there is no nightly commit noise. The timestamp in the footer is therefore the OSM data timestamp of the last *change*.

**Locally:**

```bash
npm ci
npm run fetch          # writes data/vending.geojson
npm run serve          # http://localhost:8000
```

Optional env vars for the script: `REGION_BBOX`, `REGION_NAME`, `OVERPASS_URLS` (comma-separated, tried in order), `OVERPASS_TIMEOUT`, `USER_AGENT`, `FORCE_WRITE=1`, `OVERPASS_INPUT` (convert a saved Overpass JSON response instead of querying).

## Change the region

The region is a bounding box `south,west,north,east`. Change it in **both** places:

- `.github/workflows/update-data.yml` → `env.REGION_BBOX` and `env.REGION_NAME`
- `scripts/fetch-data.mjs` → the default for `REGION_BBOX` / `REGION_NAME` (used by local runs)

Then run the workflow (or `npm run fetch`). The map fits itself to the data, so no frontend changes are needed. [bboxfinder.com](http://bboxfinder.com/) is handy for picking a box (note it shows `west,south,east,north`).

Size guidance: this region is ~120 KB. A whole German state is a few MB; all of Germany is likely in the 10–20 MB range. The script warns (exit code 2) above 20 MB — at that point split by sub-region or narrow the box, as a single huge GeoJSON makes the page slow on phones.

## Attribution & licences

- **Map data** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). `data/vending.geojson` is a derived database and is likewise ODbL; keep the attribution if you reuse it.
- **Map tiles** from `tile.openstreetmap.org`, used under the [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) (fine for a low-traffic hobby site; switch to another tile provider if traffic grows).
- **Overpass API** public instances are shared community resources — the nightly job runs once a day with a descriptive User-Agent; please keep it that way.
- Leaflet (BSD-2-Clause), Leaflet.markercluster (MIT), osmtogeojson (MIT).
- Code in this repo: MIT.
