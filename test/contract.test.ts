// The external contract, end to end: the stylesheet's public surface, the
// glyphs every page inlines, and the dev server's corrections. Nothing here
// imports the library — it ships as files, so the tests read the files.
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";

const root = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${root}/${path}`).text();
const all = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]);
const set = (text: string, re: RegExp) => [...new Set(all(text, re))].sort();
const [css, docs] = await Promise.all(["ui.css", "docs.css"].map(async (p) => (await read(p)).replace(/\/\*[\s\S]*?\*\//g, "")));
const pages = await Promise.all(["demo/index.html", "docs/index.html"].map(read));
const top = (sheet: string, d = 0) => [...sheet].filter((c) => !(c === "}" ? --d : c === "{" ? d++ : d)).join("").replace(/\s+/g, " ").trim();
const ground = (sheet: string) => all(sheet.match(/\n {2}:root \{([^}]*)\}/)![1], /(--ui-[a-z0-9-]+)\s*:/g);
const bare = (sheet: string) => set(sheet, /var\(\s*(--ui-[a-z0-9-]+)\s*\)/g);
const preludes = (sheet: string) => all(sheet, /([^{};]+)\{/g).filter((p) => !p.trim().startsWith("@")).join();
const classes = (text: string) => set(text, /\.([a-z][a-z0-9-]*)/g);

test("the public surface — every class, attribute and token — changes only on purpose", () => {
  expect({
    attributes: set(`${preludes(css)} ${all(css, /attr\(([a-z-]+)/g).map((a) => `[${a}`)}`, /\[([a-z-]+)/g),
    classes: classes(preludes(css)),
    tokens: set(css, /(--ui-[a-z0-9-]+)/g),
  }).toMatchSnapshot();
});

test("every rule lives in a layer; :root declares every token a theme reassigns or a rule reads bare", () => {
  expect(top(css)).toBe("@layer ui.tokens, ui.base, ui.components; @layer ui.tokens {} @layer ui.base {} @layer ui.components {}");
  expect([...bare(css), ...set(all(css, /:root[^{]*\{([^}]*)\}/g).join(), /(--ui-[a-z0-9-]+)\s*:/g)].filter((t) => !ground(css).includes(t))).toEqual([]);
});

test("the sprite, the standalone glyphs and each page's inlined copy are one set", async () => {
  const symbols = (text: string) => all(text, /(<symbol id="ph-[\s\S]*?<\/symbol>)/g).sort();
  const names = readdirSync(`${root}/icons/svg`).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
  const files = await Promise.all(names.map((n) => read(`icons/svg/${n}.svg`)));
  const sprite = symbols(await read("icons/sprite.svg"));
  expect(sprite).toEqual(
    files.map((f, i) => f.trim().replace(/^<svg xmlns="[^"]*"/, `<symbol id="ph-${names[i]}"`).replace(/<\/svg>$/, "</symbol>")).sort(),
  );
  expect(await read("README.md")).toContain(`A ${names.length}-glyph subset`);
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
  const library = classes(all(css, /([^{};]+)\{/g).join());
  expect(own.filter((c) => library.includes(c))).toEqual([]);
  expect({ classes: own, tokens: set(docs, /(--ui-[a-z0-9-]+)/g) }).toMatchSnapshot();
  const shell = (await read("README.md")).split("## The docs shell")[1].split("\n## ")[0];
  expect(own.filter((c) => !shell.includes(`.${c}`))).toEqual([]);
});

test("figures: every <figure class=figure> on the docs page shows a rendered board from its canvas source", async () => {
  const shown = all(pages[1], /<figure class="figure">([\s\S]*?)<\/figure>/g).flatMap((f) => {
    const m = f.match(/^\s*<img class="figure-light" src="figures\/([a-z0-9-]+)\.png" alt="[^"]+" \/>\s*<img class="figure-dark" src="figures\/\1-dark\.png" alt="" aria-hidden="true" loading="lazy" \/>/);
    expect(m?.[1]).toBeDefined();
    expect(f).toMatch(/<figcaption>[\s\S]*?Source: Claude Design canvas <a href="https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+">ui figures<\/a>, board [A-Z][A-Za-z]+\.<\/figcaption>/);
    return [`${m![1]}.png`, `${m![1]}-dark.png`];
  });
  const pngs = readdirSync(`${root}/docs/figures`).filter((f) => f.endsWith(".png")).sort();
  expect(shown.sort()).toEqual(pngs);
  const exporter = await read("docs/figures/export.sh");
  for (const board of Object.keys(JSON.parse(await read("docs/figures/project/canvas.json")).boards)) {
    expect(await Bun.file(`${root}/docs/figures/project/${board}`).exists()).toBe(true);
    expect(exporter).toMatch(new RegExp(`shoot ${board.replace(".", "\\.")} ([a-z0-9-]+)\\.png \\1-dark\\.png`));
  }
  expect(all(exporter, /^shoot \S+ (\S+\.png \S+\.png)$/gm).flatMap((p) => p.split(" ")).sort()).toEqual(pngs);
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

test("serve.py: / is the docs, edits show on reload, the environment loses to --port", async () => {
  const { child, out, origin } = await serve(["--port", "0"], { PORT: "1" });
  try {
    expect(out).toContain(`ui   → ${origin}/docs/\ndemo → ${origin}/demo/`);
    const port = origin!.split(":")[2];
    // Threaded: an idle connection holds no request hostage.
    let raw = "";
    const closed = Promise.withResolvers();
    const idle = await Bun.connect({ hostname: "127.0.0.1", port: +port, socket: { data: (_, d) => void (raw += d), close: closed.resolve } });
    for (const [path, type] of [["/ui.css", "text/css; charset=utf-8"], ["/docs/", "text/html; charset=utf-8"], ["/docs/docs.js", "text/javascript; charset=utf-8"], ["/icons/sprite.svg", "image/svg+xml"], ["/README.md", "text/markdown; charset=utf-8"], ["/docs/figures/project/canvas.json", "application/json; charset=utf-8"]]) {
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
    expect([await taken.child.exited, taken.out]).toEqual([1, expect.stringContaining("serve: cannot bind")]);
  } finally {
    child.kill("SIGINT");
  }
  expect(await child.exited).toBe(0);
});

test("README's Tailwind import nests ui in components: after Preflight's base, before utilities", async () => {
  const { compile } = await import("tailwindcss");
  const imports = all(await read("README.md"), /```css\n([^`]*@import "tailwindcss"[^`]*)```/g);
  expect(new Set(imports)).toEqual(new Set(['@import "tailwindcss";\n@import "./ui.css" layer(components);\n']));
  const files: Record<string, string> = { "./ui.css": "ui.css", tailwindcss: "node_modules/tailwindcss/index.css" };
  const loadStylesheet = async (id: string) => ({ path: id, base: root, content: await read(files[id]) });
  const out = (await compile(imports[0], { base: root, loadStylesheet })).build(["btn", "p-0"]);
  expect(out.match(/^@layer [^{]+;/m)?.[0]).toBe("@layer theme, base, components, utilities;");
  expect(out).toMatch(/^@layer components \{\s*@layer ui\.tokens, ui\.base, ui\.components;/m);
});
