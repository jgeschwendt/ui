# Plan

The stylesheet, its pages and its server. `AGENTS.md` carries the map and the
invariants, `README.md` the contract; this file is what is open.

## Hazards

- `docs/` is the published site: GitHub Pages serves this file beside the
  reference page.
- Component order inside `ui.components` is cascade order — a later section
  wins a same-specificity tie with an earlier one. Never reorder sections to
  match a table.
- `bun test` binds loopback sockets for `serve.py`; in a shift sandbox run it
  through `shift-test`, alone in its call.

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
