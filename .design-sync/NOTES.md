# design-sync notes — laxstats

- **App repo, not a packaged library.** No dist/ barrel; the bundle builds from the hand-curated entry at `.design-sync/entry.mjs` (`cfg.entry`). Keep that file in step with `componentSrcMap` when adding/removing components.
- **Supabase is radioactive at module init**: `src/lib/supabase.js` calls `createClient(import.meta.env…)` at import time, which throws outside the Vite app. `SharePanel` and the `LaxStats` scorekeeper are excluded for this reason. During the first sync, `GameTimeline`/`GameLiveStream` imported `qLabel` via `./LaxStats` (a re-export) and dragged supabase in — fixed in source by importing from `../utils/stats` directly (behavior-identical; `utils/stats.js` is the definition site).
- **All styling is inline-JS tokens** (`src/styles/tokens.js`: `C`/`F`/`SH`). Fonts are system stacks (no webfonts). `src/index.css` is app chrome (`#root` width, template colors) and must NOT ship wholesale — but its sans-serif font baseline is load-bearing: components inherit it, and without it text with no explicit inline `fontFamily` renders serif (user caught this in review). The extracted baseline lives in `.design-sync/base.css`, wired via `cfg.cssEntry`; the build copies it into `_ds_bundle.css` inside the `styles.css` closure. If the app's base font changes in `index.css`, mirror it there.
- **Render check ran via system Chrome**: no playwright browser cache on this machine; playwright npm pkg installed in `.ds-sync/` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and validate/capture run with `DS_CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and `NODE_PATH=.ds-sync/node_modules`.
- **Fixtures**: `.design-sync/previews/_fixtures.tsx` holds one full game (NDP 8–6 Malvern) as a raw event log; derived props go through the repo's real `buildPlayerStats`/`buildScoringTimeline` via relative imports, so builder changes propagate into previews on rebuild.
- **HeroCard renders `position:fixed` overlay** — its preview wraps it in a 480×524 `transform: translateZ(0)` container (containing-block trick, sized to hug the 440px card per user review) and the component has `cardMode: single, viewport 540x590` in `cfg.overrides`. Don't remove either half.
- **HeroCard footer icon** (`/LaxStatsIcon.png`) is an app-served `public/` asset that 404s outside the Vite app. Source now has an `onError` hide guard (behavior-identical in the app); for local review the build step copies `public/LaxStatsIcon.png` into `ds-bundle/` (`cp` after every rebuild — it gets wiped) so the icon actually shows. In uploaded designs the icon hides gracefully.
- **Viewport overrides** exist for PlayerStatsTable (1000x1500) and ShotMap (800x950) purely so the capture (viewport-clipped, not fullPage) shows the whole component.

## Known render warns

- `[CSS_RUNTIME]` ×2 (styles.css no @imports; _ds_bundle.css stub) — inline-style DS, expected.
- `(stale preview: _fixtures — component no longer exported)` in the build log — `_fixtures.tsx` is a shared data module, not a component preview; the warn is cosmetic.

## Re-sync risks

- `entry.mjs` and `componentSrcMap` are parallel lists — a component added to one but not the other either drops from the bundle or fails discovery. Check both.
- Fixture realism is pinned to the current event-log schema (`groupId` pairing of shot+goal, `teamStat` on timeouts, `zone` codes L1–R2). A schema change in the scorekeeper silently ages the fixtures; previews still render but may misrepresent derived stats.
- The two import-path fixes in `GameTimeline.jsx`/`GameLiveStream.jsx` (qLabel from `../utils/stats`) must stay — reverting them re-breaks the bundle at module init.
- Chromium path is machine-specific (system Chrome). On another machine, install playwright chromium or adjust `DS_CHROMIUM_PATH`.
- `PLAYER_STAT_KEYS` is exported from the entry for `PlayerStatsTable.statKeys`; if the component's column list moves, update the entry export.
