# ui

```stele
kind: system
purpose: ui — a semantic component stylesheet on custom properties, light white-and-green and dark black-and-gold; one file, no build, plus its docs, demo, glyphs and dev server.
commands:
  serve: python3 serve.py
  test: mise run test
invariants:
  - claim: ui.css is the whole library — no build step, no framework dependency, no network requests
    anchor: README.md#ui
  - claim: :root declares every token; theme blocks only reassign
    anchor: README.md#theming-contract
    enforced_by: test/contract.test.ts
  - claim: every rule sits in ui.tokens, ui.base or ui.components, declared in that order before any rule
    anchor: README.md#tailwind-compatibility
    enforced_by: test/contract.test.ts
```

## Map

| where | what |
| --- | --- |
| docs.css | the shared docs shell — container, measure, section rhythm — every gigantic.dev docs page links after ui.css; additive-only |
| index.html | GitHub Pages redirect to `docs/` (`.nojekyll` beside it) |
| package.json | one dev dependency, tailwindcss: the suite compiles README's Tailwind import; ui.css needs nothing |
| serve.py | stdlib dev server: `/` → `/docs/`, `no-store`, HTTP/1.1, threaded, `--port` › `$PORT` › 8080 |
| test/ | the contract suite |
| ui.css | the library — tokens, base (reset, type, layout), components; both pages load it as `../ui.css` |

## Working here

- The public surface is the snapshot in `test/__snapshots__/`: a class, attribute or token added or removed fails the suite until `bun test --update-snapshots` records it on purpose. The gate runs `CI=true bun test`, under which a missing snapshot fails rather than being written.
- The sprite exists four times — `icons/sprite.svg`, `icons/svg/`, and inlined in each page. Adding a glyph means all four; the suite fails on any drift.

<!-- @stele -->

## Hazards (0 active)


## Map

| node  | kind      | purpose                                                                                                                                                                                 | unfold                                           |
| ----- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| demo  | container | index.html — the kitchen sink: every component at once under fake telemetry, opens off disk; its inline script carries the shared theme toggle.                                         | `stele unfold demo` · or read `demo/AGENTS.md`   |
| docs  | container | the reference page (index.html, page.css, docs.js — its token table reads ui.css live; its open section is what is unsettled) and figures/, its Claude Design boards with their source. | `stele unfold docs` · or read `docs/AGENTS.md`   |
| icons | container | the vendored Phosphor regular subset — sprite.svg and svg/NAME.svg, MIT in LICENSE; each page inlines the sprite.                                                                       | `stele unfold icons` · or read `icons/AGENTS.md` |
| test  | container | contract.test.ts — the external contract end to end: class/token snapshot, layers and :root, docs.css shell, glyphs, figures, README's Tailwind import compiled, serve.py live.         | `stele unfold test` · or read `test/AGENTS.md`   |

## Indexes

All invariants: `.stele/index/invariants.md` · all hazards: `.stele/index/hazards.md`

## Engine

`stele` CLI available → `stele root | unfold <id> | invariants --touching <path> | hazards | nodes --kind <k>`. MCP: `stele serve`.
No engine → everything above is complete; nested AGENTS.md files carry the detail (nearest file wins).
<!-- @end -->
