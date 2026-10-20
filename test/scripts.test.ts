// The page scripts, run for real over happy-dom: each page's own HTML, theme.js then its
// script evaluated in that window, timers ticked by hand, storage working or blocked.
import { expect, test } from "bun:test";
import { Window } from "happy-dom";

const read = (path: string) => Bun.file(`${import.meta.dir}/../${path}`).text();
const settle = () => new Promise(setImmediate);
const css = await read("ui.css");
const load = async (page: string, store: string | null = null, sheet = css, status = 200) => {
  const html = await read(`${page}/index.html`);
  const w: any = new Window({ url: `http://ui.test/${page}/` });
  const fake: any = { observed: [] };
  w.addEventListener("error", (e: any) => (fake.error = e.error));
  Object.assign(w, {
    fetch: async (url: string, init: any) => ((fake.fetched = `${url} ${init.cache}`), new Response(sheet, { status })),
    IntersectionObserver: class { constructor(f: Function) { fake.spy = f; } observe(s: any) { fake.observed.push(s.id); } },
    setInterval: (f: Function, ms: number) => (fake[ms] = f),
    setTimeout: (f: Function, ms: number) => (fake[ms] = f),
  });
  if (store === null) Object.defineProperty(w, "localStorage", { get: () => { throw new Error("SecurityError"); } });
  else w.localStorage.setItem("ui-theme", store);
  // theme.js runs where <head> loads it, before <body> is parsed — so before the buttons exist.
  const [top, rest] = html.replace(/<script[\s\S]*?<\/script>/g, "").split("</head>");
  w.document.write(top);
  w.eval(await read("docs/theme.js"));
  // What <head> leaves on <html> before any page script: the stored theme, or no flash fix.
  const head = w.document.documentElement.getAttribute("data-theme");
  w.document.write(rest);
  w.eval(page === "docs" ? await read("docs/docs.js") : html.match(/<script>([\s\S]*?)<\/script>/)![1]);
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  await settle();
  return Object.assign(w, { $: (s: string) => [...w.document.querySelectorAll(s)], fake, head });
};
const pages: Record<string, any> = { demo: await load("demo"), docs: await load("docs") };
const { docs, demo } = pages;
// Stored dark, and a ui.css with no attribute dark block (the media twin must stand in) and one dark-only token.
const stored: Record<string, any> = {
  demo: await load("demo", "dark"),
  docs: await load("docs", "dark", "/* :root { --ui-cc: 0 } */ .x:root { --ui-cc: 0 }" + css.replace(':root[data-theme="dark"]', ":root[data-x]").replace('[data-theme="light"]) {', '[data-theme="light"]) { --ui-zz: 1px;')),
};
const attrs = (els: any[], k: string) => els.map((e) => e.getAttribute(k)).join();
const flags = (els: any[], c: string) => els.map((e) => +e.classList.contains(c)).join("");

test.each(["docs", "demo"])("%s: a stored theme applies, buttons press, auto removes; blocked storage costs only persistence", (page) => {
  for (const [w, store] of [[stored[page], "dark"], [pages[page], null]]) {
    const state = () => [w.document.documentElement.getAttribute("data-theme"), store && w.localStorage.getItem("ui-theme"), attrs(w.$("[data-theme-set]"), "aria-pressed")];
    expect([w.head, ...state()]).toEqual([store, store, store, store ? "false,false,true" : "false,true,false"]);
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
    const pane = live.nextElementSibling, code = pane.querySelector("pre > code").textContent, ex = live.closest("[data-example]").dataset.example;
    expect([pane.className, pane.dataset.codeFor, pane.querySelector(".doc-src-bar span:last-child").textContent]).toEqual(["doc-src", ex, ex]);
    expect(code).toMatch(/^ *\S[\s\S]*\S$/);
    expect(code).toMatch(/^\S/m);
    expect(code.replace(/\s+/g, " ").trim()).toBe(live.innerHTML.replace(/\s+/g, " ").trim());
  }
  expect(lives[0].nextElementSibling.firstChild.innerHTML).toBe('<button class="btn btn-quiet btn-sm" type="button" aria-expanded="false">markup</button><button class="btn btn-quiet btn-sm" type="button">copy</button><span class="spacer"></span><span>tokens-palette</span>');
  const pane = lives[0].nextElementSibling, pre = pane.querySelector("pre"), [toggle, copy] = pane.querySelectorAll("button");
  const state = () => [pre.hidden, toggle.getAttribute("aria-expanded"), copy.textContent];
  expect(state()).toEqual([true, "false", "copy"]);
  toggle.click();
  expect(state()).toEqual([false, "true", "copy"]);
  toggle.click();
  copy.click();
  await settle();
  expect([...state(), await docs.navigator.clipboard.readText(), (docs.fake[1400](), copy.textContent)]).toEqual([true, "false", "copied", pre.textContent, "copy"]);
  docs.navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  copy.click();
  await settle();
  expect([...state(), docs.getSelection().toString(), (docs.fake[1400](), copy.textContent)]).toEqual([false, "true", "press ⌘C", pre.textContent, "copy"]);
});

test("docs: the token reference is built from ui.css — every :root token a row, dark-unchanged ones marked", async () => {
  const root = new Set(css.replace(/\/\*[\s\S]*?\*\//g, "").match(/:root \{[^}]*\}/)![0].match(/--ui-[\w-]+(?=\s*:)/g));
  const rows = docs.$("[data-token-reference] tbody tr[data-token]"), same = docs.$("[data-token-reference] td.is-same");
  const [, shown, reassigned] = docs.document.getElementById("token-reference-count").textContent.match(/^(\d+) tokens — every --ui-\* declared on :root in \.\.\/ui\.css; the dark blocks reassign (\d+) of them\.$/);
  expect([rows.length, +shown, same.length, docs.$(".doc-tokref-error").length, docs.fake.fetched]).toEqual([root.size, root.size, root.size - +reassigned, 0, "../ui.css no-store"]);
  expect(rows.map((r) => r.firstChild.textContent).sort()).toEqual([...root].sort());
  expect(docs.$(".doc-tokref-family > th[colspan='3'][scope=colgroup]:only-child").map((th) => `${th.parentElement.id} ${th.textContent}`).join())
    .toBe("token-surfaces surfaces & ink,token-accent accent,token-semantic semantic,token-spacing spacing,token-type type,token-depth radius, shadow & motion");
  expect(same.every((td) => td.title === "unchanged in dark" && td.parentElement.children[1].textContent === td.textContent)).toBe(true);
  const paints = docs.$("tr[data-token='--ui-bg'] .doc-tokref-chip > i");
  expect([paints.length, paints.every((i) => i.style.background && i.parentElement.style.background === i.style.background), docs.$("tr[data-token='--ui-bg'] td.is-same").length, docs.$("tr[data-token='--ui-space-1'] .doc-tokref-chip").length, docs.$("tr[data-token='--ui-space-1'] td.is-same").length]).toEqual([2, true, 0, 0, 1]);
  const twin = stored.docs;
  expect([twin.$("[data-token-reference] td.is-same").length, twin.$(".doc-tokref-error").map((r) => r.textContent).join(), twin.document.getElementById("token-reference-count").textContent]).toEqual([same.length, "1 declared token(s) missing from this table: --ui-zz", `${root.size} of ${root.size + 1} tokens shown — see the row above.`]);
  for (const [sheet, status, why] of [[css, 404, "404"], ["", 200, "no --ui-* declarations on :root"]] as const) {
    const failed = await load("docs", "", sheet, status);
    expect([failed.$("[data-token-reference] tbody")[0].innerHTML, failed.document.getElementById("token-reference-count").textContent])
      .toEqual([`<tr class="doc-tokref-error"><td colspan="3">could not read ../ui.css — ${why}. The table is empty rather than wrong.</td></tr>`, "token count unavailable"]);
  }
});

test("docs: the index rail marks the first section in nav order that is in view", () => {
  const links = docs.$(".doc-nav a[href^='#']");
  expect(docs.fake.observed).toEqual(links.map((a) => a.hash.slice(1)).filter((id) => docs.document.getElementById(id)));
  const spy = (on: boolean, ...ids: string[]) => (docs.fake.spy(ids.map((id) => ({ isIntersecting: on, target: { id } }))), docs.$(".doc-nav a[aria-current]").map((a) => a.hash).join());
  expect(spy(true, "theming", "tokens")).toBe("#tokens");
  expect(spy(false, "tokens")).toBe("#theming");
  expect(spy(false, "theming")).toBe("");
});

test("docs: latch, list, orb and meter examples breathe; disabled rows stay unselectable", () => {
  const latch = docs.$("[data-doc-latch] .btn"), rows = docs.$("[data-doc-list] .listrow"), orbs = docs.$("[data-doc-orb] .orb"), meters = docs.$("[data-doc-meter] .meter");
  latch[1].click();
  latch[1].parentElement.click();
  rows[3].querySelector("span").click();
  rows[4].querySelector("span").click();
  for (const orb of orbs) orb.click();
  docs.fake[1200]();
  expect([flags(latch, "is-on"), flags(rows, "is-current"), attrs(rows, "aria-selected"), attrs(orbs, "aria-pressed"), attrs(orbs, "aria-label"), meters.map((m) => m.style.getPropertyValue("--ui-meter-value")).join(), docs.fake.error])
    .toEqual(["010", "00010", "false,false,false,true,false", "true,false,true", "microphone muted,microphone open,microphone muted, large", "54%,88%,97%", undefined]);
});

test.each(["docs", "demo"])("%s: the icon gallery is the inline sprite, one cell per glyph", (page) => {
  const w = pages[page], ids = w.$("symbol[id^='ph-']").map((s) => s.id);
  expect([ids.length, ...w.$("#icon-grid > div").map((c) => `${c.className} ${c.querySelector("svg.icon[aria-hidden=true] use").getAttribute("href")} ${c.textContent}`)])
    .toEqual([28, ...ids.map((id) => `${page === "docs" ? "doc" : "demo"}-icon #${id} ${id.slice(3)}`)]);
});

test("docs: __uiDocs.resolve reads the carrier attributes around an element", () => {
  const { resolve } = docs.__uiDocs, q = (s: string) => docs.document.querySelector(s);
  docs.document.body.insertAdjacentHTML("beforeend", "<figure data-example=t><div data-live>\n\t<b></b>\n   \n\t\t<i></i>\n</div></figure>");
  expect(resolve(q("[data-example=t] i"))).toStrictEqual({ component: null, example: "t", section: null, markup: "<b></b>\n \n  <i></i>" });
  expect(resolve(q("[data-token='--ui-bg'] span"))).toStrictEqual({ component: "tokens", example: "tokens-palette", section: "tokens", token: "--ui-bg", markup: q("[data-example='tokens-palette'] pre code").textContent });
  expect(resolve(q("tr[data-class='eyebrow'] td"))).toStrictEqual({ component: "type", example: null, section: "type", class: "eyebrow" });
  expect([resolve(q(".doc-nav")), resolve(q("[data-live]").firstChild)]).toEqual([null, null]);
});

test("demo: latch, pause toggles, orb, hide toggle", () => {
  const latch = demo.$("[data-demo-latch] .btn"), toggles = demo.$("[data-demo-toggle-on]"), orb = demo.document.getElementById("orb"), hide = demo.document.getElementById("hide-toggle");
  latch[2].click();
  latch[2].parentElement.click();
  for (const b of toggles) b.click();
  toggles[0].click();
  orb.click();
  hide.click();
  const subjects = demo.$("#hide-subjects > *, #hide-panel, #hide-strip");
  expect([flags(latch, "is-on"), flags(toggles, "is-on"), toggles.map((b) => b.lastChild.nodeValue).join(), orb.getAttribute("aria-pressed") + orb.getAttribute("aria-label"), hide.getAttribute("aria-pressed") + hide.textContent, subjects.map((s) => +s.hidden).join("")])
    .toEqual(["001", "01", "pause,resume", "truemicrophone muted", "trueshow them", "1111"]);
  hide.click();
  orb.click();
  expect([hide.textContent, subjects.map((s) => +s.hidden).join(""), orb.getAttribute("aria-label")]).toEqual(["hide them", "0000", "microphone open"]);
});

test("demo: the voice list's arrows step from the focused row, wrap, and skip disabled rows; clicks skip them too", () => {
  const list = demo.document.getElementById("voice-list"), rows = [...list.children];
  const key = (key: string, from: number) => {
    rows[from].focus();
    const e = new demo.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
    list.dispatchEvent(e);
    return [e.defaultPrevented, rows.indexOf(demo.document.activeElement), attrs(rows, "aria-selected"), flags(rows, "is-current")].join(" ");
  };
  expect(key("ArrowUp", 4)).toBe("true 3 false,false,false,true,false 00010");
  expect(key("ArrowDown", 3)).toBe("true 0 true,false,false,false,false 10000");
  expect(key("ArrowUp", 0)).toBe("true 3 false,false,false,true,false 00010");
  expect(key("Enter", 1)).toBe("false 1 false,false,false,true,false 00010");
  rows[1].querySelector("span").click();
  rows[4].click();
  expect(flags(rows, "is-current")).toBe("01000");
});

test("demo: live data ticks every 1200 ms; the strip's mood, badge and message cycle every 3600 ms", () => {
  const id = (s: string) => demo.document.getElementById(s), strip = () => [id("live-strip").className, id("live-strip-badge").className, id("live-strip-badge").textContent, id("live-strip-msg").textContent].join("|");
  demo.fake[1200]();
  expect([id("tick").textContent, id("seq").textContent, id("orb-metric").textContent, id("d-buf").style.getPropertyValue("--ui-meter-value")].join()).toBe("1,1042,168,54%");
  demo.fake[3600]();
  expect(strip()).toBe("strip strip-info|badge badge-info|info|replaying fixture kitchen-evening.jsonl · seq 1042");
  for (const _ of "abc") demo.fake[3600]();
  expect(strip()).toBe("strip strip-ok|badge badge-ok|ok|connected · 8 channels · seq 1042");
});
