// The page scripts, run for real over happy-dom: each page's own HTML, its script
// evaluated in that window, timers ticked by hand, storage working or blocked.
import { expect, test } from "bun:test";
import { Window } from "happy-dom";

const read = (path: string) => Bun.file(`${import.meta.dir}/../${path}`).text();
const css = await read("ui.css");
const load = async (page: string, store: string | null = null, status = 200) => {
  const html = await read(`${page}/index.html`);
  const w: any = new Window({ url: `http://ui.test/${page}/` });
  w.document.write(html.replace(/<script[\s\S]*?<\/script>/g, ""));
  const t: any = { observed: [] };
  Object.assign(w, {
    fetch: async () => new Response(css, { status }),
    IntersectionObserver: class { constructor(f: Function) { t.spy = f; } observe(s: any) { t.observed.push(s.id); } },
    setInterval: (f: Function, ms: number) => (t[ms] = f),
    setTimeout: (f: Function, ms: number) => (t[ms] = f),
  });
  if (store === null) Object.defineProperty(w, "localStorage", { get: () => { throw new Error("SecurityError"); } });
  else w.localStorage.setItem("ui-theme", store);
  w.eval(page === "docs" ? await read("docs/docs.js") : html.match(/<script>([\s\S]*?)<\/script>/)![1]);
  await Bun.sleep(5);
  return Object.assign(w, { $: (s: string) => [...w.document.querySelectorAll(s)], t });
};
const pages: Record<string, any> = { demo: await load("demo"), docs: await load("docs") };
const { docs, demo } = pages;
const at = (els: any[], k: string) => els.map((e) => e.getAttribute(k)).join();
const cls = (els: any[], c: string) => els.map((e) => +e.classList.contains(c)).join("");

test.each(["docs", "demo"])("%s: a stored theme applies, buttons press, auto removes; blocked storage costs only persistence", async (page) => {
  for (const [w, store] of [[await load(page, "dark"), "dark"], [pages[page], null]]) {
    const state = () => [w.document.documentElement.getAttribute("data-theme"), store && w.localStorage.getItem("ui-theme"), at(w.$("[data-theme-set]"), "aria-pressed")];
    expect(state()).toEqual([store, store, store ? "false,false,true" : "false,true,false"]);
    w.$("[data-theme-set]")[1].click();
    expect(state()).toEqual([null, null, "false,true,false"]);
    w.$("[data-theme-set]")[0].click();
    expect(state()).toEqual(["light", store && "light", "true,false,false"]);
  }
  docs.__uiDocs.applyTheme("dark");
  expect(docs.document.documentElement.dataset.theme).toBe("dark");
});

test("docs: one markup pane after every example, its code the dedented live DOM, toggled and copied", async () => {
  const lives = docs.$("[data-live]");
  expect(lives.length).toBe(32);
  for (const live of lives) {
    const pane = live.nextElementSibling, code = pane.querySelector("pre > code").textContent;
    expect([pane.className, pane.dataset.codeFor, pane.querySelector(".doc-src-bar span:last-child").textContent]).toEqual(["doc-src", ...Array(2).fill(live.closest("[data-example]").dataset.example)]);
    expect(code).toMatch(/^ *\S[\s\S]*\S$/);
    expect(code).toMatch(/(^|\n)\S/);
    expect(code.replace(/\s+/g, " ").trim()).toBe(live.innerHTML.replace(/\s+/g, " ").trim());
  }
  const pane = lives[0].nextElementSibling, pre = pane.querySelector("pre"), [toggle, copy] = pane.querySelectorAll("button");
  const state = () => [pre.hidden, toggle.getAttribute("aria-expanded"), copy.textContent];
  expect(state()).toEqual([true, "false", "copy"]);
  toggle.click();
  expect(state()).toEqual([false, "true", "copy"]);
  toggle.click();
  copy.click();
  await Bun.sleep(5);
  expect([...state(), await docs.navigator.clipboard.readText()]).toEqual([true, "false", "copied", pre.textContent]);
  docs.t[1400]();
  docs.navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  copy.click();
  await Bun.sleep(5);
  expect([...state(), docs.getSelection().toString()]).toEqual([false, "true", "press ⌘C", pre.textContent]);
  docs.t[1400]();
  expect(copy.textContent).toBe("copy");
});

test("docs: the token reference is built from ui.css — every :root token a row, dark-unchanged ones marked", async () => {
  const root = new Set(css.replace(/\/\*[\s\S]*?\*\//g, "").match(/:root \{[^}]*\}/)![0].match(/--ui-[\w-]+(?=\s*:)/g));
  const rows = docs.$("[data-token-reference] tbody tr[data-token]"), same = docs.$("[data-token-reference] td.is-same");
  const [, shown, reassigned] = docs.document.getElementById("token-reference-count").textContent.match(/^(\d+) tokens — every --ui-\* declared on :root in \.\.\/ui\.css; the dark blocks reassign (\d+) of them\.$/);
  expect([rows.length, +shown, same.length, docs.$(".doc-tokref-error").length]).toEqual([root.size, root.size, root.size - +reassigned, 0]);
  expect(rows.map((r) => r.firstChild.textContent).sort()).toEqual([...root].sort());
  expect(docs.$(".doc-tokref-family").map((r) => r.id).join()).toBe("token-surfaces,token-accent,token-semantic,token-spacing,token-type,token-depth");
  expect(same.every((td) => td.title === "unchanged in dark" && td.parentElement.children[1].textContent === td.textContent)).toBe(true);
  const bg = docs.document.querySelector("tr[data-token='--ui-bg']");
  expect([bg.querySelectorAll(".doc-tokref-chip > i").length, bg.querySelector("td.is-same"), cls([docs.document.querySelector("tr[data-token='--ui-space-1'] td:last-child")], "is-same")]).toEqual([2, null, "1"]);
  const failed = await load("docs", "", 404);
  expect([failed.$("[data-token-reference] tbody tr").map((r) => r.className + ":" + r.textContent).join(), failed.document.getElementById("token-reference-count").textContent]).toEqual(["doc-tokref-error:could not read ../ui.css — 404 . The table is empty rather than wrong.", "token count unavailable"]);
});

test("docs: the index rail marks the first section in nav order that is in view", () => {
  const links = docs.$(".doc-nav a[href^='#']");
  expect(docs.t.observed).toEqual(links.map((a) => a.hash.slice(1)).filter((id) => docs.document.getElementById(id)));
  const spy = (on: boolean, ...ids: string[]) => (docs.t.spy(ids.map((id) => ({ isIntersecting: on, target: { id } }))), docs.$(".doc-nav a[aria-current]").map((a) => a.hash).join());
  expect(spy(true, "theming", "tokens")).toBe("#tokens");
  expect(spy(false, "tokens")).toBe("#theming");
  expect(spy(false, "theming")).toBe("");
});

test("docs: latch, list, orb and meter examples breathe", () => {
  const latch = docs.$("[data-doc-latch] .btn"), rows = docs.$("[data-doc-list] .listrow"), orbs = docs.$("[data-doc-orb] .orb"), meters = docs.$("[data-doc-meter] .meter");
  latch[1].click();
  latch[1].parentElement.click();
  rows[4].querySelector("span").click();
  for (const orb of orbs) orb.click();
  docs.t[1200]();
  expect([cls(latch, "is-on"), cls(rows, "is-current"), at(rows, "aria-selected"), at(orbs, "aria-pressed"), at(orbs, "aria-label"), meters.map((m) => m.style.getPropertyValue("--ui-meter-value")).join()])
    .toEqual(["010", "00001", "false,false,false,false,true", "true,false,true", "microphone muted,microphone open,microphone muted", "54%,88%,97%"]);
});

test.each(["docs", "demo"])("%s: the icon gallery is the inline sprite, one cell per glyph", (page) => {
  const w = pages[page], ids = w.$("symbol[id^='ph-']").map((s) => s.id);
  expect(w.$("#icon-grid > div").map((c) => `${c.className} ${c.querySelector("svg.icon[aria-hidden=true] use").getAttribute("href")} ${c.textContent}`)).toEqual(ids.map((id) => `${page === "docs" ? "doc" : "demo"}-icon #${id} ${id.slice(3)}`));
  expect(ids.length).toBe(28);
});

test("docs: __uiDocs.resolve reads the carrier attributes around an element", () => {
  const { resolve } = docs.__uiDocs, q = (s: string) => docs.document.querySelector(s);
  expect(resolve(q("[data-token='--ui-bg'] span"))).toEqual({ component: "tokens", example: "tokens-palette", section: "tokens", token: "--ui-bg", markup: q("[data-example='tokens-palette'] pre code").textContent });
  expect(resolve(q("tr[data-class='eyebrow'] td"))).toEqual({ component: "type", example: null, section: "type", class: "eyebrow" });
  expect([resolve(q(".doc-nav")), resolve(q("[data-live]").firstChild), resolve({})]).toEqual([null, null, null]);
});

test("demo: latch, pause toggles, orb, hide toggle", () => {
  const latch = demo.$("[data-demo-latch] .btn"), toggles = demo.$("[data-demo-toggle-on]"), orb = demo.document.getElementById("orb"), hide = demo.document.getElementById("hide-toggle");
  latch[2].click();
  for (const b of toggles) b.click();
  toggles[0].click();
  orb.click();
  hide.click();
  const subjects = demo.$("#hide-subjects > *, #hide-panel, #hide-strip");
  expect([cls(latch, "is-on"), cls(toggles, "is-on"), toggles.map((b) => b.lastChild.nodeValue).join(), at([orb], "aria-pressed") + at([orb], "aria-label"), hide.getAttribute("aria-pressed") + hide.textContent, subjects.map((s) => +s.hidden).join("")])
    .toEqual(["001", "01", "pause,resume", "truemicrophone muted", "trueshow them", "1111"]);
  hide.click();
  expect([hide.textContent, subjects.map((s) => +s.hidden).join("")]).toEqual(["hide them", "0000"]);
});

test("demo: the voice list's arrows step from the focused row, wrap, and skip disabled rows; clicks skip them too", () => {
  const list = demo.document.getElementById("voice-list"), rows = [...list.children];
  const key = (key: string, from: number) => {
    rows[from].focus();
    const e = new demo.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
    list.dispatchEvent(e);
    return [e.defaultPrevented, rows.indexOf(demo.document.activeElement), at(rows, "aria-selected"), cls(rows, "is-current")].join(" ");
  };
  expect(key("ArrowUp", 4)).toBe("true 3 false,false,false,true,false 00010");
  expect(key("ArrowDown", 3)).toBe("true 0 true,false,false,false,false 10000");
  expect(key("ArrowUp", 0)).toBe("true 3 false,false,false,true,false 00010");
  expect(key("Enter", 1)).toBe("false 1 false,false,false,true,false 00010");
  rows[4].click();
  rows[1].querySelector("span").click();
  expect(cls(rows, "is-current")).toBe("01000");
});

test("demo: live data ticks every 1200 ms; the strip's mood, badge and message cycle every 3600 ms", () => {
  const id = (s: string) => demo.document.getElementById(s), strip = () => [id("live-strip").className, id("live-strip-badge").className, id("live-strip-badge").textContent, id("live-strip-msg").textContent].join("|");
  demo.t[1200]();
  expect([id("tick").textContent, id("seq").textContent, id("orb-metric").textContent, id("d-buf").style.getPropertyValue("--ui-meter-value")].join()).toBe("1,1042,168,54%");
  demo.t[3600]();
  expect(strip()).toBe("strip strip-info|badge badge-info|info|replaying fixture kitchen-evening.jsonl · seq 1042");
  for (const _ of "abc") demo.t[3600]();
  expect(strip()).toBe("strip strip-ok|badge badge-ok|ok|connected · 8 channels · seq 1042");
});
