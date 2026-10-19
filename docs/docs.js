/* docs.js — the reference page's own behaviour. Vanilla, no build.
 *
 * Four jobs, and a fifth for whoever wraps this page:
 *   1. the theme toggle (the library's documented contract, nothing more)
 *   2. the markup pane under every example, generated FROM the example
 *   3. the token reference table, generated FROM ui.css
 *   4. the index rail's current-section marker
 *   5. window.__uiDocs.resolve(el) — the semantic-DOM reader (see §Wrapping)
 *
 * (2) and (3) are the load-bearing ones, and they are the same principle twice.
 * The markup shown is the live example's own innerHTML, read back out of the
 * DOM, so a code block cannot drift from the thing it claims to produce. The
 * token rows are parsed out of the stylesheet the page is already wearing, so
 * the reference cannot drift from the tokens either. There is one copy of each
 * fact on this page, and it is the working one.
 */

/* ─────────────────────────────────────────────────────────────── theme ── */

/* The same key the demo writes, deliberately: the two pages are one site under
   the server, and a theme chosen on one is the theme the other opens in. */
const THEME_KEY = "ui-theme";

/* Blocked site data makes localStorage throw on touch; the choice then lasts
   only as long as the page, and nothing after this line notices. */
function stored(op, mode) {
  try {
    return localStorage[op](THEME_KEY, mode);
  } catch {}
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = mode;
  stored(mode === "auto" ? "removeItem" : "setItem", mode);
  for (const b of document.querySelectorAll("[data-theme-set]")) {
    b.setAttribute("aria-pressed", String(b.dataset.themeSet === mode));
  }
}

for (const b of document.querySelectorAll("[data-theme-set]")) {
  b.addEventListener("click", () => applyTheme(b.dataset.themeSet));
}
applyTheme(stored("getItem") || "auto");

/* ──────────────────────────────────────────────── markup, from the DOM ── */

/** Strip the page's own indentation off a block read out of innerHTML. */
function dedent(html) {
  const lines = html.replace(/\t/g, "  ").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  let pad = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    pad = Math.min(pad, line.length - line.trimStart().length);
  }
  if (!Number.isFinite(pad)) pad = 0;
  return lines.map((line) => line.slice(pad)).join("\n");
}

const COPY_LABEL = "copy";

for (const live of document.querySelectorAll("[data-live]")) {
  const example = live.closest("[data-example]");
  const source = dedent(live.innerHTML);

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = source; // textContent, so the markup is shown, not run
  pre.appendChild(code);

  const bar = document.createElement("div");
  bar.className = "doc-src-bar";

  const toggle = document.createElement("button");
  toggle.className = "btn btn-quiet btn-sm";
  toggle.type = "button";
  toggle.textContent = "markup";
  toggle.setAttribute("aria-expanded", "false");

  const copy = document.createElement("button");
  copy.className = "btn btn-quiet btn-sm";
  copy.type = "button";
  copy.textContent = COPY_LABEL;

  const spacer = document.createElement("span");
  spacer.className = "spacer";

  const note = document.createElement("span");
  note.textContent = example ? example.dataset.example : "";

  bar.append(toggle, copy, spacer, note);

  const wrap = document.createElement("div");
  wrap.className = "doc-src";
  if (example) wrap.dataset.codeFor = example.dataset.example;
  wrap.append(bar, pre);
  pre.hidden = true;
  live.after(wrap);

  toggle.addEventListener("click", () => {
    pre.hidden = !pre.hidden;
    toggle.setAttribute("aria-expanded", String(!pre.hidden));
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(source);
      copy.textContent = "copied";
    } catch {
      // A denied clipboard is the page's problem to say out loud, not to throw
      // over: select the block instead and let the keyboard finish the job.
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      pre.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      copy.textContent = "press ⌘C";
    }
    setTimeout(() => {
      copy.textContent = COPY_LABEL;
    }, 1400);
  });
}

/* ──────────────────────────────────────── the token reference, from CSS ── */

/* The table below §Tokens is not written down anywhere. It is parsed out of
   ui.css at load — the same stylesheet the page is wearing — so a token added,
   renamed or retinted in the stylesheet appears here on the next reload and
   nowhere else has to be edited. Light is read off bare `:root`; dark off
   `:root[data-theme="dark"]` (the media block is a verbatim twin of it, and is
   the fallback if the attribute block is ever the one to go).

   Swatches are painted from the parsed literal, never through var(): a light
   swatch has to stay light while you read the page in dark. */

const TOKEN_FAMILIES = [
  { id: "token-surfaces", label: "surfaces & ink", test: /^--ui-(bg|surface|sunken|border|fg)/ },
  { id: "token-accent", label: "accent", test: /^--ui-accent/ },
  { id: "token-semantic", label: "semantic", test: /^--ui-(danger|info|ok|warn)/ },
  { id: "token-spacing", label: "spacing", test: /^--ui-space-/ },
  { id: "token-type", label: "type", test: /^--ui-(font|leading|text|tracking|weight)-/ },
  {
    id: "token-depth",
    label: "radius, shadow & motion",
    test: /^--ui-(radius|shadow|glow|ease|fast|slow)/,
  },
  { id: "token-other", label: "everything else", test: /^--ui-/ },
];

/** A value we can paint into a box, as opposed to one we can only print. */
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch|color)\()/i;

const DECLARATION = /(--ui-[a-z0-9-]+)\s*:\s*([^;}]+)/gi;

/** Comments can hold anything — braces, semicolons, a stray `--ui-` — so they
    come out before any structure is inferred from the text. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The body of the first rule whose selector matches, brace-balanced. */
function ruleBody(css, selector) {
  const m = selector.exec(css);
  if (!m) return null;
  const open = css.indexOf("{", m.index);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}

/** Declared custom properties, in source order, last write winning. */
function declarations(body) {
  const out = new Map();
  if (body === null) return out;
  for (const [, name, value] of body.matchAll(DECLARATION)) out.set(name, value.trim());
  return out;
}

function swatchCell(value, ground) {
  const td = document.createElement("td");
  const chip = document.createElement("span");
  chip.className = "doc-tokref-chip";
  if (ground) chip.style.background = ground; // so a translucent tint reads true
  if (COLOR_VALUE.test(value)) {
    const paint = document.createElement("i");
    paint.style.background = value; // the literal, never var() — see above
    chip.appendChild(paint);
    td.appendChild(chip);
  }
  const code = document.createElement("code");
  code.className = "code";
  code.textContent = value;
  td.appendChild(code);
  return td;
}

function tokenRows(css) {
  const clean = stripComments(css);
  const light = declarations(ruleBody(clean, /(?:^|[\s;}])(:root)\s*\{/));
  if (!light.size) throw new Error("no --ui-* declarations on :root");
  const dark = declarations(
    ruleBody(clean, /:root\[data-theme="dark"\]\s*\{/) ??
      ruleBody(clean, /:root:not\(\[data-theme="light"\]\)\s*\{/),
  );

  /* Every token the theme blocks declare, so the table can say out loud whether
     it is showing all of them. Per-component hooks (--ui-icon-size and friends)
     are declared on the components that read them, not here, and belong to the
     hooks table in §Tokens — but a token declared ONLY in a dark block is the
     documented mistake, and this is where it would surface. */
  const declared = new Set([...light.keys(), ...dark.keys()]);

  const frag = document.createDocumentFragment();
  const placed = new Set();
  let rows = 0;
  let reassigned = 0;

  for (const family of TOKEN_FAMILIES) {
    const names = [...light.keys()].filter((n) => !placed.has(n) && family.test.test(n));
    if (!names.length) continue;

    const head = document.createElement("tr");
    head.className = "doc-tokref-family";
    head.id = family.id;
    const th = document.createElement("th");
    th.colSpan = 3;
    th.scope = "colgroup";
    th.textContent = family.label;
    head.appendChild(th);
    frag.appendChild(head);

    for (const name of names) {
      placed.add(name);
      rows += 1;
      const lightValue = light.get(name);
      const darkValue = dark.get(name) ?? lightValue;
      if (dark.has(name)) reassigned += 1;

      const tr = document.createElement("tr");
      tr.dataset.token = name;
      tr.dataset.tokenFamily = family.id;

      const key = document.createElement("th");
      key.scope = "row";
      key.className = "table-mono";
      key.textContent = name;
      tr.appendChild(key);

      const lightCell = swatchCell(lightValue, light.get("--ui-bg"));
      const darkCell = swatchCell(darkValue, dark.get("--ui-bg") ?? light.get("--ui-bg"));
      if (!dark.has(name)) {
        darkCell.classList.add("is-same");
        darkCell.title = "unchanged in dark";
      }
      tr.append(lightCell, darkCell);
      frag.appendChild(tr);
    }
  }

  const missing = [...declared].filter((n) => !placed.has(n));
  return { frag, rows, reassigned, declared: declared.size, missing };
}

const tokref = document.querySelector("[data-token-reference]");
if (tokref) {
  const body = tokref.querySelector("tbody");
  const count = document.getElementById("token-reference-count");
  const sheet =
    document.querySelector('link[rel="stylesheet"][href$="ui.css"]')?.getAttribute("href") ||
    "../ui.css";

  const fail = (why) => {
    body.replaceChildren();
    const tr = document.createElement("tr");
    tr.className = "doc-tokref-error";
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = `could not read ${sheet} — ${why}. The table is empty rather than wrong.`;
    tr.appendChild(td);
    body.appendChild(tr);
    if (count) count.textContent = "token count unavailable";
  };

  fetch(sheet, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    })
    .then((css) => {
      const { frag, rows, reassigned, declared, missing } = tokenRows(css);
      body.replaceChildren(frag);
      if (missing.length) {
        // The assertion, in the page: rows shown === --ui-* declared in ui.css.
        const tr = document.createElement("tr");
        tr.className = "doc-tokref-error";
        const td = document.createElement("td");
        td.colSpan = 3;
        td.textContent = `${missing.length} declared token(s) missing from this table: ${missing.join(", ")}`;
        tr.appendChild(td);
        body.appendChild(tr);
      }
      if (count) {
        count.textContent = missing.length
          ? `${rows} of ${declared} tokens shown — see the row above.`
          : `${rows} tokens — every --ui-* declared on :root in ${sheet}; ` +
            `the dark blocks reassign ${reassigned} of them.`;
      }
    })
    .catch((err) => fail(err.message));
}

/* ────────────────────────────────────────────────────── the index rail ── */

const links = new Map();
for (const a of document.querySelectorAll(".doc-nav a[href^='#']")) {
  links.set(a.getAttribute("href").slice(1), a);
}

const seen = new Set();
const spy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) seen.add(e.target.id);
      else seen.delete(e.target.id);
    }
    let current = null;
    for (const id of links.keys()) {
      if (seen.has(id)) {
        current = id;
        break;
      }
    }
    for (const [id, a] of links) {
      if (id === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  },
  { rootMargin: "0px 0px -70% 0px" },
);
for (const id of links.keys()) {
  const section = document.getElementById(id);
  if (section) spy.observe(section);
}

/* ──────────────────────────────────────────────── examples that breathe ── */

/* A handful of components only say what they are when they move. Every hook
   sits on the example's WRAPPER, never inside it, so the markup pane — which is
   the wrapper's innerHTML — stays the markup a consumer actually copies. */

for (const host of document.querySelectorAll("[data-doc-latch]")) {
  host.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn || !host.contains(btn)) return;
    for (const b of btn.parentElement.children) b.classList.toggle("is-on", b === btn);
  });
}

for (const host of document.querySelectorAll("[data-doc-list]")) {
  host.addEventListener("click", (e) => {
    const row = e.target.closest(".listrow");
    if (!row || !host.contains(row)) return;
    for (const r of row.parentElement.children) {
      const on = r === row;
      r.classList.toggle("is-current", on);
      r.setAttribute("aria-selected", String(on));
    }
  });
}

for (const orb of document.querySelectorAll("[data-doc-orb] .orb")) {
  orb.addEventListener("click", () => {
    const muted = orb.classList.toggle("is-muted");
    orb.setAttribute("aria-pressed", String(muted));
    orb.setAttribute("aria-label", muted ? "microphone muted" : "microphone open");
  });
}

for (const host of document.querySelectorAll("[data-doc-meter]")) {
  const meter = host.querySelector(".meter");
  if (!meter) continue;
  let n = 0;
  setInterval(() => {
    n += 1;
    meter.style.setProperty(
      "--ui-meter-value",
      45 + Math.round(Math.abs(Math.sin(n / 5)) * 45) + "%",
    );
  }, 1200);
}

/* ─────────────────────────────────────────────────── the icon gallery ── */

const grid = document.getElementById("icon-grid");
if (grid) {
  for (const sym of document.querySelectorAll("symbol[id^='ph-']")) {
    const cell = document.createElement("div");
    cell.className = "doc-icon";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + sym.id);
    svg.appendChild(use);
    cell.append(svg, document.createTextNode(sym.id.slice(3)));
    grid.appendChild(cell);
  }
}

/* ──────────────────────────────────────────────────────────── wrapping ── */

/* The reference reader for the contract documented in §Wrapping. A wrapper may
   reimplement the walk; if the two disagree, the attributes are right. */

function resolve(element) {
  if (!(element instanceof Element)) return null;
  const carrier = element.closest("[data-component], [data-example]");
  if (!carrier) return null;
  const section = carrier.closest("[data-component]");
  const example = carrier.closest("[data-example]");
  const out = {
    component: section ? section.dataset.component : null,
    example: example ? example.dataset.example : null,
    section: section ? section.id || null : null,
  };
  const cls = element.closest("[data-class]");
  if (cls) out.class = cls.dataset.class;
  const token = element.closest("[data-token]");
  if (token) out.token = token.dataset.token;
  if (example) {
    const live = example.querySelector("[data-live]");
    if (live) out.markup = dedent(live.innerHTML);
  }
  return out;
}

window.__uiDocs = { applyTheme, resolve };
