# Trip Maps

One static Leaflet app for every trip, with a toggle between destinations.

- **China** — Guangzhou 2 (Guangdong base, day trips to Foshan, Shenzhen, Zhaoqing, Hong Kong)
- **Japan** — Hokuriku 2, November 2027 (Osaka → Gero Onsen → Takayama → Matsumoto → Tokyo)

Each journey is generated from its own Notion database and lives as one data
block in `src/index.html`.

## Structure

- `src/index.html` — the whole app: styles, `JOURNEYS` data registry, renderer
- `src/img/` — Japan's photos (committed). China's photos are hotlinked from
  Wikimedia Commons (`wf()` in the data block), so they are not in the repo.
- `scripts/check.mjs` — validates every journey's data
- `scripts/smoke.mjs` — headless-browser checks for rendering and the toggle
- `docs/superpowers/` — design and implementation plan

## Adding a destination

1. Add one entry to `JOURNEYS` in `src/index.html` with:
   `title, sub, label, notionUrl, currency{symbol,locale}, map{center,zoom,fitInclude}, defaultBase, baseLayers[], staySelector, stops[], trips[], colors{}, rail{}, fallbacks{}` (and `periods{}` when `staySelector` is `"stops"`).
2. Run `node scripts/check.mjs`.
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
