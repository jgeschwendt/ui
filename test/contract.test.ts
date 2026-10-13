// The external contract, end to end: the stylesheet's public surface, the
// glyphs every page inlines, and the dev server's corrections. Nothing here
// imports the library — it ships as files, so the tests read the files.
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";

const root = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${root}/${path}`).text();
const all = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]);
const set = (text: string, re: RegExp) => [...new Set(all(text, re))].sort();
const css = (await read("ui.css")).replace(/\/\*[\s\S]*?\*\//g, "");
const pages = await Promise.all(["demo/index.html", "docs/index.html"].map(read));

test("the public surface — every class, attribute and token — changes only on purpose", () => {
  const preludes = all(css, /([^{};]+)\{/g).filter((p) => !p.trim().startsWith("@")).join();
  expect({
    attributes: set(`${preludes} ${all(css, /attr\(([a-z-]+)/g).map((a) => `[${a}`)}`, /\[([a-z-]+)/g),
    classes: set(preludes, /\.([a-z][a-z0-9-]*)/g),
    tokens: set(css, /(--ui-[a-z0-9-]+)/g),
  }).toMatchSnapshot();
});

test("every rule lives in a layer; :root declares every token a theme reassigns or a rule reads bare", () => {
  let depth = 0;
  let top = "";
  for (const c of css) {
    if (c === "}") depth--;
    if (!depth) top += c;
    if (c === "{") depth++;
  }
  expect(top.replace(/\s+/g, " ").trim()).toBe(
    "@layer ui.tokens, ui.base, ui.components; @layer ui.tokens {} @layer ui.base {} @layer ui.components {}",
  );
  const ground = new Set(all(css.match(/\n {2}:root \{([^}]*)\}/)![1], /(--ui-[a-z0-9-]+)\s*:/g));
  const themed = all(css, /:root[^{]*\{([^}]*)\}/g).join();
  expect(
    [...set(css, /var\(\s*(--ui-[a-z0-9-]+)\s*\)/g), ...set(themed, /(--ui-[a-z0-9-]+)\s*:/g)].filter((t) => !ground.has(t)),
  ).toEqual([]);
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

const serve = async (args: string[], env: Record<string, string> = {}) => {
  const child = Bun.spawn(["python3", `${root}/serve.py`, ...args], { env: { ...process.env, ...env }, stderr: "pipe" });
  const reader = child.stderr.getReader();
  let out = "";
  while (!/demo →|cannot bind/.test(out)) {
    const { done, value } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  return { child, out, origin: out.match(/(http:\/\/[^/]+)/)?.[1] };
};

test("serve.py: / is the docs, edits show on reload, the environment loses to --port", async () => {
  const { child, out, origin } = await serve(["--port", "0"], { PORT: "1" });
  try {
    expect(out).toContain("demo →");
    for (const path of ["/", "/index.html"]) {
      const res = await fetch(origin + path, { redirect: "manual" });
      expect([res.status, res.headers.get("location")]).toEqual([302, "/docs/"]);
    }
    const res = await fetch(`${origin}/ui.css`);
    expect([res.status, res.headers.get("content-type"), res.headers.get("cache-control")]).toEqual([
      200,
      "text/css; charset=utf-8",
      "no-store",
    ]);
    expect(await res.text()).toBe(await read("ui.css"));
    const taken = await serve([], { PORT: origin!.split(":")[2] });
    expect([await taken.child.exited, taken.out]).toEqual([1, expect.stringContaining("serve: cannot bind")]);
  } finally {
    child.kill("SIGINT");
  }
  expect(await child.exited).toBe(0);
});
