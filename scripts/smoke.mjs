// Smoke tests for src/index.html, driven by headless Edge over the DevTools
// protocol. No npm dependencies: run `node scripts/smoke.mjs`.
//
// Requires Microsoft Edge (Chromium) and network access for the Leaflet CDN.
// Override the browser with TRIPMAPS_EDGE=/path/to/chrome-or-edge.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, extname, join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "src");
const EDGE_CANDIDATES = [
  process.env.TRIPMAPS_EDGE,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

export const results = [];
export const assert = (cond, label) => {
  results.push({ ok: !!cond, label });
  console.log(`${cond ? "PASS" : "FAIL"} ${label}`);
  if (!cond) process.exitCode = 1;
};

function browserPath() {
  const found = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("No Edge/Chromium found. Set TRIPMAPS_EDGE.");
  return found;
}

async function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = decodeURIComponent(url.pathname) === "/" ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    const file = resolve(SRC, rel);
    if (!file.startsWith(SRC) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, port: server.address().port };
}

async function withBrowser(fn) {
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const profile = mkdtempSync(join(tmpdir(), "tripmaps-edge-"));
  const debugPort = 9300 + Math.floor(Math.random() * 400);
  const child = spawn(browserPath(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,900",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ws;
  for (let i = 0; i < 80 && !ws; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const target = list.find((t) => t.type === "page");
      if (target) {
        ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      }
    } catch { /* browser not up yet */ }
    if (!ws) await sleep(250);
  }
  if (!ws) {
    child.kill();
    server.close();
    throw new Error("headless browser did not expose a DevTools target");
  }

  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.exceptionThrown") {
      exceptions.push(msg.params?.exceptionDetails?.text || "exception");
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

  await send("Page.enable");
  await send("Runtime.enable");

  const api = {
    base,
    exceptions,
    async navigate(path) {
      exceptions.length = 0;
      await send("Page.navigate", { url: `${base}${path}` });
      await this.waitFor("document.readyState === 'complete'", 15000);
    },
    async evalJs(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(`eval failed: ${expression}`);
      return r.result?.result?.value;
    },
    async click(selector) {
      return this.evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
    },
    async hover(selector) {
      return this.evalJs(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true})); return true; })()`);
    },
    async waitFor(expression, timeoutMs = 5000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        try {
          if (await this.evalJs(expression)) return true;
        } catch { /* page mid-navigation */ }
        await sleep(100);
      }
      return false;
    },
    async addInitScript(source) {
      await send("Page.addScriptToEvaluateOnNewDocument", { source });
    },
    async clearInitScripts() {
      // Detach and re-attach the page so init scripts stop applying.
      await send("Page.navigate", { url: "about:blank" });
    },
    sleep,
  };

  try {
    await fn(api);
  } finally {
    try { ws.close(); } catch { /* already closed */ }
    child.kill();
    server.close();
  }
}

async function main() {
  await withBrowser(async (b) => {
    // Checks are added task by task.
    void b;
  });
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nsmoke: ${passed}/${results.length} checks passed`);
  if (!results.length) console.log("smoke: no checks yet");
}

main().catch((e) => {
  console.error(`smoke: harness error: ${e.message}`);
  process.exit(1);
});
