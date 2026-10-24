// PRIZE FIGHTER soak: three full 12 round fights back to back in one page of headless Chrome (production build),
// the computer playing both corners, watching for anything that grows when it should not (JS memory after a
// collection, the renderer's geometries, textures and shader programs, page elements) and for frame times that get
// worse as the night goes on. Any console error fails it too.
// Headless Chrome draws with a software GPU, so its frame times are only compared with each other (the start of the
// night against the end), never read as real frames per second.
// Run: npm run build, then node tests-site/test_prize_soak.js   (about 25 minutes; PF_SOAK_SPEED=<n> to change)
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const PORT = process.env.PF_SOAK_PORT || "3492";
const BASE = "http://localhost:" + PORT;
const SPEED = Math.max(1, Math.min(12, Number(process.env.PF_SOAK_SPEED) || 6));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-soak-"));
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
// evenly matched pairs that usually go the distance; a stoppage does not count as a full fight and the night goes on
const BOUTS = [["mayweather", "pacquiao"], ["leonard", "hearns"], ["usyk", "lewis"], ["lomachenko", "crawford"], ["ali", "holyfield"], ["delahoya", "chavez"]];
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 600)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server = null, chrome = null, ws, msgId = 0;
const pending = new Map();
const errors = [];
function stopAll() {
  try { if (server) server.kill(); } catch (e) { /* gone */ }
  try { if (chrome) chrome.kill(); } catch (e) { /* gone */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* the system clears it later */ }
}
async function waitFor(fn, ms, every) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { /* not yet */ } await sleep(every || 250); }
  return false;
}
function cdp(method, params) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("timeout " + method)); } }, 120000);
  });
}
async function run(js) {
  const r = await cdp("Runtime.evaluate", { expression: "(async () => {" + js + "})()", awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}
/** memory after a full collection, the renderer's counts and the page's size */
async function measure() {
  await cdp("HeapProfiler.collectGarbage");
  await sleep(300);
  await cdp("HeapProfiler.collectGarbage");
  const heap = (await cdp("Runtime.getHeapUsage")).usedSize;
  const rest = await run(`const g = window.__pfGL; return { geo: g ? g.info.memory.geometries : -1, tex: g ? g.info.memory.textures : -1, prog: g && g.info.programs ? g.info.programs.length : -1, nodes: document.getElementsByTagName("*").length, q: window.__PF.quality };`);
  return Object.assign({ heapMB: Math.round(heap / 104857.6) / 10 }, rest);
}
/** the median and the slow end of frame times over a few seconds, measured in the page */
async function frames(ms) {
  return run(`return await new Promise(res => { const t = []; let last = performance.now(); const end = last + ${ms};
    const f = now => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ n: t.length, med: t[Math.floor(t.length / 2)], p95: t[Math.floor(t.length * 0.95)] }); } };
    requestAnimationFrame(f); });`);
}

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) { console.log("No production build found. Run npm run build first."); process.exit(1); }
  if (!CHROME) { console.log("test_prize_soak: Google Chrome not found, skipped"); console.log("0 passed, 0 failed"); return; }
  process.on("exit", stopAll);
  server = spawn("node", ["server.js"], { cwd: root, env: Object.assign({}, process.env, { PORT, NODE_ENV: "production", FL_SAVE_FILE: path.join(tmp, "games.json") }), stdio: "ignore" });
  if (!await waitFor(async () => (await fetch(BASE + "/healthz")).ok, 40000)) throw new Error("the server did not start");
  const dport = 9900 + Math.floor(Math.random() * 90);
  chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + dport, "--user-data-dir=" + path.join(tmp, "chrome"), "--no-first-run", "--no-default-browser-check", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--enable-precise-memory-info", "--window-size=1280,800", "about:blank"], { stdio: "ignore" });
  let list = null;
  for (let k = 0; k < 80 && !list; k++) { try { const l = await (await fetch("http://127.0.0.1:" + dport + "/json/list")).json(); if (l.find(t => t.type === "page")) list = l; } catch (e) { /* starting */ } await sleep(250); }
  if (!list) throw new Error("Chrome did not start");
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = m => {
    const j = JSON.parse(m.data);
    if (j.id && pending.has(j.id)) { const p = pending.get(j.id); pending.delete(j.id); j.error ? p.rej(new Error(j.error.message)) : p.res(j.result); return; }
    if (j.method === "Runtime.exceptionThrown") errors.push("exception " + (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text).slice(0, 300));
    if (j.method === "Runtime.consoleAPICalled" && (j.params.type === "error" || j.params.type === "assert")) errors.push("console " + j.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    if (j.method === "Log.entryAdded" && j.params.entry.level === "error") errors.push("log " + j.params.entry.text.slice(0, 300));
  };
  await cdp("Runtime.enable");
  await cdp("Log.enable");
  await cdp("Page.enable");
  // a headless window can count as covered on macOS, which would stop animation frames: keep the page visible and focused
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  // Medium graphics: shadows and the full crowd, the level most laptops get
  await cdp("Page.navigate", { url: BASE + "/prize-fighter?pftest=1&auto&skipintro&gfx=1&fixed&rounds=12&sec=180&speed=" + SPEED });
  if (!await waitFor(() => run(`return !!(window.__PF && window.__PF.screen === "entry" && Array.isArray(window.__PF.roster));`), 30000)) throw new Error("the page did not come up");
  console.log(`soak: three full 12 round fights, three minute rounds, ${SPEED}x speed, Medium graphics`);

  const samples = [];
  let full = 0, bouts = 0, first = null, startFrames = null, lastFrames = null;
  const t0 = Date.now();
  while (full < 3 && bouts < BOUTS.length) {
    const [a, b] = BOUTS[bouts++];
    await run(`window.__PF.go("fight", ${JSON.stringify(a)}, ${JSON.stringify(b)}); return 1;`);
    await waitFor(() => run(`const P = window.__PF; return !!(P.st && P.st.defs[0].id === ${JSON.stringify(a)} && P.world);`), 30000);
    let lastRound = 0;
    for (;;) {
      const s = await run(`const P = window.__PF; if (!P.st) return null; const f = P.st.f; return { round: P.st.round, phase: P.st.phase, overlay: P.overlay, ok: f.every(x => Number.isFinite(x.headHP) && Number.isFinite(x.x) && Number.isFinite(x.stamina)), res: P.st.result ? P.st.result.how : null };`);
      if (!s) throw new Error("the fight went away");
      if (!s.ok) { ok("the numbers stay real all night", false, s); break; }
      if (s.round !== lastRound && s.phase === "fight") {
        lastRound = s.round;
        // frame times in the first fight's early rounds and in every fight's last rounds
        if (s.round === 2 && !startFrames) {
          startFrames = await frames(4000);
          first = await measure();
          console.log(`  start of the night (fight 1 round 2): frames ${JSON.stringify(startFrames)} ${JSON.stringify(first)}`);
        }
        if (s.round >= 11) lastFrames = await frames(3000);
        if (s.round % 3 === 0) {
          const m = await measure();
          samples.push(Object.assign({ bout: bouts, round: s.round, min: Math.round((Date.now() - t0) / 6000) / 10 }, m));
        }
      }
      if (s.phase === "over" || s.overlay === "result") {
        const rounds = await run(`return window.__PF.st.rounds.length;`);
        const how = await run(`return window.__PF.st.result ? window.__PF.st.result.how : "?";`);
        const went = rounds >= 12 && !["ko", "tko"].includes(String(how).toLowerCase());
        if (went) full++;
        console.log(`  fight ${bouts}: ${a} against ${b}, ${rounds} rounds, ${how}${went ? " (full fight " + full + " of 3)" : " (stopped early, another fight follows)"}, ${Math.round((Date.now() - t0) / 60000)} minutes in`);
        break;
      }
      if (Date.now() - t0 > 80 * 60000) throw new Error("the soak ran past 80 minutes");
      await sleep(1500);
    }
    await waitFor(() => run(`return window.__PF.overlay === "result";`), 20000);
  }
  ok("three full 12 round fights back to back", full >= 3, { full, bouts });
  // the night is over: back to the menus and measure what is left
  await run(`const b = document.querySelector("[data-pf=newfight]"); if (b) b.click(); return 1;`);
  await waitFor(() => run(`return window.__PF.screen === "select";`), 15000);
  await sleep(2000);
  const end = await measure();
  console.log("  samples: " + samples.map(s => `[${s.bout}:${s.round} ${s.heapMB}MB g${s.geo} t${s.tex} p${s.prog} n${s.nodes}]`).join(" "));
  console.log(`  end of the night (back on quick fight): ${JSON.stringify(end)}, last rounds frames ${JSON.stringify(lastFrames)}`);
  const steps = await run(`return (window.__PF.guardLog || []).length;`);
  ok("the graphics level stayed where it was set all night (so the start and the end compare like with like)", steps === 0 && samples.every(x => x.q === 1), [await run(`return window.__PF.guardLog;`), samples.map(x => x.q)]);
  const inFight = samples.filter(s => s.bout === bouts);
  const lastFight = inFight[inFight.length - 1] || samples[samples.length - 1];
  ok("memory after the third fight is about where it was in the first", !!first && !!lastFight && lastFight.heapMB < first.heapMB * 1.35 + 25, { first: first && first.heapMB, last: lastFight && lastFight.heapMB });
  ok("the renderer holds no more geometries or textures than in the first fight", !!first && !!lastFight && lastFight.geo <= first.geo + 12 && lastFight.tex <= first.tex + 4, { first, lastFight });
  ok("no new shader programs pile up", !!first && !!lastFight && lastFight.prog <= first.prog + 4, { first: first && first.prog, last: lastFight && lastFight.prog });
  ok("the page does not keep gaining elements", !!first && !!lastFight && lastFight.nodes <= first.nodes + 150, { first: first && first.nodes, last: lastFight && lastFight.nodes });
  // the same fight screen at the start and the end: the median frame must not slip by more than a quarter
  ok("frame times at the end of the night are no worse than at the start (relative, headless)", !!startFrames && !!lastFrames && lastFrames.med <= startFrames.med * 1.25 + 2, { startFrames, lastFrames });
  ok("no console errors all night", errors.length === 0, errors.slice(0, 6));
  console.log(passed + " passed, " + failed + " failed");
  stopAll();
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("FAIL: the soak stopped: " + e.message); console.log(passed + " passed, " + (failed + 1) + " failed"); stopAll(); process.exit(1); });
