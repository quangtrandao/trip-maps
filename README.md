# Trip Maps

One static Leaflet app for every trip, with a toggle between destinations.

- **China** — Guangzhou 2 (Guangdong base, day trips to Foshan, Shenzhen, Zhaoqing, Hong Kong)
- **Japan** — Hokuriku 2, November 2027 (Osaka → Gero Onsen → Takayama → Matsumoto → Tokyo)
- **Italy → France** — 24 nights, train only (Milan → Bologna → Genoa → Nice → Avignon →
  Lyon → Paris), 13 day trips, food-led, no driving

Each journey is generated from its own Notion database and lives as one data
block in `src/index.html`.

## Structure

- `src/index.html` — the whole app: styles, data registries, renderer
- `src/img/` — Japan's photos (committed). China's photos are hotlinked from
  Wikimedia Commons (`wf()` in the data block), so they are not in the repo.
- `scripts/check.mjs` — validates every journey's data
- `scripts/smoke.mjs` — headless-browser checks for rendering and the toggle
- `docs/superpowers/` — design and implementation plans

## Bilingual and money

- Every user-visible string is English with Vietnamese beneath it (`.vi`).
  Journey content carries `titleVi`, `subVi`, `labelVi`, `actVi`, `tnVi`,
  `cVi`, `accVi` and `periodsVi`; UI chrome comes from the `UI` table.
- Prices show the trip currency plus a VND equivalent, from the fixed `RATES`
  table (VND per unit) dated `RATES.asOf` and printed in the legend footer.
  `CN¥` and `JP¥` are distinct symbols — both currencies use `¥`.
- `FAMILIES` holds the one palette shared by all trips (high-speed, express,
  regional, urban, bus/road); `MODES` maps each transport name to a family, so
  a colour means the same thing everywhere and the legend lists families.
  Day trips keep their transport colour and are drawn dashed.

## Adding a destination

1. Add one entry to `JOURNEYS` in `src/index.html` with:
   `title, titleVi, sub, subVi, label, labelVi, notionUrl, currency{code,symbol,locale}, map{center,zoom,fitInclude}, defaultBase, baseLayers[], staySelector, stops[], trips[], rail{}, fallbacks{}` (and `periods{}`/`periodsVi{}` when `staySelector` is `"stops"`).
   Every stop and day trip needs `actVi`, `tnVi` when it has `tn`, and `cVi`
   for Chinese city names. Transport `t` must exist in `MODES`.
2. Run `node scripts/check.mjs` and `node scripts/smoke.mjs`.
3. Commit and push — the toggle builds itself from the registry keys.

## Check and test

```bash
node scripts/check.mjs   # data validation, no dependencies
node scripts/smoke.mjs   # headless Edge + CDP, needs internet for Leaflet CDN
```

`smoke.mjs` looks for Microsoft Edge; override with
`TRIPMAPS_EDGE=/path/to/browser`.

## Preview locally

```bash
npx serve src
# or: python -m http.server 8080 --directory src
```

## Deploy

Served by Vercel from `src/` at **https://trip-maps-theta.vercel.app**
(project `trip-maps`, repo `quangtrandao/trip-maps`, production branch `main`;
pushing to `main` redeploys).

The old `china-trip-map-omega` and `japan-trip-map-olive` projects 308-redirect
here with their trip pre-selected (`?trip=china`, `?trip=japan`). The China
project is not Git-linked, so its redirect lives in a direct deployment; to
change it, edit the redirect and redeploy that project.

## Notes

- The CARTO key is embedded in the page. It is public and not domain-locked.
- Rail polylines are approximate station chains, not survey-grade shapes.
- Route geometry for road legs is upgraded from the public OSRM demo server
  after the first draw; failures fall back to a straight line.
