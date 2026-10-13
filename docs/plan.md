# Plan

The stylesheet, its pages and its server. `AGENTS.md` carries the map and the
invariants, `README.md` the contract; this file is what is open.

## Hazards

- GitHub Pages serves the repository root (`index.html` redirects to
  `docs/`), so this file and every other one here is public
  (unverified 2026-10-13 · the Pages API is unreachable from the shift
  sandbox).
- Component order inside `ui.components` is cascade order — a later section
  wins a same-specificity tie with an earlier one. Never reorder sections to
  match a table.
- `bun test` binds loopback sockets for `serve.py`; a sandbox that denies
  loopback binds fails that test at `cannot bind`, not the code.

## Next

1. One glyph source. The sprite lives in four copies (`icons/sprite.svg`,
   `icons/svg/`, inlined in `demo/` and `docs/`), kept equal by the suite but
   edited by hand. A stdlib `icons/sprite.py` that writes the sprite and
   splices it into both pages between markers would make the svg files the
   only source.
2. One theme toggle. `demo/index.html`'s inline script and `docs/docs.js` each
   carry `applyTheme` and the `ui-theme` key. A shared `theme.js` beside
   `ui.css` loads off disk too.
3. Browser coverage. `docs/docs.js` (`resolve`, the token table, scrollspy) and
   the demo script run in no test; nothing here measures them. A headless
   probe (agent-browser) over `serve.py` would, once the shift sandbox can run
   a browser.
4. visor spawn: `visor -- ./serve.py` fails because visor resolves the child
   through `System.find_executable`, which searches `$PATH` only. The runbooks
   here now name `python3 serve.py`; visor resolving a path-qualified command
   as a path would fix it for every repo.
5. Stale claims the s-20261013T0312Z review found, older than it — each needs
   its owner's word on the fix, not only the words:
   - Tailwind (README § Tailwind compatibility, § Why not Preflight): v4
     declares `@layer theme, base, components, utilities` after `ui.*`, and
     Preflight lives in `base`, so Preflight beats `ui.components` — `.btn`,
     `.input`, `.card` lose padding and borders. "Preflight wins wherever they
     overlap and nothing fights" is false; disabling Preflight is required,
     or ui.css imports into a layer after `base`.
   - visor's anchors (docs § Wrapping, README § Wrapping): visor's stable
     attributes are `data-testid`, `data-component`, `aria-label`, and an
     `id` ends the walk, so it never reads `data-example`; its fallback is
     `:nth-of-type`, not `:nth-child`.
   - `visor 8080` serves the rail on visor's own port (9000 attach, 3000
     spawn), not 8080; no runbook names it.
   - Sage "28% saturation" is HSV; its HSL saturation is 16%, while brass
     and warn are quoted in HSL.
   - "Omit `.ui` and only the components style themselves": the type scale
     and layout helpers in `ui.base` are unscoped and apply without it.
