// The page scripts, run for real in node:vm over the smallest DOM that reaches
// each behaviour, with storage blocked the way a browser blocks site data.
import { expect, test } from "bun:test";
import vm from "node:vm";

const read = (path: string) => Bun.file(`${import.meta.dir}/../${path}`).text();
const el = (own: object = {}): any => {
  const cls = new Set();
  const p: any = new Proxy(
    {
      addEventListener: (k: string, f: Function) => (p.on[k] = f),
      attrs: {},
      children: [],
      classList: { toggle: (c: string, on = !cls.has(c)) => (on ? cls.add(c) : cls.delete(c), on) },
      closest: () => p,
      dataset: {},
      focus: () => (doc.activeElement = p),
      getAttribute: (k: string) => p.attrs[k] ?? null,
      on: {},
      setAttribute: (k: string, v: string) => (p.attrs[k] = v),
      ...own,
    },
    { get: (o, k) => (k in o ? o[k as never] : () => el()) },
  );
  return p;
};
const orbs = [el(), el()];
const rows = [el(), el(), el(), el(), el({ attrs: { "aria-disabled": "true" } })];
const ids: Record<string, any> = { "voice-list": el({ children: rows }) };
const timers: Record<number, Function> = {};
const doc = el({ activeElement: null, documentElement: el(), getElementById: (id: string) => (ids[id] ??= el()), querySelector: () => null, querySelectorAll: (s: string) => (s === "[data-doc-orb] .orb" ? orbs : []) });
const run = (src: string) => {
  const ctx = vm.createContext({ document: doc, IntersectionObserver: class { observe() {} }, Node: {}, setInterval: (f: Function, ms: number) => (timers[ms] = f) });
  Object.defineProperty(ctx, "localStorage", { get: () => { throw new Error("SecurityError"); } });
  vm.runInContext(src, Object.assign(ctx, { window: ctx }));
  return ctx;
};
const docs = run(await read("docs/docs.js"));
run((await read("demo/index.html")).match(/<script>([\s\S]*?)<\/script>/)![1]);

test("blocked storage costs only persistence: every later feature is set up, a theme still applies", () => {
  docs.__uiDocs.applyTheme("dark");
  expect(doc.documentElement.dataset.theme).toBe("dark");
});

test("docs: every orb in [data-doc-orb] toggles", () => {
  for (const orb of orbs) orb.on.click();
  expect(orbs.map((o) => o.attrs["aria-pressed"])).toEqual(["true", "true"]);
});

test("demo: an arrow from a disabled row steps from that row, skipping it", () => {
  rows[4].focus();
  ids["voice-list"].on.keydown({ key: "ArrowUp", preventDefault() {} });
  expect(rows.map((r) => r.attrs["aria-selected"])).toEqual(["false", "false", "false", "true", "false"]);
});

test("demo: the live strip's badge follows its mood", () => {
  timers[3600]();
  expect([ids["live-strip"].className, ids["live-strip-badge"].className, ids["live-strip-badge"].textContent]).toEqual(["strip strip-info", "badge badge-info", "info"]);
});
