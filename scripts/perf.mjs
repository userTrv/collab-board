// Performance measurements for the README (1,000-card stress board, production build).
//
//   pnpm build && pnpm perf
//
// Serves dist/ from a sub-path on a free local port, drives headless Chromium via playwright-core
// and prints a JSON summary. Chromium is not downloaded by this repo: point CHROME_PATH at any
// Chromium/Chrome binary (default: the one Playwright installs, or /opt/pw-browsers/chromium).
//   CPU=4 pnpm perf   → also applies a 4× CPU throttle (DevTools emulation) to every page.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = new URL('../dist/', import.meta.url).pathname;
const PREFIX = '/projects/collab-board/';
const CPU = Number(process.env.CPU ?? 1);
const MOVES = 40;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/index.html missing — run `pnpm build` first');
const hardStop = setTimeout(() => {
  console.error('perf: timed out');
  process.exit(2);
}, 180_000);

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(PREFIX)) return res.writeHead(404).end();
  let file = normalize(join(DIST, path.slice(PREFIX.length) || 'index.html'));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}${PREFIX}`;

const executablePath = process.env.CHROME_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });

async function open(url) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  if (CPU > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
  if (url) await page.goto(url);
  return page;
}

/** Resolves (in page time) once ≥ n cards are in the DOM and a frame has been produced. */
const waitForCards = (n) =>
  new Promise((resolve) => {
    const done = () => requestAnimationFrame(() => setTimeout(() => resolve(performance.now())));
    if (document.querySelectorAll('app-card-tile').length >= n) return done();
    const mo = new MutationObserver(() => {
      if (document.querySelectorAll('app-card-tile').length >= n) {
        mo.disconnect();
        done();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p90 = (xs) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.9))];
const round = (x) => Math.round(x);

// 1. Menu click → 1,000 cards rendered (generate board, persist to IndexedDB, navigate, render).
const a = await open(BASE);
await a.getByRole('button', { name: 'More board options' }).click();
const item = a.getByRole('menuitem', { name: /1,000-card stress board/ });
await item.waitFor();
const armed = a.evaluate(`(${waitForCards})(1000)`);
const clickAt = await a.evaluate(() => performance.now());
await item.click();
const createToRender = (await armed) - clickAt;
const boardUrl = a.url();

// 2. Reload → 1,000 cards rendered from IndexedDB (time since navigation start).
await a.reload();
const reloadToRender = await a.evaluate(`(${waitForCards})(1000)`);

// 3. Keyboard moves: Event Timing API (keydown → next paint) + Long Animation Frames.
await a.evaluate(() => {
  window.__events = [];
  window.__loafs = [];
  new PerformanceObserver((l) => window.__events.push(...l.getEntries().filter((e) => e.name === 'keydown').map((e) => e.duration))).observe({ type: 'event', durationThreshold: 16, buffered: false });
  new PerformanceObserver((l) => window.__loafs.push(...l.getEntries().map((e) => e.duration))).observe({ type: 'long-animation-frame', buffered: false });
});
await a.locator('app-card-tile').nth(3).focus();
for (let i = 0; i < MOVES; i++) {
  await a.keyboard.press(i % 4 < 2 ? 'Alt+ArrowRight' : 'Alt+ArrowLeft');
  await a.waitForTimeout(60);
}
await a.waitForTimeout(300);
const { events, loafs } = await a.evaluate(() => ({ events: window.__events, loafs: window.__loafs }));

// 4. Cross-tab propagation: tab A moves a card → tab B's DOM reflects it (BroadcastChannel + Yjs + render).
const b = await open(boardUrl);
await b.evaluate(`(${waitForCards})(1000)`);
await a.bringToFront();
const now = () => performance.timeOrigin + performance.now();
const deltas = [];
for (let i = 0; i < 20; i++) {
  const seen = b.evaluate(
    () =>
      new Promise((resolve) => {
        const mo = new MutationObserver(() => {
          mo.disconnect();
          resolve(performance.timeOrigin + performance.now());
        });
        mo.observe(document.querySelector('.lanes'), { childList: true, subtree: true });
      }),
  );
  await b.waitForTimeout(20);
  await a.evaluate(`window.__t = (${now})()`);
  await a.keyboard.press(i % 2 ? 'Alt+ArrowLeft' : 'Alt+ArrowRight');
  const sentAt = await a.evaluate(() => window.__t);
  deltas.push((await seen) - sentAt);
  await a.waitForTimeout(80);
}

const result = {
  environment: { chromium: browser.version(), cpuThrottle: `${CPU}×`, platform: `${process.platform} ${process.arch}` },
  menuClickTo1000CardsMs: round(createToRender),
  reloadTo1000CardsMs: round(reloadToRender),
  keyboardMoves: { count: MOVES, slowestKeydownToPaintMs: events.length ? round(Math.max(...events)) : '< 16 (none above threshold)', longAnimationFramesOver50ms: loafs.filter((d) => d > 50).length },
  crossTabMs: { median: round(median(deltas)), p90: round(p90(deltas)), samples: deltas.length },
};
console.log(JSON.stringify(result, null, 2));

await browser.close();
server.close();
clearTimeout(hardStop);
