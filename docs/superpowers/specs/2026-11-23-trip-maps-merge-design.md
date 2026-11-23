# Trip Maps — merge China + Japan into one app

Date: 2026-11-23
Status: awaiting approval (rev 2, after builder review)

## Intent

Two Leaflet trip maps exist as separate Vercel projects, both generated from
Notion databases:

- `china-trip` → "Guangzhou 2", deployed at `china-trip-map-omega.vercel.app`
- `japan-trip` → "Hokuriku 2 – November 2027", deployed at
  `japan-trip-map-olive.vercel.app`

They share one scaffold: same HTML shell, same renderer, ~95% identical code.
Only the data blocks differ. Keeping two projects duplicates every future
renderer change, and each new trip would need its own project.

The user wants one app with a trip toggle, and wants adding a future
destination to be a small edit rather than a new deployment.

## Goals

- One app, one URL, with a segmented toggle (China ⇄ Japan) in the top bar.
- Every current feature survives for both trips: stop popups with photo
  carousels, day-trip legs, transport polylines and tooltips, stay selector,
  legend, stats line, base-layer switcher, Google Maps links.
- Adding a future trip = one new data block in the `JOURNEYS` registry. The
  toggle is rendered from the registry, so it appears automatically.
- The two old URLs 308-redirect to the new app, each preserving its trip.

## Non-goals

- No framework, bundler, or build step. Still a static single HTML file plus
  images.
- No new user-facing features beyond the toggle: no gamification, no accounts,
  no sync, no in-page editing.
- No itinerary content rewrites. Text stays as generated from each Notion DB
  (English) and currency stays per trip (CNY and JPY both render `¥`).
- No changes to the Notion databases or the regeneration workflow.

## Approach (chosen: A — one inline-data file)

`src/index.html` holds a top-level registry and one mount function:

```js
const JOURNEYS = {
  china: {
    title: 'Guangzhou 2', sub: '', label: '🇨🇳 China',
    notionUrl: 'https://app.notion.com/p/PLACEHOLDER-GUANGZHOU2',
    currency: { symbol: '¥', locale: 'en-US' },
    map: { center: [22.9, 113.6], zoom: 8, fit: 'bounds' },
    gsi: false,
    staySelector: 'stops+trips',
    baseLayers: [ { name, url, attribution, maxZoom, minZoom, maxNativeZoom, default } ],
    stops: [ ... ],         // unchanged field shape: c, r, ll, n, acc, ac, act, b, t, tn, tc, m, hd, hu, pics
    trips: [ ... ],         // day-trip legs; optional rk (rail key) added
    rail: { 'A>B': [[lat,lng], ...] },
    fallbacks: { 'A>B': [[lat,lng], ...] },
    colors: { 'High-speed rail': '#d6336c', ... },
    periods: { 'Osaka': 'Nov 1–3', ... }   // optional, overrides derived dates
  },
  japan: { ... }
};
```

`TRIPS` already means day-trip legs inside each journey, so the top-level
registry is `JOURNEYS` to avoid the clash. Journey objects keep today's field
names (`stops`, `trips`) internally so the existing data blocks can be moved
verbatim, except for the two additions below.

Rejected alternative (B): shared renderer plus one data file per trip. Better
separation, but a new destination would mean a new file plus a registration
edit, and regenerating from Notion would touch two files. The user chose A
explicitly so that adding a destination is a single-block edit.

Rejected alternative (C): SPA with routes and a build step. No payoff for two
static maps.

## Lifecycle (the part rev 1 got wrong)

The current code is one-shot: it mutates journey data with marker refs
(`s.mk`), closes over module-level `const STOPS/TRIPS/COL/RAIL` in a dozen
functions, builds the legend and layer control once, appends `<option>`s
without clearing, and fires async `road()` lookups with no journey guard.
Swapping a global `J` under that code leaks layers and throws.

Decision: **the whole map is torn down and rebuilt on switch.**

```
mount(id):
  generation++                      // invalidates in-flight async lookups
  if (map) { map.remove(); map = null }
  J = JOURNEYS[id]
  map = L.map('map', { zoomControl: true })
  ... build baseLayer, marker/leg/hotel layer groups, controls, legend,
      stay selector (cleared and refilled), stats line, title
  await legs with generation check so stale road()/rail results are dropped
  fitBounds over J.stops + J.trips  (or setView when map.fit === 'center')
```

Consequences, all intentional:

- No marker refs are written onto data objects; a local `markers` map holds
  them for highlight/popup use and dies with the map.
- Legend and base-layer controls are recreated each mount, so per-journey
  layers and colours need no incremental add/remove logic and no stale GSI
  tiles.
- The stay selector is emptied before refilling; no duplicate options.
- `road()` results carry the generation they were requested under and are
  discarded if the journey changed.
- OSRM/route cache keys are prefixed with the journey id.
- Switching does **not** reload the page. It calls
  `history.replaceState` to set `?trip=<id>`, so the URL always matches the
  view and stays shareable.

## Behaviour of the toggle

- A segmented pill in `#bar`, left of the Stay selector, built from
  `Object.keys(JOURNEYS)`.
- Selected journey persists in `localStorage('tripmap_journey')`.
- `?trip=<id>` wins over localStorage. Unknown value falls back to the stored
  journey, then to Japan.
- First visit with no stored value: Japan.

## Per-journey differences to absorb

| Concern | China | Japan | Merged handling |
|---|---|---|---|
| Photos | hotlinked Wikimedia (`wf()`) | local `img/*.jpg` (~5 MB) | keep both; `pics` accepts URLs or paths |
| Currency | CNY | JPY | `J.currency` through one formatter |
| Transport legend | HSR/Intercity/Metro/Cross-border | Shinkansen/Limited Express/Local/Bus | `J.colors`; legend from it; polyline colour = `J.colors[leg.t]` |
| Stay selector | stops **and** day trips | stops only | `J.staySelector` |
| Stay labels | derived from `n` nights | hardcoded periods | optional `J.periods`, else derived |
| Routes | rail polylines | rail + road fallback + one special case | `leg.rk` → `J.rail[rk]` → `J.fallbacks['a>b']` → OSRM road → straight line |
| Base layers | 3 | 4 incl. GSI English labels | `J.baseLayers`; GSI only where declared |
| Map start | Guangzhou | Osaka→Tokyo | `J.map` |

Japan's `if (t.c === "Kyoto")` special case becomes `rk: 'Osaka>Kyoto'` on that
day-trip leg, which the generic lookup already handles. Colours still match
today's output (Kyoto blue, other Japan day trips green; China's four types
unchanged).

Dead code in both sites: `PIC`/`L_()` never resolve, so leg tooltips never
show a photo. Fixed rather than carried over — a leg tooltip uses the first
photo of its destination. This is a repair of existing intent, not a new
feature.

## Constraints and risks

- The CARTO key is embedded in page source. Verified not domain-locked (tiles
  serve with any referer, including localhost). Keep it, treat as public.
- Japan's images live in the repo; China's do not. The merged repo carries
  ~5 MB of Japan photos.
- Only the selected journey is persisted; no other UI state is saved.
- The redirect must carry the trip id, or an old China bookmark lands on Japan.

## Deployment

- New repo `quangtrandao/trip-maps`, new Vercel project `trip-maps`, output
  directory `src/`.
- Old projects each get a `vercel.json` redirecting 308 to
  `https://<new-domain>/?trip=china` and `...?trip=japan` respectively, then
  redeploy.
- Local working copy: `C:\Users\quang\Documents\Default Project\trip-maps`
  (next to the existing `china-trip` clone).

## Validation

`scripts/check.mjs` is rewritten to be journey-agnostic (the current one
asserts China-only facts such as the title and the absence of a JPY
formatter). It asserts, per journey:

- registry entry has `title`, `map`, `currency`, `stops`, `colors`;
- every stop has `c`, `r`, `ll` (lat/lng in range), `n`, `b`, `pics` non-empty;
- `tc` may be `null` but must be present; `act` may be empty;
- stop and day-trip city names are unique within the journey;
- every `pics` entry is either an `http(s)` URL or an existing file in
  `src/img/`;
- every `rk`, `rail` and `fallbacks` key referenced by a leg resolves;
- `periods` keys, when present, are a subset of stop city names.

## Builder's calls (settled without asking)

- Toggle styling reuses the existing `.pill` language; active segment filled,
  inactive plain.
- `sub` shown under the title when present (e.g. "November 2027").
- Teardown = `map.remove()` + rebuild (above), not `location.reload()`.
- `?trip=` is written with `replaceState` on switch.
- No `package.json`; the check script stays dependency-free Node.
- Stop fields `hd` (booked) and `hu` (hotel maps URL) survive untouched.
