# osm-vending-map

A static map of **vending machines** (`amenity=vending_machine`) from [OpenStreetMap](https://www.openstreetmap.org/), covering **all of Europe**. It opens at Fritzlar and surroundings.

- Pure static site (HTML/CSS/JS), no backend, no frontend build step.
- [Leaflet 1.9.4](https://leafletjs.com/) + [Leaflet.markercluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster), self-hosted in `vendor/` (unchanged release files from unpkg, verified against their SRI hashes).
- Works offline and on a weak mobile signal (service worker, see *Offline and weak signal*).
- Data is prebuilt nightly by a GitHub Action from Geofabrik's Europe extract and cut into small tiles that load as you move the map (see *Data tiles*).

Features: marker clustering, filter panel with 9 groups covering the `vending=*` values used worldwide (see [docs/vending-values.md](docs/vending-values.md); synonyms like `snack`/`snacks` are merged, `drinks;sweets` counts for both), per-type colored emoji markers, popups with operator/brand/payment/opening hours/level/note and *View/Edit on OSM* links, "Locate me", data timestamp + total count, mobile layout with a collapsible panel.

## Satellite view

The 🛰️ button (left control column) switches to satellite imagery with road and place labels on top. 🗺️ switches back, and the choice is remembered per browser. Imagery: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) (© Esri, Maxar, Earthstar Geographics), free for non-commercial use with attribution, which is shown automatically. If the site ever becomes commercial or high-traffic, check Esri's terms or switch to another imagery provider in `app.js` → `BASEMAPS`.

The ⚡ button below it turns on *faster zooming*: base-map tiles are no longer fetched for the intermediate zoom levels of a zoom animation (Leaflet `updateWhenZooming: false` on every tile layer), which saves requests and data, especially in satellite view. Off by default, but switched on automatically when the browser reports data saver or a slow (2G/3G) connection (Chromium only). An explicit choice wins and is remembered per browser (`localStorage` key `vm-zoomtiles`).

## Offline and weak signal

The site is built to open outdoors with a bad or no mobile signal:

- **Service worker (`sw.js`).** After the first visit, the app (HTML, CSS, JS, Leaflet) comes from the phone's cache. The page is still fetched from the network first so updates arrive, but after 4 s without an answer the cached copy is used.
- **Data.** The tile index (`tiles/index.json`) is fetched from the network first. After 6 s without an answer (or with no network) the last downloaded copy is used, and the footer says *offline copy*. A late answer still refreshes the cache for next time. Every data tile you have loaded is kept: a tile whose content hash is unchanged is never downloaded again, and without signal the last copy of a changed tile is shown.
- **Map tiles.** Every tile you have looked at is kept (up to 3000, oldest dropped first) and served from the cache, so places you have viewed before work offline. Tiles older than 7 days are refreshed in the background. Nothing is downloaded ahead of time (OSM tile usage policy).
- **First visit on a bad connection.** A *slow connection* hint appears after 8 s. After 45 s, or when the network is gone, an error with *Retry* is shown, and loading starts again by itself when the phone is back online.
- **One host fewer.** Leaflet is served from this site instead of unpkg, which saves a DNS lookup and TLS handshake to another server.

**Deploying:** bump `VERSION` in `sw.js` together with the `?v=` query strings in `index.html`. Otherwise visitors keep the old cached files. The service worker is not registered on `localhost` / `127.0.0.1` (and is removed there), so local edits show up immediately. Add `?sw=1` to test it locally.

## Languages

The interface is available in 🇬🇧 English, 🇩🇪 Deutsch, 🇫🇷 Français, 🇪🇸 Español, 🇮🇹 Italiano and 🇳🇱 Nederlands.

- On the first visit the site uses the first of the browser's preferred languages that it supports, falling back to English.
- The flag button (top left, under ＋) switches language. The browser's own languages are listed first, and the choice is remembered.
- Category names, the add form, popups (including vending types and payment methods), status messages, number and date formats are all translated.
- OSM tag keys and values, changeset comments and note texts stay **English** on purpose, because they are shared with mappers worldwide.

To add a language, copy the `en` block in `i18n.js`, translate the values and add an entry to `LANGS` (flag and native name).

## Shareable links

The address bar always reflects what you see, OSM-style, so you can copy it at any time:

```
https://kibubu.github.io/osm-vending-map/#map=17/51.12544/9.28142&m=node/11986973786
                                          zoom/lat/lon          selected machine
```

- `map=` updates as you pan and zoom (without filling the browser history).
- `m=` is added while a machine's popup is open and removed when you close it.
- Every popup has a **🔗 Share** link: it opens the share sheet on phones and copies the link elsewhere.
- Opening a link restores the view and opens that machine's popup. If the machine is outside the loaded data, it's fetched from the OSM API. If it was deleted from OSM, a message says so. It also opens if the visitor's own filter hides that category.

## Data tiles

All of Europe is too much to download at once on a phone (and too much for one Overpass query), so the data is split into a grid:

- **`tiles/index.json`** (one small download, cached) lists every grid cell that has machines: `[level, i, j, count, hash]`. Cells are 0.25° (~28 × 18 km). Cells with more than 1000 machines (city centres) are split into quarters, down to ~1.7 km, so no single file gets big.
- **`tiles/c/{level}_{i}_{j}.json`** holds the machines of one cell as `[id, lat, lon, tags]` rows (id like `n123`). Typically 1–15 KB gzipped.
- **Zoomed out (below zoom 10)** the map shows how many machines each area has, straight from the index, with nothing else to download. Tap a number to zoom in there. These totals ignore the category filter.
- **Zoomed in** the map loads the cells on screen, nearest to the centre first, three at a time. Cells that scroll out of view are cancelled. A ring of cells just outside the view is loaded afterwards, except on data saver or 2G/3G.
- A cell's URL carries its content hash (`?h=…`), so after the nightly rebuild only cells that actually changed are downloaded again.

Shared links to a machine that isn't in the data still work: that single machine is fetched directly from the OSM API.

## Adding missing machines

Tap **＋** and then the map, or right-click / long-press. Drag the red pin to the exact spot and fill in the form (what it sells, operator, brand, payment, opening hours, level). Then choose one of these:

- **Review & add to OSM** (recommended). Shows the exact tags, warns if OSM already has a vending machine within 20 m, then uploads **one new node in its own changeset** using the visitor's **own OSM account** (OAuth 2.0 login: the tab briefly goes to openstreetmap.org and comes back). The app can only create new vending machines. It never modifies or deletes existing objects.
- **Send as a note.** Needs no account. Creates a public [OSM note](https://wiki.openstreetmap.org/wiki/Notes) with the suggested tags for a mapper to add.
- **iD / JOSM links.** iD opens at the spot with the preset list limited to vending machines and the changeset comment filled in (iD can't take tags via URL). JOSM (with Remote Control enabled) creates the node with **all tags prefilled**.

Every upload carries `created_by=osm-vending-map …`, a descriptive `comment` and `hashtags=#osm-vending-map`. You can watch all edits made through the site on [OSMCha](https://osmcha.org/?filters=%7B%22hashtags%22%3A%5B%7B%22label%22%3A%22osm-vending-map%22%2C%22value%22%3A%22osm-vending-map%22%7D%5D%7D) (filter: hashtag `osm-vending-map`).

### When an upload fails: the outbox (📤)

Nothing you enter is lost. Every machine is saved in the browser (localStorage) **before** the upload starts and removed only after OSM confirms the new node. If anything goes wrong (server error, expired login, a cancelled login round trip, no network, or the tab closing mid-upload), it stays in the outbox:

- A **📤 button with a counter** appears in the left control column whenever something is waiting.
- Each entry shows what it is, where, when it was saved, the number of attempts, the **last error** (HTTP status and OSM's message) and a **log** of every attempt: time, step (`changeset/create`, `changeset/upload`, `login`), HTTP status, changeset id and an offline flag.
- Actions: **Retry upload**, **Edit** (reopens the form, prefilled), **Show on map**, **Send as note** (no account needed), **Copy** (coordinates and tags) and **Discard** (asks twice). **Retry all** and **Download log (JSON)** cover the whole list.
- **No duplicates:** if an attempt might have reached OSM (network drop during the upload, or an interrupted tab), the entry is flagged. Every retry first checks OSM for an identical machine within a few metres, and if one exists, it removes the entry instead of uploading again.
- Errors are also written to the browser console as `[outbox] upload failed …`.

The outbox lives in that browser only. Use *Download log* to keep or share it.

### One-time setup for direct upload (OAuth app)

1. Log in at openstreetmap.org → **My Settings → OAuth 2 applications → Register new application** (or go to https://www.openstreetmap.org/oauth2/applications/new).
2. Name: `osm-vending-map`. Redirect URIs (one per line):
   ```
   https://kibubu.github.io/osm-vending-map/land.html
   http://127.0.0.1:8000/land.html
   ```
3. **Untick "Confidential application"** (a static site can't keep secrets; PKCE replaces the secret).
4. Permissions: **Read user preferences** and **Modify the map**. Nothing else.
5. Copy the **Client ID** into `osm.js` → `CONFIG.live.clientId`, then commit and push. The Client ID is public by design.

Until a Client ID is set, the upload button is disabled and visitors get the note and editor options.

**Testing safely:** open the site with `?osm=dev` to use the OSM dev server (`master.apis.dev.openstreetmap.org`), which has separate accounts and throwaway data. It needs its own app registered there, with its Client ID in `CONFIG.dev.clientId`. For local tests run `python3 -m http.server 8000` and open `http://127.0.0.1:8000/` (not `localhost`, which must match the redirect URI exactly).

## Files

| Path | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | The site |
| `i18n.js` | Translations and language detection/picker |
| `osm.js` | OSM login (OAuth 2 PKCE), node upload, notes, nearby-duplicate check |
| `land.html` | OAuth redirect target that hands the login code back to the map |
| `sw.js` | Service worker: offline cache for the app, data and map tiles |
| `vendor/` | Leaflet and Leaflet.markercluster (pinned release files) |
| `scripts/build-tiles.mjs` | OSM extract → osmium filter → data tiles in `tiles/` |
| `.github/workflows/deploy.yml` | Nightly tile build + deploy to GitHub Pages (also on every push) |
| `tiles/` | Generated, not in `main`. It lives on the `tiles` branch (one force-pushed commit) |

## Enable GitHub Pages

1. Push the repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.
3. Actions tab → *Build data and deploy* → **Run workflow** (with *Rebuild the tiles* ticked) for the first data build.
4. After it finishes, the site is at `https://<your-user>.github.io/osm-vending-map/`.

The site is deployed by the workflow, not straight from the branch, because the generated tiles are not in `main`.

## Update the data

**Automatically:** the workflow runs nightly at 03:17 UTC. It streams Geofabrik's `europe-latest.osm.pbf` (~35 GB) through `osmium tags-filter`, so nothing big is stored on the runner, and takes roughly 15–30 minutes. Ways and relations tagged as vending machines (very few) get their centre from Overpass by id. Then the tiles are force-pushed to the `tiles` branch as a single commit (no history build-up) and the site is deployed. Pushes to `main` deploy with the tiles from the last nightly build.

**Manually:** Actions tab → *Build data and deploy* → **Run workflow**, or:

```bash
gh workflow run deploy.yml -f rebuild=true
```

**Locally** (needs [osmium-tool](https://osmcode.org/osmium-tool/), e.g. `brew install osmium-tool`). Use a small extract:

```bash
npm run tiles -- --pbf https://download.geofabrik.de/europe/germany/hessen-latest.osm.pbf --region Hessen
```

```bash
npm run serve
```

`--pbf` takes a URL or a local file. `--opl <file>` (output of `osmium tags-filter … -f opl`) and `--geojson <file>` (a point FeatureCollection) work too, without osmium.

## Change the region

Set `PBF_URL` and `REGION_NAME` in `.github/workflows/deploy.yml` to any [Geofabrik extract](https://download.geofabrik.de/) (a country is much faster to build than Europe). The start view is `REGION_BOUNDS` in `app.js`.

## Attribution & licences

- **Map data** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). The generated tiles are a derived database and are likewise ODbL; keep the attribution if you reuse it.
- **Satellite imagery** © Esri, Maxar, Earthstar Geographics and the GIS User Community (Esri World Imagery, non-commercial use with attribution).
- **Map tiles** from `tile.openstreetmap.org`, used under the [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) (fine for a low-traffic hobby site; switch to another tile provider if traffic grows).
- **Extracts** from [Geofabrik](https://download.geofabrik.de/), downloaded once a day. **Overpass API** is only asked for the few way/relation centres.
- Leaflet (BSD-2-Clause), Leaflet.markercluster (MIT), both redistributed unchanged in `vendor/`.
- Code in this repo: MIT.
