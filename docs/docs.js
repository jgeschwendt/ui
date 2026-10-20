/* docs.js — the reference page's own behaviour. Vanilla, no build.
 *
 * The markup panes and the token table are the load-bearing jobs, and they are
 * the same principle twice. The markup shown is the live example's own
 * innerHTML, read back out of the DOM, so a code block cannot drift from the
 * thing it claims to produce. The token rows are parsed out of the stylesheet
 * the page is already wearing, so the reference cannot drift from the tokens
 * either. There is one copy of each fact on this page, and it is the working one.
 */

const h = (tag, props, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

/* ──────────────────────────────────────────────── markup, from the DOM ── */

/** Strip the page's own indentation off a block read out of innerHTML. */
function dedent(html) {
  const lines = html.replace(/\t/g, "  ").replace(/^\s*\n|\n\s*$/g, "").split("\n");
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return lines.map((l) => l.slice(pad)).join("\n");
}

for (const live of document.querySelectorAll("[data-live]")) {
  const example = live.closest("[data-example]");
  const source = dedent(live.innerHTML);
  const code = h("code", { textContent: source }); // textContent, so the markup is shown, not run
  const pre = h("pre", { hidden: true }, code);
  const [toggle, copy] = ["markup", "copy"].map((textContent) =>
    h("button", { className: "btn btn-quiet btn-sm", type: "button", textContent }),
  );
  toggle.setAttribute("aria-expanded", "false");
  const bar = h(
    "div",
    { className: "doc-src-bar" },
    toggle,
    copy,
    h("span", { className: "spacer" }),
    h("span", { textContent: example?.dataset.example ?? "" }),
  );
  const wrap = h("div", { className: "doc-src" }, bar, pre);
  if (example) wrap.dataset.codeFor = example.dataset.example;
  live.after(wrap);

  toggle.addEventListener("click", () => {
    pre.hidden = !pre.hidden;
    toggle.setAttribute("aria-expanded", !pre.hidden);
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(source);
      copy.textContent = "copied";
    } catch {
      // A denied clipboard is the page's problem to say out loud, not to throw
      // over: select the block instead and let the keyboard finish the job.
      getSelection().selectAllChildren(code);
      pre.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      copy.textContent = "press ⌘C";
    }
    setTimeout(() => (copy.textContent = "copy"), 1400);
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
  { id: "token-surfaces", label: "surfaces & ink", re: /^--ui-(bg|surface|sunken|border|fg)/ },
  { id: "token-accent", label: "accent", re: /^--ui-accent/ },
  { id: "token-semantic", label: "semantic", re: /^--ui-(danger|info|ok|warn)/ },
  { id: "token-spacing", label: "spacing", re: /^--ui-space-/ },
  { id: "token-type", label: "type", re: /^--ui-(font|leading|text|tracking|weight)-/ },
  {
    id: "token-depth",
    label: "radius, shadow & motion",
    re: /^--ui-(radius|shadow|glow|ease|fast|slow)/,
  },
  { id: "token-other", label: "everything else", re: /^--ui-/ },
];

/** A value we can paint into a box, as opposed to one we can only print. */
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch|color)\()/i;

const DECLARATION = /(--ui-[a-z0-9-]+)\s*:\s*([^;}]+)/gi;

/** The body of the first rule whose selector matches, brace-balanced. */
function ruleBody(css, selector) {
  const m = selector.exec(css);
  if (!m) return;
  const open = css.indexOf("{", m.index);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
}

/** Declared custom properties, in source order, last write winning. */
const declarations = (body) =>
  new Map(
    [...(body ?? "").matchAll(DECLARATION)].map(([, name, value]) => [name, value.trim()]),
  );

function swatchCell(value, ground) {
  const td = h("td", null, h("code", { className: "code", textContent: value }));
  // Paint is the literal, never var() — see above; the chip wears the theme's
  // ground so a translucent tint reads true.
  if (COLOR_VALUE.test(value)) {
    td.prepend(
      h(
        "span",
        { className: "doc-tokref-chip", style: `background: ${ground}` },
        h("i", { style: `background: ${value}` }),
      ),
    );
  }
  return td;
}

function tokenRows(css) {
  /* Comments can hold anything — braces, semicolons, a stray `--ui-` — so they
     come out before any structure is inferred from the text. */
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const light = declarations(ruleBody(clean, /(?:^|[\s;}]):root\s*\{/));
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
  const tokens = new Set([...light.keys(), ...dark.keys()]);

  const frag = document.createDocumentFragment();
  const placed = new Set();
  const lightBg = light.get("--ui-bg");
  const darkBg = dark.get("--ui-bg") ?? lightBg;
  let reassigned = 0;

  for (const family of TOKEN_FAMILIES) {
    const names = [...light.keys()].filter((n) => !placed.has(n) && family.re.test(n));
    if (!names.length) continue;
    frag.append(
      h(
        "tr",
        { className: "doc-tokref-family", id: family.id },
        h("th", { colSpan: 3, scope: "colgroup", textContent: family.label }),
      ),
    );

    for (const name of names) {
      placed.add(name);
      const darkCell = swatchCell(dark.get(name) ?? light.get(name), darkBg);
      if (dark.has(name)) reassigned += 1;
      else Object.assign(darkCell, { className: "is-same", title: "unchanged in dark" });
      const tr = frag.appendChild(
        h(
          "tr",
          null,
          h("td", { className: "table-mono", textContent: name }),
          swatchCell(light.get(name), lightBg),
          darkCell,
        ),
      );
      Object.assign(tr.dataset, { token: name, tokenFamily: family.id });
    }
  }

  return {
    frag,
    reassigned,
    shown: placed.size,
    declared: tokens.size,
    missing: [...tokens].filter((n) => !placed.has(n)),
  };
}

const body = document.querySelector("[data-token-reference] tbody");
const count = document.getElementById("token-reference-count");
const sheet = document.querySelector('link[rel="stylesheet"][href$="ui.css"]').getAttribute("href");
const errorRow = (text) =>
  h("tr", { className: "doc-tokref-error" }, h("td", { colSpan: 3, textContent: text }));

fetch(sheet, { cache: "no-store" })
  .then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trimEnd());
    return res.text();
  })
  .then((css) => {
    const { frag, reassigned, shown, declared, missing } = tokenRows(css);
    body.replaceChildren(frag);
    // The assertion, in the page: rows shown === --ui-* declared on :root and the dark blocks.
    if (missing.length) {
      body.append(
        errorRow(
          `${missing.length} declared token(s) missing from this table: ` + missing.join(", "),
        ),
      );
    }
    count.textContent = missing.length
      ? `${shown} of ${declared} tokens shown — see the row above.`
      : `${shown} tokens — every --ui-* declared on :root in ${sheet}; ` +
        `the dark blocks reassign ${reassigned} of them.`;
  })
  .catch((err) => {
    body.replaceChildren(
      errorRow(`could not read ${sheet} — ${err.message}. ` + "The table is empty rather than wrong."),
    );
    count.textContent = "token count unavailable";
  });

/* ────────────────────────────────────────────────────── the index rail ── */

const links = new Map(
  [...document.querySelectorAll(".doc-nav a[href^='#']")]
    .map((a) => [a.getAttribute("href").slice(1), a]),
);

const seen = new Set();
const spy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) seen[e.isIntersecting ? "add" : "delete"](e.target.id);
    const current = [...links.keys()].find((id) => seen.has(id));
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
    if (btn) for (const b of btn.parentElement.children) b.classList.toggle("is-on", b === btn);
  });
}

for (const host of document.querySelectorAll("[data-doc-list]")) {
  host.addEventListener("click", (e) => {
    const row = e.target.closest(".listrow:not([aria-disabled=true])");
    if (!row) return;
    for (const r of row.parentElement.children) {
      const on = r === row;
      r.classList.toggle("is-current", on);
      r.setAttribute("aria-selected", on);
    }
  });
}

for (const orb of document.querySelectorAll("[data-doc-orb] .orb")) {
  orb.addEventListener("click", () => {
    const muted = orb.classList.toggle("is-muted");
    orb.setAttribute("aria-pressed", muted);
    orb.setAttribute(
      "aria-label",
      orb.getAttribute("aria-label").replace(/open|muted/, muted ? "muted" : "open"),
    );
  });
}

for (const host of document.querySelectorAll("[data-doc-meter]")) {
  const meter = host.querySelector(".meter");
  let n = 0;
  setInterval(
    () =>
      meter.style.setProperty(
        "--ui-meter-value",
        45 + Math.round(Math.abs(Math.sin(++n / 5)) * 45) + "%",
      ),
    1200,
  );
}

/* ─────────────────────────────────────────────────── the icon gallery ── */

const grid = document.getElementById("icon-grid");
for (const sym of document.querySelectorAll("symbol[id^='ph-']")) {
  grid.append(
    h(
      "div",
      {
        className: "doc-icon",
        innerHTML: '<svg class="icon" aria-hidden="true"><use href="#' + sym.id + '"></use></svg>',
      },
      sym.id.slice(3),
    ),
  );
}

/* ──────────────────────────────────────────────────────────── wrapping ── */

/* The reference reader for the contract documented in §Wrapping. A wrapper may
   reimplement the walk; if the two disagree, the attributes are right. */

function resolve(element) {
  if (!(element instanceof Element)) return null;
  const section = element.closest("[data-component]");
  const example = element.closest("[data-example]");
  if (!section && !example) return null;
  const out = {
    component: section?.dataset.component ?? null,
    example: example?.dataset.example ?? null,
    section: section?.id || null,
  };
  for (const k of ["class", "token"]) {
    const carrier = element.closest(`[data-${k}]`);
    if (carrier) out[k] = carrier.dataset[k];
  }
  const live = example?.querySelector("[data-live]");
  if (live) out.markup = dedent(live.innerHTML);
  return out;
}

window.__uiDocs = { applyTheme, resolve };
