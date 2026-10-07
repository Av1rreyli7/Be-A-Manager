// Layout checks for the Floodlights page in a real browser. Run: node tests-site/test_layout.js
// Boots a standalone Floodlights server on its own save file, starts a game over the API, then opens the page
// in headless Chrome and measures what was really drawn: every lineup formation (no shirt card overlaps
// another, the rating chip sits under its shirt, one clean number), the bench rows (the rating never touches
// the name or the buttons, one rating column), and every rating column in the squad, market and scout tables
// (one number, no second number, numbers right aligned to the pixel). It does this at desktop, laptop,
// small laptop and phone widths. LAYOUT_SHOTS=<folder> also saves a screenshot of each screen and width.
// Needs Google Chrome; without it the checks are skipped (and say so) so the rest of the test run still works.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const PORT = process.env.LAYOUT_TEST_PORT || "3478";
const DEBUG_PORT = process.env.LAYOUT_DEBUG_PORT || "9338";
const BASE = "http://localhost:" + PORT;
const SHOTS = process.env.LAYOUT_SHOTS || "";
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
const WIDTHS = [[1440, 900, "desktop"], [1280, 800, "laptop"], [1024, 768, "small"], [390, 844, "phone"]];

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 400)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(route, body) {
  const r = await fetch(BASE + route, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  return r.json();
}
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not up yet */ } await sleep(150); }
  return false;
}

// a tiny DevTools protocol client over the built in WebSocket
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const waiting = new Map();
  ws.onmessage = m => {
    const j = JSON.parse(m.data);
    if (j.id && waiting.has(j.id)) { const w = waiting.get(j.id); waiting.delete(j.id); j.error ? w.reject(new Error(j.error.message)) : w.resolve(j.result); }
  };
  const open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params) => open.then(() => new Promise((resolve, reject) => { const n = ++id; waiting.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params: params || {} })); }));
  return { send, close: () => ws.close() };
}

async function main() {
  if (!CHROME) { console.log("test_layout: Google Chrome not found, layout checks skipped"); console.log("passed 0, failed 0"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fl-layout-"));
  const save = path.join(tmp, "games.json");
  const server = spawn("node", [path.join(root, "floodlights", "server.js")], { env: Object.assign({}, process.env, { PORT, FL_SAVE_FILE: save }), stdio: "ignore" });
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + DEBUG_PORT, "--user-data-dir=" + path.join(tmp, "chrome"), "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
  const stop = () => { try { server.kill(); } catch (e) {} try { chrome.kill(); } catch (e) {} };
  process.on("exit", stop);
  // a hung Chrome must fail the run, never stall it: the whole check normally takes well under a minute
  const guard = setTimeout(() => { console.log("FAIL: layout run timed out after 240 s (headless Chrome stopped answering)"); console.log("passed " + passed + ", failed " + (failed + 1)); stop(); process.exit(1); }, 240000);
  guard.unref();
  try {
    ok("the Floodlights server starts", await waitFor(async () => (await fetch(BASE + "/floodlights/")).ok, 15000), null);
    ok("headless Chrome starts", await waitFor(async () => (await fetch("http://127.0.0.1:" + DEBUG_PORT + "/json/version")).ok, 15000), null);
    // a fresh game: one manager at a mid table club, season started
    const c = await api("/api/create", { name: "Lay" });
    await api("/api/pick", { code: c.code, name: "Lay", team: "Arsenal" });
    await api("/api/start", { code: c.code, name: "Lay" });
    const list = await (await fetch("http://127.0.0.1:" + DEBUG_PORT + "/json/list")).json();
    const page = list.find(t => t.type === "page");
    const P = cdp(page.webSocketDebuggerUrl);
    await P.send("Page.enable");
    await P.send("Runtime.enable");
    const evalIn = async (expr) => {
      const r = await P.send("Runtime.evaluate", { expression: "(async () => {" + expr + "})()", awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    };
    const shot = async (name) => {
      if (!SHOTS) return;
      fs.mkdirSync(SHOTS, { recursive: true });
      const r = await P.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(r.data, "base64"));
    };
    await P.send("Page.navigate", { url: BASE + "/floodlights/" });
    await sleep(1200);
    await evalIn(`localStorage.setItem("fl_name", "Lay"); localStorage.setItem("fl_code", ${JSON.stringify(c.code)}); return 1;`);

    // shared page helpers: close popups, finish every running animation, open a tab
    const HELP = `
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const settle = () => { if (window.gsap) window.gsap.globalTimeline.getChildren(true, true, true).forEach(t => t.progress(1)); };
      const closeAll = async () => { for (let i = 0; i < 10; i++) { const b = [...document.querySelectorAll("button")].find(b => b.offsetParent && /^(next|got it|close|ok|later|done)$/i.test(b.textContent.trim())); if (!b) break; b.click(); await sleep(250); } };
      const tab = async (label) => { const b = [...document.querySelectorAll("nav button, button")].find(b => b.textContent.trim().toLowerCase() === label.toLowerCase()); if (b) b.click(); await sleep(500); settle(); };
      const box = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const hit = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
      const union = (a, b) => ({ l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) });
      const faceOk = rt => { const n = rt.querySelectorAll(".rtn"), a = rt.querySelectorAll(".rta"); return n.length === 1 && a.length === 1 && /^[1-9][0-9]$/.test(n[0].textContent) && /^[\\u25b2\\u25bc]?$/.test(a[0].textContent) && (rt.classList.contains("flat") === (a[0].textContent === "")); };
      // one rating column: every number ends on the same pixel and every row holds exactly one face
      const column = (sel) => {
        const cells = [...document.querySelectorAll(sel)].filter(td => td.offsetParent);
        const faces = cells.map(td => td.querySelectorAll(".rt"));
        const rights = cells.map(td => { const n = td.querySelector(".rt .rtn"); return n ? Math.round(n.getBoundingClientRect().right * 2) / 2 : null; });
        const tall = cells.filter(td => { const rt = td.querySelector(".rt"); return rt && rt.getBoundingClientRect().height > 20; }).length;
        const extra = cells.filter(td => td.textContent.replace(/[\\u25b2\\u25bc]/g, "").trim().length > 2).length;
        return { rows: cells.length, single: faces.every(f => f.length === 1), clean: cells.every(td => { const rt = td.querySelector(".rt"); return rt && faceOk(rt); }), spread: rights.length ? Math.max(...rights) - Math.min(...rights) : 0, tall, extra };
      };
    `;
    for (const [w, h, label] of WIDTHS) {
      await P.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
      await P.send("Page.reload", { ignoreCache: true });
      await sleep(2600);
      const ready = await evalIn(HELP + `await closeAll(); return !!(window.STATE || document.querySelector("#tab-squad"));`);
      ok(label + ": the club page loads", ready, null);

      // ---- lineup: every formation ----
      const lu = await evalIn(HELP + `
        await tab("Lineup");
        const out = [];
        for (const f of Object.keys(FORMATIONS)) {
          luSetFormation(f); await sleep(120);
          document.getElementById("autoPick").click(); await sleep(350); settle(); await sleep(60);
          const pitch = box(document.getElementById("pitch"));
          const slots = [...document.querySelectorAll("#pitch .luslot.lufilled")].map(sl => {
            const sh = sl.querySelector(".lushirt"), tg = sl.querySelector(".lutag"), rt = tg && tg.querySelector(".rt");
            const a = box(sh), b = tg ? box(tg) : a;
            return { shirt: a, tag: b, card: union(a, b), face: !!rt && faceOk(rt), nums: tg ? tg.querySelectorAll(".rtn").length : 0,
              below: !!tg && b.t >= a.b - 6, centred: !!tg && Math.abs((b.l + b.r) / 2 - (a.l + a.r) / 2) < 2, num: (sh.querySelector(".shnum") || {}).textContent || "", name: (sh.querySelector(".shn") || {}).textContent || "" };
          });
          let clash = [];
          for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) if (hit(slots[i].card, slots[j].card)) clash.push([i, j]);
          out.push({ f, n: slots.length, clash, inside: slots.every(s => s.card.l >= pitch.l - 2 && s.card.r <= pitch.r + 2 && s.card.t >= pitch.t - 8 && s.card.b <= pitch.b + 2),
            faces: slots.every(s => s.face && s.nums === 1), below: slots.every(s => s.below && s.centred), shirts: slots.every(s => s.num !== "" && s.name !== ""), w: Math.round(slots[0] ? slots[0].shirt.w : 0) });
        }
        luSetFormation("4-3-3"); await sleep(120); document.getElementById("autoPick").click(); await sleep(350); settle();
        document.getElementById("pitch").scrollIntoView({ block: "center" });
        return out;`);
      for (const r of lu) {
        ok(label + " lineup " + r.f + ": eleven shirts on the pitch", r.n === 11, r.n);
        ok(label + " lineup " + r.f + ": no shirt card overlaps another", r.clash.length === 0, r.clash);
        ok(label + " lineup " + r.f + ": every card stays on the pitch", r.inside, null);
        ok(label + " lineup " + r.f + ": one clean rating per chip", r.faces, null);
        ok(label + " lineup " + r.f + ": the chip sits centred under its shirt", r.below, null);
        ok(label + " lineup " + r.f + ": every shirt has a surname and a number", r.shirts, null);
      }
      ok(label + ": shirts are a readable size", lu.every(r => r.w >= 36 && r.w <= 58), lu.map(r => r.w));
      await shot(label + "_lineup");

      const bench = await evalIn(HELP + `
        const rows = [...document.querySelectorAll("#subList .benchrow, #poolList .benchrow")].filter(r => r.offsetParent);
        const bad = rows.filter(r => { const rt = r.querySelector(".brt .rt"), bn = r.querySelector(".bn"), ba = r.querySelector(".ba"); if (!rt || !bn) return true; const a = box(rt), ns = [...bn.querySelectorAll(".bnm, .bmeta > *")].map(box); return ns.some(n => hit(a, n)) || (ba && [...ba.children].some(c => hit(a, box(c)))) || a.h > 20; }).length;
        const rights = rows.map(r => { const n = r.querySelector(".brt .rtn"); return n ? Math.round(n.getBoundingClientRect().right) : null; }).filter(x => x !== null);
        const faces = rows.every(r => r.querySelectorAll(".rt").length === 1 && faceOk(r.querySelector(".rt")));
        const oneLine = rows.every(r => { const n = r.querySelector(".bnm"); return n && n.getBoundingClientRect().height < 22; });
        return { n: rows.length, bad, spread: rights.length ? Math.max(...rights) - Math.min(...rights) : 0, faces, oneLine };`);
      ok(label + ": bench and reserve rows are drawn", bench.n >= 9, bench.n);
      ok(label + ": a bench rating never touches the name or the buttons", bench.bad === 0, bench);
      ok(label + ": bench ratings line up in one column", bench.spread <= 1, bench);
      ok(label + ": one clean rating per bench row and the name on one line", bench.faces && bench.oneLine, bench);

      // ---- squad table ----
      const sq = await evalIn(HELP + `
        await tab("Squad"); await sleep(200); settle();
        const head = [...document.querySelectorAll("#tab-squad thead th")].map(th => th.textContent.trim());
        const idx = head.indexOf("OVR") + 1;
        return { head, col: column("#squadBody tr > td:nth-child(" + idx + ")") };`);
      ok(label + ": the squad table has one rating column and no second Eff number", sq.head.includes("OVR") && !sq.head.includes("Eff"), sq.head);
      ok(label + ": squad OVR column is one clean number per row, aligned", sq.col.rows >= 11 && sq.col.single && sq.col.clean && sq.col.spread <= 1 && sq.col.tall === 0 && sq.col.extra === 0, sq.col);
      await shot(label + "_squad");

      // ---- transfer market ----
      const mk = await evalIn(HELP + `
        await tab("Transfer market");
        for (let i = 0; i < 40 && !document.querySelector("#marketBody td.rat"); i++) await sleep(200);
        await sleep(300); settle();
        document.getElementById("tab-market").scrollIntoView();
        return column("#marketBody td.rat");`);
      ok(label + ": the market RAT column is one clean number per row", mk.rows >= 10 && mk.single && mk.clean && mk.tall === 0 && mk.extra === 0, mk);
      ok(label + ": market ratings are right aligned to the pixel", mk.spread <= 1, mk);
      const ic = await evalIn(HELP + `
        const head = [...document.querySelectorAll("#tab-market thead th")].map(th => th.textContent.trim());
        const idx = head.indexOf("Interest") + 1;
        const cells = [...document.querySelectorAll("#marketBody tr > td:nth-child(" + idx + ")")].filter(td => td.offsetParent);
        const chips = cells.map(td => td.querySelectorAll(".ichip:not(.none)"));
        const lefts = chips.filter(c => c.length === 1).map(c => Math.round(c[0].getBoundingClientRect().left));
        const labels = chips.filter(c => c.length === 1).map(c => c[0].textContent.trim());
        const rat = [...document.querySelectorAll("#marketBody td.rat")].filter(td => td.offsetParent).map(box);
        const clash = cells.filter((td, i) => { const c = td.querySelector(".ichip"); return c && rat[i] && hit(box(c), rat[i]); }).length;
        return { idx, rows: cells.length, one: chips.every(c => c.length <= 1), withChip: lefts.length, spread: lefts.length ? Math.max(...lefts) - Math.min(...lefts) : 0, labels: [...new Set(labels)], tall: chips.filter(c => c.length && c[0].getBoundingClientRect().height > 22).length, clash };`);
      ok(label + ": the market has an Interest column with one chip per player", ic.idx > 0 && ic.one && ic.withChip >= ic.rows - 2 && ic.rows >= 10, ic);
      ok(label + ": interest chips line up, stay one line and never touch the rating", ic.spread <= 1 && ic.tall === 0 && ic.clash === 0, ic);
      ok(label + ": interest labels are the four levels", ic.labels.length >= 1 && ic.labels.every(l => ["Very Low", "Low", "Medium", "High"].includes(l)), ic.labels);
      await shot(label + "_market");
    }
    P.close();
  } finally {
    stop();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* chrome may still hold files */ }
  }
  console.log("passed " + passed + ", failed " + failed);
  if (failed) process.exitCode = 1;
}
main().catch(e => { console.log("FAIL: layout run crashed", e.message); console.log("passed " + passed + ", failed " + (failed + 1)); process.exitCode = 1; process.exit(1); });
