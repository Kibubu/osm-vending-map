# osm-vending-map

A static map of **vending machines** (`amenity=vending_machine`) from [OpenStreetMap](https://www.openstreetmap.org/), currently covering **Fritzlar and surroundings** (roughly Fritzlar, Homberg (Efze), Gudensberg, Felsberg, Bad Wildungen, Borken, Wabern and southern Kassel).

- Pure static site (HTML/CSS/JS), no backend, no build step.
- [Leaflet 1.9.4](https://leafletjs.com/) + [Leaflet.markercluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster), self-hosted in `vendor/` (unchanged release files from unpkg, verified against their SRI hashes).
- Works offline and on a weak mobile signal (service worker, see *Offline and weak signal*).
- Data is prebuilt into `data/vending.geojson` by a nightly GitHub Action that queries the Overpass API.

Features: marker clustering, filter panel with 9 groups covering the `vending=*` values used worldwide (see [docs/vending-values.md](docs/vending-values.md); synonyms like `snack`/`snacks` are merged, `drinks;sweets` counts for both), per-type colored emoji markers, popups with operator/brand/payment/opening hours/level/note and *View/Edit on OSM* links, "Locate me", data timestamp + total count, mobile layout with a collapsible panel.

## Search

The search box (top left, or press `/`) finds two things:

- **Vending machines** as you type, from the loaded data: by name, brand, operator, note, what they sell (raw OSM values and the names in all six languages, so *Zigaretten* and *cigarettes* both work) and **where they are**: town, district/village, street, house number and the named place next to them (*fritzlar zigaretten*, *bahnhof*, *edeka*). Results are sorted by distance from the map centre and show the location; picking one zooms to it and opens its popup.
- **Places** (towns, streets, addresses) when you press Enter, via [Nominatim](https://nominatim.org/), preferring results near the current view. Enter again jumps to the best match. To respect the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) there is no search-as-you-type for places, at most one request per second, and answers are reused for the session. Place search needs a connection; machine search works offline.
- Coordinates like `51.1254, 9.2814` jump straight to that spot.

## Satellite view

The 🛰️ button (left control column) switches to satellite imagery with road and place labels on top. 🗺️ switches back, and the choice is remembered per browser. Imagery: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) (© Esri, Maxar, Earthstar Geographics), free for non-commercial use with attribution, which is shown automatically. If the site ever becomes commercial or high-traffic, check Esri's terms or switch to another imagery provider in `app.js` → `BASEMAPS`.

The ⚡ button below it turns on *faster zooming*: base-map tiles are no longer fetched for the intermediate zoom levels of a zoom animation (Leaflet `updateWhenZooming: false` on every tile layer), which saves requests and data, especially in satellite view. Off by default, but switched on automatically when the browser reports data saver or a slow (2G/3G) connection (Chromium only). An explicit choice wins and is remembered per browser (`localStorage` key `vm-zoomtiles`).

## Offline and weak signal

The site is built to open outdoors with a bad or no mobile signal:

- **Service worker (`sw.js`).** After the first visit, the app (HTML, CSS, JS, Leaflet) comes from the phone's cache. The page is still fetched from the network first so updates arrive, but after 4 s without an answer the cached copy is used.
- **Data.** `data/vending.geojson` is fetched from the network first. After 6 s without an answer (or with no network) the last downloaded copy is shown, and the footer says *offline copy*. A late answer still refreshes the cache for next time.
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

## Outside the prebuilt region

The map shows the machines of the prebuilt region (`data/vending.geojson`). Live loading from Overpass for other areas exists in the code but is **switched off** because it was too slow in practice. To turn it back on, set `LIVE.enabled = true` in `app.js`. It loads in small blocks, nearest first, and caches each area for 12 hours. To cover a bigger area permanently, enlarge `REGION_BBOX` instead (see *Change the region*).

Shared links to a machine outside the region still work: that single machine is fetched directly from the OSM API.

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
| `data/vending.geojson` | Prebuilt data (one feature per line for readable diffs) |
| `scripts/fetch-data.mjs` | Overpass → osmtogeojson → slim GeoJSON, enriched with each machine's location |
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

## Location enrichment

Most vending machines in OSM have no address. The nightly script adds one from their surroundings, in the same Overpass request (about 45 s for the current region), so the map can show *where* a machine is and search can find it by town or street. These properties start with `loc:` and are derived, not OSM tags:

| Property | From |
|---|---|
| `loc:street`, `loc:housenumber` | the machine's own `addr:*`, else the nearest address within 30 m, else the nearest named street within 60 m |
| `loc:city` | `addr:city` of that address, else the nearest town/village (`place=*`, cities count as nearer than villages) |
| `loc:place` | the nearest suburb, village or hamlet within 2.5 km, if it differs from `loc:city` |
| `loc:near` | the nearest named shop, amenity, station, office… within 30 m |

Radii are constants at the top of `scripts/fetch-data.mjs`. To work on the enrichment without querying Overpass every time, save one answer with `OVERPASS_SAVE=/tmp/op.json npm run fetch` and rerun with `OVERPASS_INPUT=/tmp/op.json FORCE_WRITE=1 npm run fetch`.

## Change the region

The region is a bounding box `south,west,north,east`. Change it in **both** places:

- `.github/workflows/update-data.yml` → `env.REGION_BBOX` and `env.REGION_NAME`
- `scripts/fetch-data.mjs` → the default for `REGION_BBOX` / `REGION_NAME` (used by local runs)

Then run the workflow (or `npm run fetch`). The map fits itself to the data, so no frontend changes are needed. [bboxfinder.com](http://bboxfinder.com/) is handy for picking a box (note it shows `west,south,east,north`).

Size guidance: this region is ~120 KB. A whole German state is a few MB; all of Germany is likely in the 10–20 MB range. The script warns (exit code 2) above 20 MB — at that point split by sub-region or narrow the box, as a single huge GeoJSON makes the page slow on phones.

## Attribution & licences

- **Map data** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). `data/vending.geojson` is a derived database and is likewise ODbL; keep the attribution if you reuse it.
- **Satellite imagery** © Esri, Maxar, Earthstar Geographics and the GIS User Community (Esri World Imagery, non-commercial use with attribution).
- **Map tiles** from `tile.openstreetmap.org`, used under the [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) (fine for a low-traffic hobby site; switch to another tile provider if traffic grows).
- **Overpass API** public instances are shared community resources — the nightly job runs once a day with a descriptive User-Agent; please keep it that way.
- Leaflet (BSD-2-Clause), Leaflet.markercluster (MIT), both redistributed unchanged in `vendor/`; osmtogeojson (MIT).
- Code in this repo: MIT.
