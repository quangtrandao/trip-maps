// Validates the JOURNEYS registry embedded in src/index.html.
// No dependencies: runs with plain `node scripts/check.mjs`.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const srcDir = resolve(root, "src");
const htmlPath = process.argv[2] ? resolve(process.argv[2]) : resolve(srcDir, "index.html");

const problems = [];
const fail = (msg) => problems.push(msg);

let html;
try {
  html = readFileSync(htmlPath, "utf8");
} catch {
  console.error(`FAIL src/index.html not found at ${htmlPath}`);
  process.exit(1);
}

const marker = html.match(/\/\/==DATA-START==([\s\S]*?)\/\/==DATA-END==/);
if (!marker) {
  console.error("FAIL src/index.html: //==DATA-START== / //==DATA-END== markers not found");
  process.exit(1);
}

let registry;
try {
  registry = new Function(`${marker[1]}\nreturn { TILES, RATES, FAMILIES, MODES, UI, JOURNEYS };`)();
} catch (e) {
  console.error(`FAIL src/index.html: data block did not evaluate: ${e.message}`);
  process.exit(1);
}

const { TILES, RATES, FAMILIES, MODES, UI, JOURNEYS } = registry;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

if (!isObj(TILES) || Object.keys(TILES).length === 0) fail("TILES is missing or empty");
if (!isObj(JOURNEYS) || Object.keys(JOURNEYS).length === 0) fail("JOURNEYS is missing or empty");

// Shared currency and colour registries.
if (!isObj(RATES) || typeof RATES.asOf !== "string") fail("RATES must be an object with an asOf date");
if (!isObj(FAMILIES) || !Object.keys(FAMILIES).length) fail("FAMILIES is missing or empty");
for (const [key, f] of Object.entries(FAMILIES || {})) {
  if (!f.en || !f.vi) fail(`FAMILIES.${key}: needs en and vi labels`);
  if (!/^#[0-9a-f]{6}$/i.test(String(f.color))) fail(`FAMILIES.${key}: color must be a hex colour`);
}
if (!isObj(MODES) || !Object.keys(MODES).length) fail("MODES is missing or empty");
for (const [name, m] of Object.entries(MODES || {})) {
  if (!m.en || !m.vi) fail(`MODES["${name}"]: needs en and vi labels`);
  if (!FAMILIES?.[m.family]) fail(`MODES["${name}"]: family "${m.family}" is not in FAMILIES`);
}
if (!isObj(UI)) fail("UI string table is missing");
for (const key of ["stay", "do", "budget", "next", "travel", "type", "time", "cost", "eachWay", "est", "costNA", "dayTripFrom", "nights", "noPictures", "legendHint", "rates", "freeStay"]) {
  if (!UI?.[key]?.en || !UI?.[key]?.vi) fail(`UI.${key}: needs en and vi strings`);
}

const REQUIRED = ["title", "titleVi", "sub", "subVi", "label", "labelVi", "notionUrl", "currency", "map", "defaultBase", "baseLayers", "staySelector", "stops", "trips", "rail", "fallbacks"];
const TRIP_LEG_FIELDS = ["c", "base", "r", "ll", "pics"];

const pictureOk = (p) => {
  if (typeof p !== "string" || !p) return false;
  if (/^https?:\/\//.test(p)) return true;
  return existsSync(resolve(srcDir, p));
};

const isPair = (v) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

for (const [id, j] of Object.entries(JOURNEYS || {})) {
  const at = `JOURNEYS.${id}`;
  if (!isObj(j)) {
    fail(`${at}: not an object`);
    continue;
  }
  for (const key of REQUIRED) {
    if (!(key in j)) fail(`${at}.${key}: missing`);
  }
  if (typeof j.title !== "string" || !j.title) fail(`${at}.title: must be a non-empty string`);
  if (typeof j.titleVi !== "string" || !j.titleVi) fail(`${at}.titleVi: must be a non-empty string`);
  if (typeof j.label !== "string" || !j.label) fail(`${at}.label: must be a non-empty string`);
  if (typeof j.labelVi !== "string" || !j.labelVi) fail(`${at}.labelVi: must be a non-empty string`);
  if (!/^https:\/\/app\.notion\.com\//.test(String(j.notionUrl || ""))) fail(`${at}.notionUrl: must be an app.notion.com URL`);
  if (typeof j.sub !== "string") fail(`${at}.sub: must be a string (may be empty)`);
  if (typeof j.subVi !== "string") fail(`${at}.subVi: must be a string (may be empty)`);
  if (!isObj(j.currency) || typeof j.currency.symbol !== "string" || typeof j.currency.locale !== "string") {
    fail(`${at}.currency: needs string symbol and locale`);
  } else if (!RATES?.[j.currency.code]) {
    fail(`${at}.currency.code: "${j.currency.code}" is not in RATES`);
  }
  if (!isObj(j.map) || !isPair(j.map.center) || !isNum(j.map.zoom)) fail(`${at}.map: needs center [lat,lng] and numeric zoom`);
  if (!["stops", "stops+trips"].includes(j.map.fitInclude)) fail(`${at}.map.fitInclude: must be "stops" or "stops+trips"`);
  if (!Array.isArray(j.baseLayers) || !j.baseLayers.length) fail(`${at}.baseLayers: must be a non-empty array`);
  for (const name of j.baseLayers || []) {
    if (!TILES?.[name]) fail(`${at}.baseLayers: "${name}" is not in TILES`);
  }
  if (!TILES?.[j.defaultBase]) fail(`${at}.defaultBase: "${j.defaultBase}" is not in TILES`);
  else if (!(j.baseLayers || []).includes(j.defaultBase)) fail(`${at}.defaultBase: "${j.defaultBase}" is not listed in baseLayers`);
  if (!["stops", "stops+trips"].includes(j.staySelector)) fail(`${at}.staySelector: must be "stops" or "stops+trips"`);

  if (!Array.isArray(j.stops) || !j.stops.length) fail(`${at}.stops: must be a non-empty array`);
  if (!Array.isArray(j.trips)) fail(`${at}.trips: must be an array`);

  if (j.staySelector === "stops+trips" && j.periods) fail(`${at}.periods: must be absent when staySelector is "stops+trips"`);

  const cities = new Set();
  for (const [i, s] of (j.stops || []).entries()) {
    const sat = `${at}.stops[${i}] (${s?.c ?? "?"})`;
    for (const key of ["c", "r", "ll", "n", "b", "pics"]) {
      if (!(key in (s || {}))) fail(`${sat}.${key}: missing`);
    }
    if (typeof s.c !== "string" || !s.c) fail(`${sat}.c: must be a non-empty string`);
    if (typeof s.r !== "string" || !s.r) fail(`${sat}.r: must be a non-empty string`);
    if (!isPair(s.ll)) fail(`${sat}.ll: must be [lat,lng]`);
    else {
      if (s.ll[0] < -90 || s.ll[0] > 90) fail(`${sat}.ll: latitude out of range`);
      if (s.ll[1] < -180 || s.ll[1] > 180) fail(`${sat}.ll: longitude out of range`);
    }
    if (!isNum(s.n) || s.n < 0) fail(`${sat}.n: must be a number >= 0`);
    if (!isNum(s.b)) fail(`${sat}.b: must be a number`);
    if (!Array.isArray(s.pics) || !s.pics.length) fail(`${sat}.pics: must be a non-empty array`);
    if (s.t && !("tc" in (s || {}))) fail(`${sat}.tc: must be present when the stop has an onward leg`);
    if ("tc" in (s || {}) && s.tc !== null && !isNum(s.tc)) fail(`${sat}.tc: must be a number or null`);
    if ("act" in (s || {}) && typeof s.act !== "string") fail(`${sat}.act: must be a string when present`);
    if (typeof s.actVi !== "string") fail(`${sat}.actVi: must be a string (may be empty)`);
    if (s.t && !MODES?.[s.t]) fail(`${sat}.t: "${s.t}" is not in MODES`);
    if (s.tn && typeof s.tnVi !== "string") fail(`${sat}.tnVi: must be a string when tn is set`);
    if (!s.cVi && /[\u4e00-\u9fff]/.test(s.c)) fail(`${sat}.cVi: Chinese stops need a Vietnamese name`);
    for (const p of s.pics || []) if (!pictureOk(p)) fail(`${sat}.pics: cannot resolve "${p}" (not a URL, not a file under src/)`);
    if (cities.has(s.c)) fail(`${at}: duplicate city "${s.c}"`);
    cities.add(s.c);
  }

  for (const [i, t] of (j.trips || []).entries()) {
    const tat = `${at}.trips[${i}] (${t?.c ?? "?"})`;
    for (const key of TRIP_LEG_FIELDS) {
      if (!(key in (t || {}))) fail(`${tat}.${key}: missing`);
    }
    if (!isPair(t.ll)) fail(`${tat}.ll: must be [lat,lng]`);
    if (!Array.isArray(t.pics) || !t.pics.length) fail(`${tat}.pics: must be a non-empty array`);
    for (const p of t.pics || []) if (!pictureOk(p)) fail(`${tat}.pics: cannot resolve "${p}"`);
    if (cities.has(t.c)) fail(`${at}: duplicate city "${t.c}"`);
    cities.add(t.c);
    if (t.base && !(j.stops || []).some((s) => s.c === t.base)) fail(`${tat}.base: "${t.base}" is not a stop`);
    if (t.rk && !j.rail?.[t.rk]) fail(`${tat}.rk: "${t.rk}" is not a key in rail`);
    if (!MODES?.[t.t]) fail(`${tat}.t: "${t.t}" is not in MODES`);
    if (typeof t.actVi !== "string") fail(`${tat}.actVi: must be a string (may be empty)`);
    if (t.tn && typeof t.tnVi !== "string") fail(`${tat}.tnVi: must be a string when tn is set`);
    if (!t.cVi && /[\u4e00-\u9fff]/.test(t.c)) fail(`${tat}.cVi: Chinese stops need a Vietnamese name`);
  }

  for (const key of Object.keys(j.rail || {})) {
    const [a, b] = key.split(">");
    if (!a || !b) fail(`${at}.rail["${key}"]: key must be "A>B"`);
    if (!cities.has(a)) fail(`${at}.rail["${key}"]: "${a}" is not a city in this journey`);
    if (!cities.has(b)) fail(`${at}.rail["${key}"]: "${b}" is not a city in this journey`);
    if (!Array.isArray(j.rail[key]) || j.rail[key].length < 2) fail(`${at}.rail["${key}"]: needs at least two points`);
    for (const p of j.rail[key] || []) if (!isPair(p)) fail(`${at}.rail["${key}"]: every point must be [lat,lng]`);
  }

  for (const key of Object.keys(j.fallbacks || {})) {
    const [a, b] = key.split(">");
    if (!a || !b) fail(`${at}.fallbacks["${key}"]: key must be "A>B"`);
    if (!cities.has(a)) fail(`${at}.fallbacks["${key}"]: "${a}" is not a city in this journey`);
    if (!cities.has(b)) fail(`${at}.fallbacks["${key}"]: "${b}" is not a city in this journey`);
  }

  if (j.periods) {
    if (!isObj(j.periods)) fail(`${at}.periods: must be an object`);
    for (const city of Object.keys(j.periods)) {
      if (!cities.has(city)) fail(`${at}.periods["${city}"]: not a city in this journey`);
    }
    if (!isObj(j.periodsVi)) fail(`${at}.periodsVi: must be an object when periods is present`);
    else for (const city of Object.keys(j.periods)) {
      if (typeof j.periodsVi[city] !== "string" || !j.periodsVi[city]) fail(`${at}.periodsVi["${city}"]: missing Vietnamese label`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}

// Sweep: the renderer must be journey-agnostic. Journey-specific globals from
// the two original pages may not survive outside the DATA block, and the toggle
// must be generated rather than hardcoded in the markup.
const appPart = html.replace(/\/\/==DATA-START==[\s\S]*?\/\/==DATA-END==/, "");
const LEFTOVERS = ["STOPS", "TRIPS", "COL", "RAIL", "ROAD_FALLBACK", "PIC", "PERIODS", "cny", "yen", "NOTION_URL"];
const leftovers = LEFTOVERS.filter((name) => new RegExp(`(^|[^\\w$.])${name}(?![\\w$])`).test(appPart));
if (leftovers.length) {
  for (const name of leftovers) console.error(`FAIL renderer still references journey-specific global "${name}"`);
  process.exit(1);
}
if (/data-journey=/.test(html)) {
  console.error('FAIL toggle must be generated from JOURNEYS, not hardcoded (found literal data-journey= in src/index.html)');
  process.exit(1);
}

for (const id of Object.keys(JOURNEYS)) console.log(`OK ${id}`);
