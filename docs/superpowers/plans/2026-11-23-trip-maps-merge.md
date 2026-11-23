# Trip Maps Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the China and Japan single-page Leaflet maps into one static app with a China/Japan toggle, where a future destination is one registry block.

**Architecture:** One `src/index.html` holds a `JOURNEYS` registry (data only) plus a single `mountJourney(id)` that tears down and rebuilds the Leaflet map from the selected registry entry. A segmented pill calls `setJourney`, which persists to localStorage and mirrors `?trip=` in the URL.

**Tech Stack:** Vanilla HTML/CSS/JS, Leaflet 1.9.4 from cdnjs, Node 24 scripts (no npm dependencies), headless Edge over CDP for the smoke test.

**Spec:** `docs/superpowers/specs/2026-11-23-trip-maps-merge-design.md`

## Global Constraints

- No package.json, no bundler, no build step. `src/` is the deploy root.
- All rendering code must read the current journey through a module-scope `J`, never through a journey-specific identifier (`STOPS`, `TRIPS`, `COL`, `RAIL`, `ROAD_FALLBACK`, `cny`, `yen`, `PIC`, `PERIODS` must not survive).
- Journey data blocks are moved verbatim from the old files, with exactly two additions: `rk: 'Osaka>Kyoto'` on Japan's Kyoto day trip, and journey-level config fields.
- Currency comes from `J.currency`; both journeys render `¥`.
- The CARTO key `cb1_4dt6_1_b5fc5b5204dd3e9d89b2b612` stays as-is.
- Journey data sits between `//==DATA-START==` and `//==DATA-END==` so Node can extract it with `new Function`.
- UI strings stay English and unchanged from today except the `sub` line.
- Tests run with plain `node`; the smoke test drives `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` headless and needs internet (Leaflet CDN).

## Review Focus

1. An old China bookmark must land on China, not the default Japan — redirect carries `?trip=china`, and the URL parameter beats stored state.
2. Switching journeys while a route lookup is still in flight must not draw the old trip's polylines on the new map.
3. Switching back and forth must not duplicate stay options, layer controls, legends, or markers.
4. A missing or unreachable photo must degrade to the "No picture yet" carousel, never a broken page.
5. Blocked localStorage (private mode, file://) must not blank the app; it renders the default journey.

---

### Task 1: Repo scaffold, journey data, and validator

**Files:**
- Create: `src/index.html` (data script only; shell comes in Task 2)
- Create: `scripts/check.mjs`
- Create: `scripts/smoke.mjs` (harness only; assertions added per task)
- Copy: `src/img/` from the Japan clone (`C:\Users\quang\AppData\Local\Temp\opencode\tripmaps\japan-repo\src\img`)
- Copy: `docs/superpowers/specs/2026-11-23-trip-maps-merge-design.md` into the new repo
- Create: `README.md`, `.gitignore`

**Interfaces:**
- Produces: `JOURNEYS` in `src/index.html` between the DATA markers, keyed `china` and `japan`, each with `title, sub, label, notionUrl, currency{symbol,locale}, map{center,zoom,fit,fitInclude}, defaultBase, baseLayers[], staySelector, periods?, stops[], trips[], rail{}, fallbacks{}, colors{}`.
- Produces: `node scripts/check.mjs` → exit 0, one `OK <journey>` line per journey.
- Produces: `node scripts/smoke.mjs` with helpers `withBrowser(fn)`, `navigate(url)`, `evalJs(expr)`, `click(selector)`, `waitFor(expr, timeoutMs)`, `assert(cond, label)`; runs from a `node:http` static server on an ephemeral port rooted at `src/`. It prints one PASS line per assertion and exits 0 only if all pass.

- [ ] **Step 1: Write the failing validator**

`scripts/check.mjs` reads `src/index.html`, extracts between `//==DATA-START==` and `//==DATA-END==`, evaluates with `const wf = n => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(n) + '?width=1000'`, returning `{TILES, JOURNEYS}`, and validates per journey:
- required keys present: `title, label, notionUrl, currency, map, defaultBase, baseLayers, staySelector, stops, trips, rail, fallbacks, colors`;
- every file named in `baseLayers` exists in `TILES`;
- each stop has `c, r, ll, n, b, pics`; `ll` is `[lat,lng]` with lat in −90..90 and lng in −180..180; `pics` is a non-empty array;
- `tc` is present (may be `null`); `act` may be `''`;
- city names are unique across stops + trips;
- each `pics` entry is `http(s)://…` or an existing file under `src/`;
- every `rk` on a trip resolves in `rail`; every `rail`/`fallbacks` key is `A>B` with both cities known;
- `periods`, when present, has keys that are all stop cities and is absent when `staySelector` is `'stops+trips'`.

Exit non-zero with one line per failure.

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check.mjs`
Expected: exit 1, message that the DATA markers or `src/index.html` are missing.

- [ ] **Step 3: Create the repo, copy images and spec, write the DATA block**

`git init`, copy the Japan `src/img` folder (all ~46 jpgs plus `CREDITS.txt`) and the China clone's `src/img/CREDITS.txt` as `src/img/CREDITS-wikimedia.txt`.

`src/index.html` at this stage contains only the doctype, `<head>` with title `Trip Maps`, the two script tags (data script plus an empty app script), and:

```js
//==DATA-START==
const TILES = {
  voyager: {url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key='+CK, options:{subdomains:'abcd', maxZoom:19, attribution:CA}},
  positron: {url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key='+CK, options:{subdomains:'abcd', maxZoom:19, attribution:CA}},
  gsi: {url:'https://cyberjapandata.gsi.go.jp/xyz/english/{z}/{x}/{y}.png', options:{minZoom:5, maxNativeZoom:11, maxZoom:18, attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html">GSI Japan</a>'}},
  osm: {url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options:{maxZoom:18, attribution:OSM}}
};
```

with `CK`, `OSM`, `CA`, `wf` above it. Then `JOURNEYS = { china: {...}, japan: {...} }` carrying the old data blocks verbatim:

- `china`: `title:'Guangzhou 2'`, `sub:''`, `label:'🇨🇳 China'`, `notionUrl:'https://app.notion.com/p/PLACEHOLDER-GUANGZHOU2'`, `currency:{symbol:'¥',locale:'en-US'}`, `map:{center:[22.9,113.6],zoom:8,fitInclude:'stops+trips'}`, `defaultBase:'voyager'`, `baseLayers:['voyager','positron','osm']`, `staySelector:'stops+trips'`, plus the old `STOPS`/`TRIPS`/`COL`/`RAIL`/`ROAD_FALLBACK` values as `stops/trips/colors/rail/fallbacks`.
- `japan`: `title:'Hokuriku 2'`, `sub:'November 2027'`, `label:'🇯🇵 Japan'`, `notionUrl:'https://app.notion.com/p/a559ab993b314d3fb9c5aa452c4c5fcd'`, `currency:{symbol:'¥',locale:'en-US'}`, `map:{center:[35.9,137.0],zoom:7,fitInclude:'stops'}`, `defaultBase:'voyager'`, `baseLayers:['voyager','positron','gsi','osm']`, `staySelector:'stops'`, `periods:{'Osaka':'Nov 1–3','Gero Onsen':'Nov 3','Takayama':'Nov 4–7','Matsumoto':'Nov 7–10','Tokyo':'Nov 10–13'}`, plus its `stops/trips/colors/rail/fallbacks`.
- Kyoto's day trip gains `rk:'Osaka>Kyoto'`.

README states: structure, `node scripts/check.mjs`, `node scripts/smoke.mjs`, deploy from `src/`, and how to add a destination (new `JOURNEYS` entry; toggle appears automatically).

- [ ] **Step 4: Run the validator to verify it passes**

Run: `node scripts/check.mjs`
Expected: `OK china` and `OK japan`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold trip-maps with china and japan journey data"
```

---

### Task 2: Shell and mount for one journey

**Files:**
- Modify: `src/index.html` (head, styles, `#bar` markup, app script)
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `JOURNEYS`, `TILES` from Task 1.
- Produces: `mountJourney(id: string): void` — maps `#map`, `#bar` title/sub, `#stay-sel`, `#stats`.
- Produces: `money(v: number): string` (uses `J.currency`), `dur(m: number): string`, `carHTML(list: string[]): string`, `wireCar(el: HTMLElement, list: string[]): void`, `stopCard(s: object): HTMLElement`, `pickJourneyFromUrl(): string`.
- Produces module-scope: `let J`, `let map`, `const markers = new Map()` (city → L.Marker).

- [ ] **Step 1: Add the failing smoke assertions**

In `scripts/smoke.mjs`, add `testMount()`:

1. `http://127.0.0.1:<port>/?trip=china` → `document.title === 'Guangzhou 2'`, `#bar b` text `Guangzhou 2`, `#sub` empty, marker count (`.leaflet-marker-icon.stop`) = 5 (1 stop + 4 day trips).
2. `?trip=japan` → title `Hokuriku 2`, `#sub` text `November 2027`, marker count = 9 (5 + 4).
3. Japan `#stay-sel option` count = 5 with first option text `Osaka · Nov 1–3`; China count = 5 with first text `Guangzhou · 6 nights (base)`.
4. `#stats` text contains `12 nights` and `¥` for Japan, `6 nights` for China.
5. `.legend div i` count equals the number of transport types used by that journey (China 4, Japan 3).
6. Japan: every `img` inside an opened stop popup has `naturalWidth > 0` after opening the Osaka popup, and the popup shows `Stay`/`Candeo Hotel`.
7. Console: no `Runtime.exceptionThrown` events during either load.
8. With `Storage.prototype.getItem` patched to throw before load, `?trip=japan` still renders title and 9 markers.

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/smoke.mjs`
Expected: exit 1 on the first assertion (`mountJourney` not defined → title unchanged).

- [ ] **Step 3: Implement the shell and mount**

Head/CSS: reuse the old stylesheet verbatim; add `.bar-sub{font-size:11px;opacity:.55;margin-top:1px}` and `.jbtn` styles for the toggle pill (buttons inherit the pill look; active segment gets `background:#1f2328;color:#fff`).

Markup:

```html
<div id="bar">
  <div class="pill"><b id="title"></b><div id="sub" class="bar-sub"></div></div>
  <div class="pill" id="journeys"></div>
  <div class="pill"><label>Stay: <select id="stay-sel"></select></label></div>
  <div class="pill" id="stats"></div>
</div>
```

`mountJourney` steps: guard `JOURNEYS[id]`; `markers.clear()`; if `map` exists `map.remove()`; build `map` with `zoomControl:true`; build tile layers from `J.baseLayers` as fresh `L.tileLayer`s (do not reuse the registry objects); add `J.defaultBase`; add the layer control; set title/sub; draw markers from `stops` then `trips` (day trips get the small icon class `.stop.t`, permanent tooltip to the right, hover opens popup, `stopCard` popup with `maxWidth:280`); fill the stay selector (`stops` always, plus `trips` when `staySelector === 'stops+trips'`), clearing options first, label `city · "N nights (base)"` for stops or `periods[city]` when present, `city · "day trip from <base>"` for trips; write stats; add the legend; finish with `fitBounds` over the points chosen by `J.map.fitInclude` padded `.15`, or `setView(J.map.center, J.map.zoom)` when `fitInclude` is absent.

`stopCard` keeps today's markup and the `hd`/`hu` hotel behaviour; the `rg` line is `${s.r} · ${dayTrip ? 'Day trip from ' + base : n + ' night(s)'}`.

Stay selector `onchange`: remove `hl` from all marker elements (`markers` map), add it to the chosen one, `openPopup()`, `panTo`.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/smoke.mjs`
Expected: 8 PASS lines, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/index.html scripts/smoke.mjs
git commit -m "feat: render a journey from the registry"
```

---

### Task 3: Routes, legs, and tooltip photos

**Files:**
- Modify: `src/index.html` (app script)
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `J`, `map`, `markers`, `money`, `dur` from Task 2.
- Produces: `routePoints(a, b, rk?): [number,number][]` (rail → fallbacks → straight line), `drawLeg(a, b, {dashed, rk, pics, each}): L.Polyline`, `attach(poly, info, pics, gurl): void`, `legInfo(leg, from, to, each): object`, `upgradeRoute(poly, a, b, gen): Promise<void>`.
- Produces module-scope `let gen = 0`, incremented at the top of `mountJourney`.

- [ ] **Step 1: Add the failing smoke assertions**

Add `testLegs()`:

1. China `?trip=china` → `path.leaflet-interactive` count = 4; Japan `?trip=japan` → 8, after `waitFor` of 1500 ms.
2. Japan: exactly one path with stroke `#1c7ed6` (Kyoto day trip, which uses its `rk` rail shape) and exactly four dashed paths (`stroke-dasharray`) — the day trips.
3. Hovering the first path yields a tooltip containing `Click for details and pictures` and an `<img class="tt">` whose `src` is the destination's first pic.

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/smoke.mjs`
Expected: exit 1 at assertion 1 (0 paths drawn).

- [ ] **Step 3: Implement routes and legs**

`drawLeg` computes `routePoints` synchronously, draws immediately with colour `J.colors[a.t] || '#888'`, weight 6 for main legs and 4 dashed `8 8` for day trips, binds tooltip + popup through `attach`, and calls `upgradeRoute` when there is no rail shape and the mode is road-able (`Bus`, `Car`, or a day trip with no `rk`).

`upgradeRoute` reads/writes cache key `osrm:<journey>:<a.c>><b.c>` in localStorage (wrapped in try/catch), fetches OSRM, and only calls `poly.setLatLngs(pts)` when `gen` is unchanged. Failures are silent.

`legInfo(leg, from, to, each)` returns `{tn, t, m, tc, route: from + ' → ' + to, each}`; `legTip` renders the first `pics` entry as `<img class="tt">` plus mode, `dur`, `money(tc) + ' (est.)'` or `cost n/a`.

Main legs run sequentially in `mountJourney` after markers; day trips run after main legs, using their `base` stop. `gen` is captured before any await.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/smoke.mjs`
Expected: all PASS lines, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/index.html scripts/smoke.mjs
git commit -m "feat: draw journey legs with rail, fallback and road geometry"
```

---

### Task 4: The journey toggle

**Files:**
- Modify: `src/index.html` (toggle markup is already in Task 2; add behaviour)
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `mountJourney`, `JOURNEYS`.
- Produces: `setJourney(id, {writeUrl = true} = {}): void`, `currentJourney(): string`, `initToggle(): void`.
- Produces: storage key `tripmap_journey`.

- [ ] **Step 1: Add the failing smoke assertions**

Add `testToggle()`:

1. Load `?trip=japan`, click the China button, `waitFor` title `Guangzhou 2`; `location.search === '?trip=china'`; 5 markers; stats contains `6 nights`.
2. Click Japan → China → Japan again: marker count matches Japan (9) each time, `#stay-sel option` count is 5 for Japan and 5 for China (never 10), `.leaflet-control-layers` count = 1, `.legend` count = 1, and `localStorage.tripmap_journey === 'japan'`.
3. `?trip=china` with localStorage already `japan` → China renders (URL beats storage).
4. `?trip=nope` with localStorage unset → Japan renders and the URL is replaced with `?trip=japan`.
5. Reload with no query string after choosing China → China renders (storage default).
6. Delayed-lookup guard: inject `Page.addScriptToEvaluateOnNewDocument` wrapping `window.fetch` with a 3000 ms delay, load `?trip=japan`, click China within 500 ms, wait 4 s, then assert exactly 4 China paths and **no** path with stroke `#2f9e44` (green, Japan's bus colour — no China leg uses it).
7. No `Runtime.exceptionThrown` during the whole sequence.

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/smoke.mjs`
Expected: exit 1 — no `#journeys button` exists yet.

- [ ] **Step 3: Implement the toggle**

`initToggle` builds one `<button data-journey="…">` per `Object.keys(JOURNEYS)` with `JOURNEYS[k].label`, `type=button`, `aria-pressed`, and a click handler calling `setJourney(k)`.

`setJourney(id, {writeUrl = true})` resolves the id against `Object.keys(JOURNEYS)`, writes `localStorage.tripmap_journey` inside try/catch, calls `mountJourney(id)`, updates `aria-pressed` and the active class, and when `writeUrl` calls `history.replaceState(null, '', '?trip=' + id)`.

Boot: `const fromUrl = new URLSearchParams(location.search).get('trip')`; `const stored = (() => { try { return localStorage.getItem('tripmap_journey') } catch { return null } })()`; pick `fromUrl` if valid, else `stored` if valid, else `japan`; call `initToggle()` then `setJourney(pick, {writeUrl: true})`.

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/smoke.mjs`
Expected: 18 PASS lines, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/index.html scripts/smoke.mjs
git commit -m "feat: switch journeys from a toggle with URL and storage memory"
```

---

### Task 5: Sweep, README, and full validation

**Files:**
- Modify: `src/index.html`, `README.md`, `scripts/check.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: no new runtime API.

- [ ] **Step 1: Write the failing sweep assertion**

Add to `scripts/check.mjs`: read `src/index.html` and fail if any of `STOPS`, `TRIPS`, `COL`, `RAIL`, `ROAD_FALLBACK`, `PIC`, `PERIODS`, `cny`, `yen`, `NOTION_URL` appears outside the DATA block; fail if `JOURNEYS` keys and the toggle's rendered keys can diverge (assert the toggle markup is generated, i.e. no hardcoded `data-journey=` literal in the HTML).

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: exit 1 naming at least one leftover identifier (the data block still uses `TRIPS`-style field names only inside DATA, so any leftover is a real hit).

- [ ] **Step 3: Fix leftovers and finish the docs**

Rename intra-block field keys only where they are journey keys (`stops`, `trips`); remove `PIC`/`L_` remnants. README documents: what the app is, the toggle, adding a destination (add a `JOURNEYS` entry with the listed fields; the toggle picks it up), `node scripts/check.mjs`, `node scripts/smoke.mjs` (needs Edge + internet), local preview (`npx serve src` or any static server), and that `src/img` holds Japan's photos while China hotlinks Wikimedia.

- [ ] **Step 4: Run both suites**

Run: `node scripts/check.mjs && node scripts/smoke.mjs`
Expected: `OK china`, `OK japan`, 18 PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove journey-specific globals, document adding a destination"
```

---

### Task 6: Deploy the new project

**Files:**
- Create: remote repo `quangtrandao/trip-maps`, Vercel project `trip-maps`

**Interfaces:**
- Produces: production URL used by Task 7.

- [ ] **Step 1: Verify the build is static and clean**

Run: `node scripts/check.mjs && node scripts/smoke.mjs`
Expected: pass. Confirm no `node_modules`, no `.env`, no temp files: `git status --short` empty.

- [ ] **Step 2: Push the repo**

Add remote `https://github.com/quangtrandao/trip-maps.git` and `git push -u origin main`. If the remote does not exist, create it (GitHub web or `gh`); if auth fails, stop and hand off to the user rather than guessing credentials.

- [ ] **Step 3: Create the Vercel project and deploy**

Use `create_git_project` with repo `quangtrandao/trip-maps`, output directory `src`, framework preset "Other". If the Git connection is unavailable, deploy with `create_deployment` from the local `src/` tree instead and record that the project is not git-linked.

- [ ] **Step 4: Verify production**

Fetch the production URL and assert HTTP 200, `<title>Trip Maps</title>`, and that `?trip=china` returns the same page (client-side switch). Open the URL in the browser tool, click both toggle segments, confirm each renders its own markers, stats and legend, and that no console errors appear.

- [ ] **Step 5: Commit the deploy notes**

Append the production URL to `README.md`, commit `chore: record production URL`.

---

### Task 7: Redirect the old sites

**Files:**
- Create: `vercel.json` in `C:\Users\quang\Documents\Default Project\china-trip`
- Create: `vercel.json` in the Japan clone at `C:\Users\quang\AppData\Local\Temp\opencode\tripmaps\japan-repo` (clone it to `C:\Users\quang\Documents\Default Project\japan-trip` first)

**Interfaces:**
- Consumes: the new production URL from Task 6.

- [ ] **Step 1: Write both redirect files**

```json
{ "redirects": [ { "source": "/(.*)", "destination": "https://<new-domain>/?trip=china", "permanent": true } ] }
```

(Japan: `?trip=japan`.)

- [ ] **Step 2: Commit and push each**

```bash
git add vercel.json
git commit -m "chore: redirect to the merged trip-maps app"
git push
```

- [ ] **Step 3: Verify both redirects**

Fetch `https://china-trip-map-omega.vercel.app` with redirects disabled: expect 308 to `<new-domain>/?trip=china`. Fetch `https://japan-trip-map-olive.vercel.app`: expect 308 to `…?trip=japan`. Follow the China redirect in the browser tool and confirm the China map, not Japan.

- [ ] **Step 4: Report**

State both production URLs, the redirect results, and how to add the next destination.

---

## Self-review notes

- Spec coverage: registry + toggle (Tasks 1, 4), per-journey photos/currency/colours/stay/periods/layers/map start (Tasks 1–2), route lookup + guard (Task 3), dead tooltip photo repair (Task 3), validation rewrite (Tasks 1, 5), deployment and redirects with trip param (Tasks 6–7), builder's calls (title/sub, GSI, `hd`/`hu`) honoured in Tasks 1–2.
- Interface consistency: `mountJourney`, `setJourney`, `pickJourneyFromUrl`, `routePoints`, `drawLeg`, `upgradeRoute`, `money`, `markers`, `gen` are defined once and referenced by the same names later.
- Deliberate deviation from the spec's `baseLayers` objects: they are name lists into a single `TILES` registry so the CARTO key and attributions are written once. Adding a destination still needs no code change.
