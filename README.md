# ui

A semantic component stylesheet in the spirit of DaisyUI, but pure CSS on custom
properties. No build step, no framework dependency, no network requests.

Light is **white and green**. Dark is **black and gold**. Both are first-class.

```html
<html class="ui">
  <link rel="stylesheet" href="/ui.css" />
```

`.ui` is the opt-in base layer: page background, ink, font stack,
`box-sizing`, focus ring. Omit it and only the components style
themselves — safe for dropping the library into a page that already has
opinions.

One base rule is *not* scoped to `.ui`, because it has to hold everywhere:

```css
:where([hidden]:not([hidden="until-found"])) { display: none !important; }
```

Components set `display` (`.pill` is `inline-flex`, `.panel` is `flex`,
`.strip` is `flex`), and a component class beats the UA's `[hidden]` rule — so
without this guard `el.hidden = true` silently does nothing. Zero specificity via
`:where`, and the `!important` inverts layer order so `ui.base` outranks
`ui.components`. Set the attribute and the element goes; no utility class, no
inline style.

**On `<html>`, `<body>` stays transparent.** CSS propagates the root element's
background to the canvas, which paints the viewport correctly but leaves the
computed background of *both* `html` and `body` at `rgba(0, 0, 0, 0)`. Anything
that reads or inherits `body`'s background — a nested scroll container, an
embedded widget, a screenshot tool, `background: inherit` — sees nothing. Put
`.ui` on `<body>` instead, or set `body { background: var(--ui-bg); }`
alongside it.

## The reset

`.ui` carries a small modern reset — the Andy Bell / Josh Comeau line, adapted.
It corrects the UA where the UA is wrong for a layout engine, and stops.

| rule | why |
| --- | --- |
| `margin: 0` on `blockquote`, `body`, `dd`, `dl`, `figure`, `h1`–`h6`, `p`, `pre` | UA margins are vertical rhythm from a document engine; here spacing belongs to `.stack`, `.row`, `[data-grid]` and the components' own padding |
| `list-style: none; padding-left: 0` on `ol[role="list"]`, `ul[role="list"]` | lists opt **out** by saying so |
| `display: block; max-width: 100%` on `canvas`, `img`, `picture`, `svg`, `video` | replaced elements are boxes, not letters — no baseline gap, no overflow |
| `font: inherit` on `button`, `input`, `select`, `textarea` | controls opt out of inheritance for historical reasons only |
| `cursor: pointer` on `button` | |
| `overflow-wrap: break-word` on `h1`–`h6`, `p` | a URL or a device id must not widen the page |
| `prefers-reduced-motion: reduce` → near-zero animation and transition durations, `scroll-behavior: auto` | the preference is a request to stop moving, not to stop three named animations. Near-zero rather than `none`, so `transitionend` still fires and code awaiting one does not hang |

Every rule is wrapped in `:where(.ui …)`, so it carries **specificity zero**:
components override it by living in a later layer, and a consumer overrides it
with any selector at all. Two consequences worth knowing:

- **A component must own its own leading if it sizes off it.** `font: inherit`
  hands a control the body's `line-height`, not the UA's `normal` — which is why
  `.btn`, `.segmented > button`, `.input`, `.select` and `.textarea` each declare
  a `line-height`. A new control that does not will be about four pixels taller
  than its neighbours.
- **A percentage `max-width` contributes nothing to a flex parent's max-content
  width.** An inline sparkline `<canvas>` with a fixed pixel width inside a
  content-sized flex row needs `max-width: none` back, or the row sizes short.

### Why not Preflight

Tailwind's Preflight is a *global* reset for a utility-first world where every
element is expected to be dressed by classes. This library is semantic and
opt-in, and three things follow:

- **Scoped, not global.** Nothing here applies without `.ui` on an ancestor.
  Drop the class and the page gets the UA back whole — which is the same promise
  the rest of the base layer makes.
- **Semantic elements keep their meaning.** Preflight unstyles `<ul>`, `<ol>`,
  `<h1>` and `<button>` down to nothing. A bare `<ul>` here keeps its indent and
  its bullets, a bare `<button>` still looks like a button, and headings keep
  their size — a semantic library whose bare markup lies is worse than no
  library. Removing list markers is a decision the markup makes with
  `role="list"`.
- **No double reset.** Loading `ui.css` next to Tailwind gives you Preflight
  *and* this, and the two disagree about `<ul>` and `<button>`. Imported into
  Tailwind's `components` layer, every `ui` layer sorts after Preflight's
  `base`, so the components keep their padding, margins and borders while
  Preflight still governs bare markup outside `.ui`. If you own the Tailwind
  config, disabling Preflight leaves the scoped reset as the only one. See
  [Tailwind compatibility](#tailwind-compatibility).

## Theming contract

Three ways dark arrives, in cascade order:

| Selector | Wins over |
| --- | --- |
| `:root` | — (light is the ground truth; every token is defined here) |
| `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` | the system default |
| `:root[data-theme="dark"]` | a light system |
| `:root[data-theme="light"]` | a dark system |

So a manual toggle wins in **both** directions, and removing `data-theme`
returns the page to the system. That is the whole contract:

```js
// explicit
document.documentElement.dataset.theme = "dark";
// back to the system
document.documentElement.removeAttribute("data-theme");
```

`color-scheme` is set alongside, so native form controls, scrollbars and
`Highlight` follow.

**Never define a color only inside a media or `[data-theme]` block.** Those
blocks reassign; `:root` declares. A token that exists only in the dark block is
undefined for a light viewer.

### Retheming

Override tokens, not rules. Anything under `--ui-accent*` retints the whole
library:

```css
:root { --ui-accent: #7c3aed; --ui-accent-soft: #f1eafe; --ui-accent-soft-fg: #5b21b6; }
```

Per-component escape hatches (set inline or in a wrapper rule):

| Property | Read by |
| --- | --- |
| `--ui-container` | `[data-container]` max width (default 100rem) |
| `--ui-grid-min` | `[data-grid]` column floor (default 280px) |
| `--ui-icon-size` | `.icon` (default 1.15em) |
| `--ui-meter-value` | `.meter` fill, a percentage |
| `--ui-orb-size` | `.orb` (default 34px) |
| `--ui-panel-accent` | `.panel` head rail and channel name |

### Bring your own hues, in our shape

The library ships five semantic hues — accent, ok, warn, danger, info — and that
is the whole vocabulary on purpose. A page that plots eight channels, or colours
nine speakers, needs more hues than the library has opinions about, and stretching
the semantic five to cover them destroys them: once `--ui-danger` means "series 4",
nothing on the page can mean *danger* any more.

So declare your own hue tokens under your own prefix, and feed them to the `--ui-*`
hooks:

```css
:root {
  --plot-ears: #4f7fb8;
  --plot-mouth: #8a6ab0;
  --plot-wire: #b08a4f;
}

.channel-ears { --ui-panel-accent: var(--plot-ears); }
.channel-mouth { --ui-panel-accent: var(--plot-mouth); }
```

Yours are the hues, ours is the shape. Two rules keep it honest: never redefine a
`--ui-*` token to mean something non-semantic, and check your hues against
`--ui-bg` in *both* themes — the library's contrast measurements say nothing about
colours it has never seen.

### Palette

| Role | Light | Dark |
| --- | --- | --- |
| bg | `#ffffff` | `#08090a` |
| surface | `#fbfcfa` | `#101113` |
| sunken | `#f2f4f0` | `#0c0d0f` |
| border | `#e2e6df` | `#24262a` |
| border-strong | `#c8d0c5` | `#3a3d43` |
| fg | `#141c15` | `#ece7db` |
| fg-muted | `#5a6b5b` | `#9b9487` |
| fg-faint | `#879287` | `#6b675e` |
| accent | `#476349` | `#cfa14d` |
| accent-hover | `#3b5340` | `#ddb56b` |
| accent-active | `#2f4333` | `#b88b3d` |
| accent-soft | `#eaefe9` | `rgba(207, 161, 77, 0.14)` |
| ok | `#476349` | `#8fae94` |
| warn | `#c86a17` | `#f5893a` |
| warn-ink | `#9c500f` | `#f5893a` |
| danger | `#b4262a` | `#f0655c` |
| info | `#1d5fa8` | `#6aa8f0` |

Two voices, one per theme. **Sage** carries light mode: grey-leaning and
dried-herb, hue 124 at 28% saturation, nothing like emerald. `#476349` is the
accent and `--ui-ok` both; `#eaefe9` is its tint. The light neutrals carry the
same faint sage cast, a hair warmer and greyer than before, so the surfaces sit
underneath the accent instead of arguing with it.

**Brass** carries dark mode, taken from the orrery atlas: `#cfa14d`. It is the
accent and nothing else. Warn used to be brass too — gold was that theme's whole
voice and a warning read as emphasis — but a warning that is indistinguishable
from the accent cannot warn, so warn moved to **orange**: `#f5893a` in dark,
`#c86a17` in light. Hue 25–28 against brass's 39, at 90% saturation against
brass's 58, and far enough from danger's red (hue 4 dark, 358 light) to stay its
own signal. Dark `--ui-ok` is the sage lifted to `#8fae94` and luminance-matched
to brass (8.2 vs 8.4 on `--ui-bg`), so the green and the gold never fight for
the eye.

Measured: sage on white 6.7:1, on its own tint 5.7:1, white-on-sage 6.7:1; brass
on `--ui-bg` 8.4:1, `#ddb56b` (hover, and the ink for soft-tinted pills) 10.3:1,
ink-on-brass 8.0:1. Every accent pairing clears AA.

Light-mode `#c86a17` reads 3.8:1 on white (3.4:1 on its tint, 3.7:1 on
`--ui-surface`, 3.4:1 on `--ui-sunken`) — sound for borders, dots and meter
fills, under AA for small text. That is what `--ui-warn-ink` is for: `#9c500f`,
the same orange darkened, at **5.9:1 on white** and **5.3:1 on
`--ui-warn-soft`** (5.7:1 on `--ui-surface`, 5.3:1 on `--ui-sunken`). Every
light-mode warn *text* colour — `.pill-warn`, `.badge-warn`, `.chip-warn b`,
`.strip-warn`, and `.is-warned`'s row name — is drawn in the ink, while
backgrounds, borders and fills keep `--ui-warn`. In dark mode the ink aliases
straight back to warn: `#f5893a` is 8.1:1 on `--ui-bg`, 7.7:1 on
`--ui-surface`, and 6.8:1 on its own tint, so one value carries fill and
sentence both. A light-mode warn can carry a sentence, and the standing
contrast exception stays closed.

## Classes

State is expressed as `.is-*` (`.is-active`, `.is-busy`, `.is-collapsed`,
`.is-current`, `.is-down`, `.is-muted`, `.is-on`, `.is-paused`, `.is-warned`) or
as an ARIA attribute where one exists
(`[aria-pressed]`, `[aria-current]`, `[aria-invalid]`, `:disabled`) — never both
for the same fact.

| Component | Classes |
| --- | --- |
| appbar | `.appbar`, `.appbar-title`, `.appbar-nav` |
| badge | `.badge` + `-accent -danger -info -ok -warn` |
| button | `.btn` + `-primary -danger -ghost -quiet`, `.btn-outline` (+ `-accent -info`), `-sm -lg -icon`, `.btn-group` |
| card | `.card`, `-head -body -foot`, `.card-hoverable` |
| chip | `.chip` (+ `-danger -ok -warn`), `.chip-value`, `.chip-row` |
| code | `.code`, `.kbd` |
| empty state | `.empty` |
| form | `.field`, `.label`, `.hint`, `.input` (+ `-invalid -lg -mono -num -sm`), `.select` (+ `-sm`), `.textarea` |
| icon | `.icon`, `-sm -lg` |
| layout | `[data-container]`, `[data-grid]`, `.row`, `.stack`, `.spacer`, `.hr` |
| list | `.list`, `.listrow`, `-name -meta -actions` + `.is-current .is-busy .is-warned` |
| meter | `.meter` (+ `-danger -warn`) with one child `<span>` |
| metric | `.metric`, `-value -label`, `.metric-delta-up/-down` |
| notice | `.notice` + `-danger -info -ok -warn` |
| orb | `.orb`, `.orb-ring`, `.orb-slash` |
| panel | `.panel`, `-head -name -sub -body`, `.panel-wide` |
| pill | `.pill` + `-accent -danger -info -ok -warn` |
| readout | `.readout`, `.readout-key`, `.readout-t` |
| status dot | `.dot` + `-danger -info -ok -warn`, `.dot-pulse` |
| strip | `.strip` + `-accent -danger -info -ok -warn`, `.strip-tag`, `.strip-msg` |
| table | `[data-table]`, `.table-hover`, `-mono -num -wrap` |
| toggle | `.toggle` (wraps a checkbox), `.toggle-label`, `.segmented` |
| tooltip | `.tip` + `data-ui-tip="…"` |
| transcript | `.transcript`, `-turn -who -text`, `-turn-self -turn-agent`, `.word-stable/-tentative/-ghost` |
| type | `.h1 .h2 .h3`, `.eyebrow`, `.lead`, `.muted`, `.faint`, `.mono`, `.link` |

The component names are the documentation; everything else is discoverable by
reading `ui.css`: layout and type sit in its base layer, every other family in
its components layer under a `/* ── name ── */` banner — related families share
one (chip with the status dot; code, kbd and metric with the readout).

### Layout primitives are attributes

Three of the names above — `grid`, `container`, `table` — are names Tailwind
also claims as utilities. They are carried as **data attributes** rather than
classes:

| Was | Is |
| --- | --- |
| `.container` | `[data-container]` |
| `.grid` | `[data-grid]` |
| `.table` | `[data-table]` |

```html
<main data-container>
  <div data-grid style="--ui-grid-min: 340px">…</div>
  <table data-table class="table-hover">…</table>
</main>
```

Tailwind never emits an attribute selector, so the collision is impossible by
construction rather than by convention. The names survive, specificity is
unchanged (`0,1,0` either way), and the `--ui-container` / `--ui-grid-min`
hooks keep working. The rule: **a layout primitive Tailwind also claims is an
attribute; a component is a class.** Everything else in the table above stays a
class, including the table modifiers (`.table-hover`, `.table-mono`,
`.table-num`, `.table-wrap`), which Tailwind does not claim.

### Import order

Import `tailwindcss` first, then `ui.css` **into its `components` layer**:

```css
@import "tailwindcss";
@import "./ui.css" layer(components);
```

Tailwind v4 declares `@layer theme, base, components, utilities`, and `ui.*`
nests as `components.ui.*`: after Preflight in `base`, before `utilities`. So a
`.btn` keeps its padding against Preflight's `button` reset, and a utility wins
any residual tie — a `p-0` next to a `.card` removes the padding, no
`!important` needed. Imported bare before Tailwind, `ui.*` declares first and
sorts below `base`, and Preflight strips every component.

### Strip vs notice

`.strip` is chrome: full-bleed, one line, small mono, and it belongs directly
under `.appbar` as a sibling — outside `[data-container]`, so it spans the
viewport. `.notice` is content: boxed, rounded, wraps, and lives inside a
layout. Reaching for a notice as a status bar is the usual mistake.

`.strip` does not survive `el.className = "strip-warn"` — wholesale
assignment drops `.strip` itself, and the mood modifier alone styles nothing,
so the bar collapses to unstyled text. Toggle the mood class instead:

```js
strip.classList.remove("strip-ok", "strip-warn");
strip.classList.add("strip-danger");
```

### Listrow

`.listrow` is sized for the inside of a panel. Use a `<button>` (or set
`role="option"` with `aria-selected`) so the row is reachable by keyboard; the
left rail carries selection, so a current row never changes size. Actions are
hidden at rest and revealed on hover, focus, focus-within and `.is-current`,
which keeps a long list from reading as a wall of buttons.

```html
<button class="listrow is-current" type="button">
  <span class="listrow-name">af_heart</span>
  <span class="listrow-meta"><span class="badge badge-ok">resident</span>en-US</span>
  <span class="listrow-actions">…</span>
</button>
```

`.is-current` fills the row and promotes `.listrow-meta` from faint to muted
ink, because faint loses AA against a tint. `.is-warned` deliberately does *not*
fill: two tints in one list read as one muddled emphasis, so selection owns the
tint and a warning is carried by its rail and name alone. (The split was forced
when warn and accent were the same brass in dark; warn is orange now and the
split is kept because it was right on its own terms.) `.is-busy`
pulses, and stops pulsing under `prefers-reduced-motion`.

### Inputs are floored at 16px on iOS

Safari on iOS zooms the viewport in whenever it focuses a form control computing
under 16px, and it does not zoom back out — one tap on a toolbar filter leaves
the page magnified. The compact scale is entirely under that line: with `.ui` on
the root the rem tokens resolve against `--ui-text-md`, so the controls measure
10.5px (`-sm`), 11.375px (`.input`, `.select`, `.textarea`) and 14px
(`.input-lg`). So `ui.css` carries an iOS-only floor:

```css
@supports (-webkit-touch-callout: none) {
  .input, .input-lg, .input-sm, .select, .select-sm, .textarea { font-size: 16px; }
}
```

`-webkit-touch-callout` is WebKit-on-iOS and nothing else, which is the point:
the compact scale is untouched everywhere the zoom cannot happen. The two usual
fixes are worse — `maximum-scale=1` in the viewport meta buys it by taking
pinch-zoom away from everyone, and a blanket 16px inflates every toolbar on
desktop. The `-sm` widths are `ch`-based, so they grow with the text on iOS
instead of clipping it. A new control with its own font-size belongs in that
block too.

## Tailwind compatibility

`ui.css` declares `@layer ui.tokens, ui.base, ui.components` and puts every rule
inside one of them. Under Tailwind v4, import it into the `components` layer so
it lands between Preflight and the utilities — `class="btn px-6"` works with no
`!important` and no arbitrary specificity war (see [Import order](#import-order)):

```css
@import "tailwindcss";
@import "./ui.css" layer(components);
```

Tailwind v3 leaves Preflight and the utilities unlayered, and unlayered rules
beat every layer: there, disable Preflight (`corePlugins: { preflight: false }`).

The components use no Tailwind-reserved class prefix, so there is nothing to
purge or safelist. Point Tailwind's theme at the same tokens if you want the
utilities to share the palette:

```css
@theme inline { --color-accent: var(--ui-accent); --color-fg: var(--ui-fg); }
```

## Icons

[Phosphor Icons](https://phosphoricons.com), regular weight, MIT © 2023 Phosphor
Icons — full text in `icons/LICENSE`. A 28-glyph subset is vendored; nothing is
fetched at runtime.

- `icons/sprite.svg` — every glyph as `<symbol id="ph-NAME" viewBox="0 0 256 256">`
- `icons/svg/NAME.svg` — the same glyphs standalone

Inline the sprite once per document (an external `<use href="file.svg#id">`
does not resolve over `file://`, and costs a request over HTTP):

```html
<body>
  <!-- paste icons/sprite.svg here -->
  <svg class="icon" aria-hidden="true"><use href="#ph-microphone"></use></svg>
```

Glyphs inherit `currentColor` and size from `--ui-icon-size`. To add one, drop
its file into `icons/svg/` from `@phosphor-icons/core@2.x/assets/regular/` and
append a matching `<symbol>` to the sprite.

## Non-goals

These stay consumer-local. Each one is a *chart*, not a component: it needs a
time base, a data range, or a pointer model that only the page owning the data
can supply, and a version parameterised enough to be general is worse than
twenty lines written against the actual numbers.

- **Time rulers** — tick density is a function of the visible span.
- **Scrub timelines** — playhead, seek and drag belong to a media element.
- **Event-lane rows** — lane assignment is a layout of the data, not of the DOM.
- **Pointer-following tooltips** — `.tip` is a static hint on a static anchor;
  a crosshair that tracks the cursor and reads the nearest datum is plotting code.
- **Fixed-height plot rows** — the height is chosen against the value range.

Build them on top: `.panel` for the frame, `.readout` for the values,
`--ui-panel-accent` and your own hue tokens for the colour.

## The docs shell

`docs.css` sits beside `ui.css`: the layout shell every project docs page under
gigantic.dev shares — container, prose measure, section rhythm, and the furniture
those pages all carry (`.docs-shell`, `.docs-lead`, `.docs-flavor`, `.docs-note`,
`.docs-toc`, `.docs-section`, `.docs-foot`, `pre.snippet` / `pre.tree`,
`.snippet-note`, `ul.claims`, `ol.steps`, `figure.figure` with `.figure-light` / `.figure-dark`). Consumers link both from the CDN, then
their own `page.css` for what is truly theirs:

```html
<link rel="stylesheet" href="https://gigantic.dev/ui/ui.css" />
<link rel="stylesheet" href="https://gigantic.dev/ui/docs.css" />
<link rel="stylesheet" href="page.css" />
```

Its tokens join `ui.tokens` — `--ui-measure` (52rem, the one prose measure) and
`--ui-measure-wide` (60rem, lists and steps) — and its rules sit in `ui.docs`, a
layer after `ui.components`, so a page's unlayered rules override any of it. The
breakpoints are constants stated once in its header comment, because a media
query cannot read a custom property: **900px** (the gigantic.dev rail docks and
offsets the page by 224px; below it, a 48px strip) and **640px** (phone).

A figure is a board from the project's Claude Design canvas (`<project>
figures`), rendered to `docs/figures/<name>.png` at 2× with its source read back
into `docs/figures/project/`. `figure.figure` frames it — `ui-bg` behind the
image, a `ui-border` hairline, `ui-radius-lg` corners — and sets the caption in
`ui-fg-faint` at the prose measure. Each board renders twice, `<name>.png` and
`<name>-dark.png` — the dark one derived at export by swapping every gigantic
colour token's light value for its dark one, never drawn twice — and the figure
carries both: `.figure-light` shows by default, `.figure-dark` wherever ui.css
resolves Brass (`prefers-color-scheme: dark` unless `data-theme="light"`, or
`data-theme="dark"`). The caption names its source:

```html
<figure class="figure">
  <img class="figure-light" src="figures/<name>.png" alt="…" />
  <img class="figure-dark" src="figures/<name>-dark.png" alt="" aria-hidden="true" loading="lazy" />
  <figcaption>… Source: Claude Design canvas <a href="<canvas url>"><project> figures</a>, board <name>.</figcaption>
</figure>
```

Consumers link latest, so every change to `ui.css` or `docs.css` is **additive**
or ships together with the consumer updates it needs — a renamed class or a
removed token breaks every docs page at once.

## Two pages, and a server

`docs/index.html` is the **reference**: one section per component family, each
with live examples, the markup that produced them, the class table and the token
contract. `demo/index.html` is the **kitchen sink** — every component at once,
under load, with a little fake telemetry moving. Neither replaces the other: the
sink is for seeing whether the library holds together, the reference for looking
one thing up.

Both make zero network requests beyond their own files, and both carry the same
three-way theme toggle (`sun` / `circle-half` / `moon`) writing the same
`localStorage` key — a theme chosen on one is the theme the other opens in.

```sh
./serve.py            # http://127.0.0.1:8080/docs/ (and /demo/)
./serve.py --port 4321
```

`serve.py` is Python's standard-library `http.server` and nothing else: no
install, no dependency, no build. It threads its handler, speaks HTTP/1.1, sends
`Cache-Control: no-store` so an edit to `ui.css` shows on reload, and redirects
`/` to the docs.

The demo still opens straight off disk. The docs page does not, quite — its token
reference fetches `ui.css`, which `file://` refuses, so that table renders empty —
and neither page can be *wrapped* off disk, which is the real reason the server
exists.

### Wrapping (visor)

**visor** is a local reverse proxy you
develop a web app *through*: it puts a rail beside the page, and lets a comment
thread be anchored to any element on it. Either form works:

```sh
./serve.py & visor 8080    # attach: visor proxies the running server
visor -- python3 serve.py  # spawn: visor owns the port, the child gets $PORT
```

Spawn names the interpreter because visor resolves the command through `$PATH`
only, so `./serve.py` is not found.

visor asks the wrapped app for almost nothing — it forwards every request that
is not its own `/__visor/*` route, and splices its script tags in before
`</head>`. What it *needs* is a page whose elements can be named: its threads
grow a CSS selector one ancestor at a time, preferring `id` → `data-testid` →
`data-component` → `aria-label` → stable classes → position. A page of hashed
class names gives it nothing but position, and a thread anchored to
`div:nth-child(7) > div:nth-child(2)` dies at the next edit.

So the docs page publishes a small semantic DOM contract, in the shape ra's
workbench uses. Walk up from any click target:

| attribute | on | resolves |
| --- | --- | --- |
| `data-page` | `<body>` | which page (`docs`) |
| `data-component` | section root | the component family — equal to the section's `id` |
| `data-example` | `<figure>` | the individual example |
| `data-live` | the rendered block | the DOM that *is* the documented markup |
| `data-code-for` | the markup pane | the `data-example` it was generated from |
| `data-class` | a variants-table row | the class that row documents |
| `data-token` | a swatch or hooks row | the token it documents |

`window.__uiDocs.resolve(element)` performs exactly that walk and is the
reference reader; if it and the attributes disagree, the attributes are right.

Three things the server does on visor's behalf: HTTP/1.1 keep-alive, because an
iframe re-fetching a page's whole subresource set over connection-per-request is
visibly slow; a threaded handler, so the stylesheet, the script and the sprite
are not serialised behind each other; and **no `Content-Security-Policy` at
all** — a policy that blocks visor's injected script fails silently, with no
console error and no network request, just chrome that never appears.

visor writes `.visor/` into the directory it runs from; it is gitignored here.

## License

MIT © 2026 Joshua Geschwendt — full text in `LICENSE`. The vendored Phosphor
glyphs carry their own MIT notice in `icons/LICENSE`; both travel with the
files.
