// The external contract, end to end: the stylesheet's public surface and cascade traps, the docs
// shell, the glyphs every page inlines, the figures, the docs page's Tailwind import,
// and the dev server's corrections. Nothing here imports ui — it ships as
// files, so the tests read the files.
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";

const root = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${root}/${path}`).text();
const all = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]);
const set = (text: string, re: RegExp) => [...new Set(all(text, re))].sort();
const [css, docs, ...pages] = (await Promise.all(["ui.css", "docs.css", "demo/index.html", "docs/index.html"].map(read))).map((t, i) => (i < 2 ? t.replace(/\/\*[\s\S]*?\*\//g, "") : t));
const top = (sheet: string, d = 0) => [...sheet].filter((c) => !(c === "}" ? --d : c === "{" ? d++ : d)).join("").replace(/\s+/g, " ").trim();
const ground = (sheet: string) => all(sheet.match(/\n {2}:root \{([^}]*)\}/)![1], /(--ui-[a-z0-9-]+)\s*:/g);
const bare = (sheet: string) => set(sheet, /var\(\s*(--ui-[a-z0-9-]+)\s*\)/g);
const preludes = (sheet: string) => all(sheet, /([^{};]+)\{/g).filter((p) => !p.trim().startsWith("@")).join();
const classes = (text: string) => set(text, /\.([a-z][a-z0-9-]*)/g);

test("the public surface — every class, attribute and token — changes only on purpose", () => {
  expect({
    attributes: set(css, /(?:\[|attr\()([a-z-]+)/g),
    classes: classes(preludes(css)),
    tokens: set(css, /(--ui-[a-z0-9-]+)/g),
  }).toMatchSnapshot();
});

test("every rule lives in a layer; :root declares every token a theme reassigns or a rule reads bare", () => {
  expect(top(css)).toBe("@layer ui.tokens, ui.base, ui.components; @layer ui.tokens {} @layer ui.base {} @layer ui.components {}");
  expect([...bare(css), ...set(all(css, /:root[^{]*\{([^}]*)\}/g).join(), /(--ui-[a-z0-9-]+)\s*:/g)].filter((t) => !ground(css).includes(t))).toEqual([]);
});

test("cascade traps: no modifier, tone or state is undone by a stronger selector, a shorthand or a dead pairing", () => {
  expect([
    /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)/,
    /:where\([^)]*\bbody\.ui\b[^)]*\)\s*\{\s*margin: 0/,
    /:where\(\.ui, \.ui \*\),\s*:where\(\.ui \*\)::before,\s*:where\(\.ui \*\)::after \{[^}]*animation-duration: 0\.01ms !important[^}]*transition-duration: 0\.01ms !important/,
    /\[data-table\] th\.table-num[^{]*\{[^}]*text-align: right/,
    ...["danger", "ok", "warn"].map((t) => new RegExp(`\\.chip-${t} [^{]*\\.chip-value`)),
    ...["input", "select", "textarea"].map((c) => new RegExp(`\\.${c}\\[aria-invalid="true"\\]`)),
  ].filter((re) => !re.test(css))).toEqual([]);
  expect(css.match(/\.btn:(?:first|last)-child[^{]*\{[^}]*border-radius:|\.select:disabled[^{]*\{[^}]*\bbackground:|\{[^}]*(?:cursor:[^}]*pointer-events: none|pointer-events: none[^}]*cursor:)|:root\[data-theme="light"\]/g)).toBeNull();
});

test("the sprite, the standalone glyphs and each page's inlined copy are one set", async () => {
  const symbols = (text: string) => all(text, /(<symbol id="ph-[\s\S]*?<\/symbol>)/g).sort();
  const names = readdirSync(`${root}/icons/svg`).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
  const files = await Promise.all(names.map((n) => read(`icons/svg/${n}.svg`)));
  const sprite = symbols(await read("icons/sprite.svg"));
  expect(sprite).toEqual(
    files.map((f, i) => f.trim().replace(/^<svg xmlns="[^"]*"/, `<symbol id="ph-${names[i]}"`).replace(/<\/svg>$/, "</symbol>")).sort(),
  );
  expect(pages[1]).toContain(`A ${names.length}-glyph `);
  for (const page of pages) {
    expect(symbols(page)).toEqual(sprite);
    expect(all(page, /href="#ph-([^"]*)"/g).filter((n) => !names.includes(n))).toEqual([]);
    expect(all(page, /<(?:link|script|img)[^>]+(?:href|src)=["']((?:https?:)?\/\/[^"']*)/g)).toEqual([]);
  }
});

test("docs.css — the shared docs shell — is additive: its own layer, ui's tokens, no colour literal, no ui.css class", async () => {
  expect(top(docs)).toBe("@layer ui.tokens, ui.base, ui.components, ui.docs; @layer ui.tokens {} @layer ui.docs {}");
  expect(bare(docs).filter((t) => ![...ground(css), ...ground(docs)].includes(t))).toEqual([]);
  expect(docs.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/gi)).toBeNull();
  const own = classes(preludes(docs));
  expect(own.filter((c) => classes(css).includes(c))).toEqual([]);
  expect({ classes: own, tokens: set(docs, /(--ui-[a-z0-9-]+)/g) }).toMatchSnapshot();
  const shell = pages[1].split('id="docs-shell"')[1].split("</section>")[0];
  expect(own.filter((c) => !shell.includes(`.${c}`))).toEqual([]);
});

test("figures: every <figure class=figure> on the docs page shows a rendered board from its canvas source", async () => {
  const shown = all(pages[1], /<figure class="figure">([\s\S]*?)<\/figure>/g).flatMap((f) => {
    const m = f.match(/^\s*<img class="figure-light" src="figures\/([a-z0-9-]+)\.png" alt="[^"]+" \/>\s*<img class="figure-dark" src="figures\/\1-dark\.png" alt="" aria-hidden="true" loading="lazy" \/>/);
    expect(f).toMatch(/<figcaption>[\s\S]*?Source: Claude Design canvas <a href="https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+">ui figures<\/a>, board [A-Z][A-Za-z]+\.<\/figcaption>/);
    return [`${m![1]}.png`, `${m![1]}-dark.png`];
  });
  const pngs = readdirSync(`${root}/docs/figures`).filter((f) => f.endsWith(".png")).sort();
  expect(shown.sort()).toEqual(pngs);
  const shoots = all(await read("docs/figures/export.sh"), /^shoot (.+)$/gm);
  const boards = Object.keys(JSON.parse(await read("docs/figures/project/canvas.json")).boards);
  await Promise.all(boards.map((b) => read(`docs/figures/project/${b}`)));
  expect(shoots.map((s) => s.replace(/ ([a-z0-9-]+)\.png \1-dark\.png$/, "")).sort()).toEqual(boards.sort());
  expect(shoots.flatMap((s) => s.split(" ").slice(1)).sort()).toEqual(pngs);
});

const serve = async (args: string[], env: Record<string, string> = {}) => {
  const child = Bun.spawn(["python3", `${root}/serve.py`, ...args], { env: { ...process.env, ...env }, stderr: "pipe" });
  const reader = child.stderr.pipeThrough(new TextDecoderStream()).getReader();
  let out = "";
  while (!/demo →|cannot bind/.test(out)) {
    const { done, value } = await reader.read();
    if (done) break;
    out += value;
  }
  return { child, out, origin: out.match(/(http:\/\/[^/]+)/)?.[1] };
};

test("serve.py: / redirects to the docs over keep-alive, files carry charset and no-store, an idle socket blocks nothing, --port › $PORT", async () => {
  const { child, out, origin } = await serve(["--port", "0"], { PORT: "1" });
  try {
    expect(out).toContain(`ui   → ${origin}/docs/\ndemo → ${origin}/demo/`);
    const { hostname, port } = new URL(origin!);
    // Threaded: an idle connection holds no request hostage.
    let raw = "";
    const closed = Promise.withResolvers();
    const idle = await Bun.connect({ hostname, port: +port, socket: { data: (_, d) => void (raw += d), close: closed.resolve } });
    for (const [path, type] of [["/ui.css", "text/css; charset=utf-8"], ["/docs/", "text/html; charset=utf-8"], ["/docs/docs.js", "text/javascript; charset=utf-8"], ["/docs/theme.js", "text/javascript; charset=utf-8"], ["/icons/sprite.svg", "image/svg+xml"], ["/README.md", "text/markdown; charset=utf-8"], ["/docs/figures/project/canvas.json", "application/json; charset=utf-8"]]) {
      const res = await fetch(origin + path);
      expect([res.status, res.headers.get("content-type"), res.headers.get("cache-control")]).toEqual([200, type, "no-store"]);
      expect(await res.text()).toBe(await read(path.slice(1).replace(/\/$/, "/index.html")));
    }
    // Keep-alive: both redirects answer on one pipelined connection, then the server closes it.
    idle.write("GET / HTTP/1.1\r\nHost: x\r\n\r\nHEAD /index.html HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
    await closed.promise;
    const redirect = expect.arrayContaining(["HTTP/1.1 302 Found", "Location: /docs/", "Content-Length: 0", "Cache-Control: no-store"]);
    expect(raw.split("\r\n\r\n").filter(Boolean).map((block) => block.split("\r\n"))).toEqual([redirect, redirect]);
    const taken = await serve([], { PORT: port });
    expect([await taken.child.exited, taken.out]).toEqual([1, expect.stringContaining(`serve: cannot bind ${hostname}:${port} `)]);
  } finally {
    child.kill("SIGINT");
  }
  expect(await child.exited).toBe(0);
});

test("the docs page's Tailwind import nests ui in components: after Preflight's base, before utilities", async () => {
  const { compile } = await import("tailwindcss");
  const imports = all(pages[1], /<pre class="readout">(@import "tailwindcss";[^<]*)<\/pre>/g);
  expect(imports).toEqual(['@import "tailwindcss";\n@import "./ui.css" layer(components);']);
  const files: Record<string, string> = { "./ui.css": "ui.css", tailwindcss: "node_modules/tailwindcss/index.css" };
  const loadStylesheet = async (id: string) => ({ path: id, base: root, content: await read(files[id]) });
  const out = (await compile(imports[0], { base: root, loadStylesheet })).build(["btn", "p-0"]);
  expect(out.match(/^@layer [^{]+;/m)?.[0]).toBe("@layer theme, base, components, utilities;");
  expect(out).toMatch(/^@layer components \{\s*@layer ui\.tokens, ui\.base, ui\.components;/m);
});
