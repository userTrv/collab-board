# Next steps (handoff)

State: lint, 61 unit/component tests and the production build passed before the last WIP
commit. Every feature listed in the spec is implemented and was clicked through in headless
Chrome from a sub-path (`/projects/collab-board/`, port 8941) with no console errors:
boards CRUD, import/export (JSON + Yjs), kanban DnD + keyboard moves, card dialog, cross-tab
sync, presence (avatars, cursors, "is editing"), offline toggle + merge, per-user undo,
whiteboard, history preview/restore, conflict demo, 375 px width, dark theme.

## Remaining from the task spec

1. **Service worker / PWA (WIP commit, NOT verified).** `public/sw.js`, `public/manifest.webmanifest`,
   `public/icon-*.png`, `scripts/generate-sw.mjs` (runs after `ng build` via `pnpm build`), registration in
   `src/main.ts`. The offline check (load online → `context.setOffline(true)` → reload board list,
   board, conflict demo) hung past 120 s and was never finished. Debug it: first check
   `navigator.serviceWorker.ready` resolves and `caches` holds the files (`./` entry may fail
   `cache.addAll` → install rejects). If it can't be made reliable under the sub-path, remove the
   SW + manifest + script and explain in the README why (the spec allows skipping PWA).
2. **README.md** is not written yet: pitch, live demo link `https://usertrv.dev/projects/collab-board/`,
   screenshots in `docs/` (< 500 KB each), features, mermaid architecture, tech decisions and
   trade-offs, measured numbers, run/test/build, honest limitations (see below).
3. **Screenshots for `docs/`**: not taken yet (only scratch shots). Needed: boards list, kanban with
   a second tab's presence (cursor + "is editing"), card dialog, whiteboard (dark), history preview,
   conflict demo after merge, a 375 px mobile shot.
4. **Final verification pass after the above**: `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build`,
   serve a copy of `dist/` at `<tmp>/x/projects/collab-board/` on port 8941, re-run the flows,
   check console, then stop the server.
5. **Final report** to the coordinator (summary, tree, test counts, numbers, bundle sizes,
   limitations, `git log --oneline`).

## Measured numbers so far (Apple M4, Chrome 153 headless, 1,000-card stress board)

- Initial bundle 491 kB raw / ~137 kB transfer; y-webrtc is a separate lazy chunk (109 kB raw).
- Menu click → 1,000 cards rendered: 160 ms (1× CPU), 510 ms (4× CPU throttle).
- Reload → 1,000 cards rendered from IndexedDB: 149 ms (1×), 422 ms (4×).
- 40 keyboard card moves on that board: slowest keydown → next paint 32 ms (1×) / 40 ms (4×)
  (Event Timing API); zero long animation frames (> 50 ms) incl. a drag across 200-card columns.
- Cross-tab propagation (tab A move → tab B DOM updated): median 3 ms, p90 18 ms (1×).
- Scripts used: scratchpad `perf.mjs` (not in repo); consider adding a `scripts/perf.mjs` if the
  README cites these numbers.

## Known limitations / bugs to document (or fix)

- **y-webrtc P2P not verified end-to-end.** Against a local `y-webrtc-signaling` server both
  devices reach signaling and discover each other, but in the headless test environment the
  WebRTC data channel never opened (`ERR_CONNECTION_FAILURE`), so no data synced. The toolbar chip
  now counts only open data channels, so it honestly shows "0 peers". Must be stated in README.
- History snapshots require `gc: false` on board docs → docs only grow (deleted content is kept);
  history capped at 150 entries, the doc itself is not compacted.
- Sticky-note text is a plain LWW string (not Y.Text): concurrent edits of the same note keep one
  version. Card descriptions are Y.Text and merge.
- Board title lives in the workspace index doc (not undoable); `meta.title` is a copy for exports.
- Identity is per tab (sessionStorage); a duplicated browser tab copies it, so two tabs can show
  the same name.
- Cursor positions on the kanban are content-pixel coordinates, so they are only approximate
  between windows of different widths.
- No virtual scroll: 1,000 cards stay fast via per-card signals + `content-visibility: auto`
  (CDK virtual scroll does not combine with cross-list CDK drag & drop).
