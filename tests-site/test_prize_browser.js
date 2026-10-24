// PRIZE FIGHTER in a real browser: headless Chrome against the production build, every console message, page
// error and failed request recorded the whole time (any error fails the run).
// Run: npm run build, then node tests-site/test_prize_browser.js   (PF_SHOTS=<dir> also saves screenshots)
// Covers: the landing's way in, every screen and button, a fighter created with extreme input and every option,
// saved and still there after a reload, the quick fight screen's filters and setup, a round with every real boxer,
// every key at once, guard switches in the middle of a punch, a stance switch, pause and resume, refreshing in the
// middle of a round, a knockdown and the corner (carry on, throw away, a broken save), small and odd window sizes,
// a fight to the result, rematch and new fight, and the renderer's counts after many fights (nothing left behind).
// Needs Google Chrome; without it the checks are skipped and say so.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const PORT = process.env.PF_TEST_PORT || "3491";
const BASE = "http://localhost:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-browser-"));
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
const SHOTS = process.env.PF_SHOTS || "";
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 600)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function tidy() { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* the system clears it later */ } }

let server = null, chrome = null;
async function waitFor(fn, ms, every) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { /* not yet */ } await sleep(every || 200); }
  return false;
}
async function startServer() {
  server = spawn("node", ["server.js"], { cwd: root, env: Object.assign({}, process.env, { PORT, NODE_ENV: "production", FL_SAVE_FILE: path.join(tmp, "games.json") }), stdio: "ignore" });
  if (!await waitFor(async () => (await fetch(BASE + "/healthz")).ok, 40000)) throw new Error("the server did not start");
}

// ---------------------------------------------------------------- one Chrome, one long lived DevTools line
const log = { errors: [], warnings: [], bad: [] };
let ws, msgId = 0;
const pending = new Map();
async function launch() {
  const port = 9600 + Math.floor(Math.random() * 300);
  chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(tmp, "chrome"), "--no-first-run", "--no-default-browser-check", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
  let list = null;
  for (let k = 0; k < 80 && !list; k++) { try { const l = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json(); if (l.find(t => t.type === "page")) list = l; } catch (e) { /* starting */ } await sleep(250); }
  if (!list) throw new Error("Chrome did not start");
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = m => {
    const j = JSON.parse(m.data);
    if (j.id && pending.has(j.id)) { const p = pending.get(j.id); pending.delete(j.id); j.error ? p.rej(new Error(j.error.message)) : p.res(j.result); return; }
    const where = () => { try { return currentStep; } catch (e) { return ""; } };
    if (j.method === "Runtime.exceptionThrown") log.errors.push(where() + ": exception " + (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text).slice(0, 400));
    if (j.method === "Runtime.consoleAPICalled") {
      const text = j.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 400);
      if (j.params.type === "error" || j.params.type === "assert") log.errors.push(where() + ": console " + text);
      else if (j.params.type === "warning") log.warnings.push(where() + ": " + text);
    }
    if (j.method === "Log.entryAdded") {
      const e = j.params.entry;
      if (e.level === "error") log.errors.push(where() + ": log " + e.text.slice(0, 300) + " " + (e.url || ""));
      else if (e.level === "warning") log.warnings.push(where() + ": log " + e.text.slice(0, 300));
    }
    if (j.method === "Network.responseReceived" && j.params.response.status >= 400) log.bad.push(where() + ": " + j.params.response.status + " " + j.params.response.url);
  };
  await cdp("Runtime.enable");
  await cdp("Log.enable");
  await cdp("Page.enable");
  // a headless window can count as covered on macOS, which would stop animation frames: keep the page visible and focused
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Network.enable");
  await viewport(1440, 900);
}
function cdp(method, params) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("timeout " + method)); } }, 90000);
  });
}
async function run(js) {
  if (process.env.PF_TRACE) console.log("  run: " + js.replace(/\s+/g, " ").slice(0, 110));
  const r = await cdp("Runtime.evaluate", { expression: "(async () => {" + js + "})()", awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}
async function viewport(w, h) { await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }); }
async function open(url) { await cdp("Page.navigate", { url }); await waitFor(() => run("return document.readyState === 'complete'"), 30000); }
const KEYS = { KeyW: ["w", 87], KeyA: ["a", 65], KeyS: ["s", 83], KeyD: ["d", 68], KeyJ: ["j", 74], KeyK: ["k", 75], KeyU: ["u", 85], KeyI: ["i", 73], KeyN: ["n", 78], KeyM: ["m", 77], KeyL: ["l", 76], Semicolon: [";", 186], KeyQ: ["q", 81], KeyE: ["e", 69], Space: [" ", 32], KeyF: ["f", 70], Digit1: ["1", 49], Digit2: ["2", 50], Digit3: ["3", 51], Tab: ["Tab", 9], KeyT: ["t", 84], KeyG: ["g", 71], ShiftLeft: ["Shift", 16], Escape: ["Escape", 27], KeyP: ["p", 80], Enter: ["Enter", 13], ArrowUp: ["ArrowUp", 38], ArrowLeft: ["ArrowLeft", 37] };
async function key(code, type) {
  const [k, vk] = KEYS[code];
  await cdp("Input.dispatchKeyEvent", { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}
async function press(code, holdMs) { await key(code, "keyDown"); if (holdMs) await sleep(holdMs); await key(code, "keyUp"); }
async function shot(name) {
  if (!SHOTS) return;
  const s = await cdp("Page.captureScreenshot", { format: "png" });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, name + ".png"), Buffer.from(s.data, "base64"));
}
let currentStep = "start";
// PF_ONLY=fight,refresh runs just those parts (for working on one part; the full pass runs them all)
const ONLY = (process.env.PF_ONLY || "").split(",").filter(Boolean);
const want = name => !ONLY.length || ONLY.includes(name);
function step(name) { currentStep = name; }
const pf = expr => run("const P = window.__PF; return " + expr + ";");
/** the screens load their code on first use: wait for the screen's own content, not only the app's note of it */
const MARK = { entry: "[data-pf=quick]", select: "[data-pf=roster]", create: ".pf-create .pf-step-body" };
const onScreen = (name, ms) => waitFor(() => run(`return window.__PF && window.__PF.screen === "${name}" && !!document.querySelector("${MARK[name]}");`), ms || 15000);
/** the numbers of the fight are real numbers in range */
const SANE = `const s = window.__PF && window.__PF.st; if (!s) return "no fight"; const bad = []; for (const f of s.f) for (const k of ["x","z","headHP","bodyHP","stamina","maxStam","stun"]) if (!Number.isFinite(f[k])) bad.push(k); if (!Number.isFinite(s.clock)) bad.push("clock"); for (const f of s.f) if (f.headHP < 0 || f.headHP > 100 || f.stamina < 0 || f.stamina > 100.001) bad.push("range"); return bad.length ? bad.join(",") : "ok";`;

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) { console.log("No production build found. Run npm run build first."); process.exit(1); }
  if (!CHROME) { console.log("test_prize_browser: Google Chrome not found, checks skipped"); console.log("0 passed, 0 failed"); return; }
  const stopAll = () => { try { if (server) server.kill(); } catch (e) {} try { if (chrome) chrome.kill(); } catch (e) {} tidy(); };
  process.on("exit", stopAll);
  const guard = setTimeout(() => { console.log("FAIL: the browser pass took longer than 25 minutes (stuck at " + currentStep + ")"); console.log(passed + " passed, " + (failed + 1) + " failed"); stopAll(); process.exit(1); }, 25 * 60000);
  guard.unref();
  await startServer();
  await launch();

  // ================================================================ the landing's way in
  if (want("landing")) {
  step("landing");
  await open(BASE + "/");
  ok("the landing shows three games with PRIZE FIGHTER in the middle", await waitFor(() => run(`return [...document.querySelectorAll(".bam-card")].map(c => c.dataset.game).join() === "floodlights,prizefighter,frontoffice";`), 15000));
  await sleep(4200);
  await shot("01-landing");
  await run(`document.querySelector('[data-enter="prizefighter"]').click(); return 1;`);
  ok("ENTER PRIZE FIGHTER opens the game's entry page", await waitFor(() => run(`return location.pathname === "/prize-fighter" && !!document.querySelector(".k-title") && document.querySelector(".k-title").textContent.toUpperCase().includes("PRIZE");`), 20000));

  }
  // ================================================================ the entry
  if (want("entry")) {
  step("entry");
  await open(BASE + "/prize-fighter?pftest=1");
  ok("the entry is the Floodlights entry: brand row, title, three numbers, the panel", await waitFor(() => run(`return !!document.querySelector(".k-brand .homelink") && document.querySelectorAll(".k-stats dd").length === 3 && !!document.querySelector(".k-card [data-pf=quick]") && !!document.querySelector(".k-card [data-pf=create]") && !!document.querySelector(".k-card .k-mode");`), 20000));
  await sleep(2600);
  ok("the numbers read 27 fighters, 27 real legends, 2 modes", await run(`return [...document.querySelectorAll(".k-stats dd")].map(d => d.textContent).join() === "27,27,2";`), await run(`return [...document.querySelectorAll(".k-stats dd")].map(d => d.textContent).join();`));
  await shot("02-entry");
  await run(`document.querySelector("[data-pf=settings]").click(); return 1;`);
  ok("graphics and sound open from the entry", await waitFor(() => run(`return !!document.querySelector(".k-modal [data-pf=gfx-0]");`), 5000));
  await run(`document.querySelector("[data-pf=gfx-0]").click(); return 1;`);
  ok("a graphics level is remembered on the device", await waitFor(() => run(`return JSON.parse(localStorage.getItem("pf_settings_v1") || "{}").gfx === 0;`), 3000));
  await run(`document.querySelector("[data-pf=gfx-2]").click(); document.querySelector("[data-pf=close]").click(); return 1;`);
  ok("and the panel closes", await waitFor(() => run(`return !document.querySelector(".k-modal");`), 3000));
  await run(`document.querySelector("[data-pf=fighters]").click(); return 1;`);
  ok("Your fighters with none saved goes to the creator", await onScreen('create', 8000));

  }
  // ================================================================ the creator: extreme input and every option
  if (want("creator")) {
  step("creator");
  ok("the creator opens with its live 3D preview", await waitFor(() => run(`return !!document.querySelector(".pf-create-stage canvas") && !!document.getElementById("pfName");`), 15000));
  const EM = String.fromCharCode(8212), EN = String.fromCharCode(8211);
  const longName = "Maximilian " + EM + " Bartholomew-Okonkwo " + EN + " the Third of Everywhere \u{1F94A}\u{1F94A}";
  await run(`document.getElementById("pfName").focus(); return 1;`);
  await cdp("Input.insertText", { text: longName });
  const typed = await run(`return document.getElementById("pfName").value;`);
  ok("a very long name is held to the limit while typing", Array.from(typed).length <= 24 || typed.length <= 24, typed);
  ok("long dashes never show, not even while typing", !typed.includes(EM) && !typed.includes(EN) && !(await run(`return document.querySelector(".pf-create-plate b").textContent;`)).match(/[\u2013\u2014]/), typed);
  await run(`document.getElementById("pfNick").focus(); return 1;`);
  await cdp("Input.insertText", { text: "The Unbelievably Long Nickname Machine" });
  // every option on every step
  for (let s = 0; s < 5; s++) {
    await run(`document.querySelector("[data-pf=step-${s}]").click(); return 1;`);
    await sleep(250);
    await run(`
      const body = document.querySelector(".pf-step-body");
      const btns = [...body.querySelectorAll("button")];
      for (const b of btns) b.click();
      for (const r of body.querySelectorAll("input[type=range]")) {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(r, r.max); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const sel = body.querySelector("select");
      if (sel) { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(sel, sel.options[sel.options.length - 1].value); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      return btns.length;`);
    await sleep(400);
  }
  ok("with every slider at its top the points never go over the budget", await run(`const b = document.querySelector(".pf-budget b"); return b && Number(b.textContent) >= 0;`), await run(`return document.querySelector(".pf-budget") && document.querySelector(".pf-budget").textContent;`));
  await shot("03-creator");
  await run(`document.querySelector("[data-pf=save]").click(); return 1;`);
  ok("saving the fighter goes to quick fight with the fighter picked as you", await waitFor(() => pf("P.screen === 'select' && P.picks.me && P.picks.me.startsWith('c:')"), 10000));
  const saved = await run(`return JSON.parse(localStorage.getItem("pf_fighters_v1") || "[]");`);
  ok("the fighter is saved on the device with a clean name, every option in range", saved.length === 1 && Array.from(saved[0].name).length <= 24 && !saved[0].name.includes(EM) && !saved[0].name.includes(EN) && saved[0].nick.length <= 18 && saved[0].heightCm === 206 && saved[0].attrs && Object.values(saved[0].attrs).reduce((a, b) => a + b, 0) <= 360, saved[0]);
  // a reload: the fighter is still there
  await open(BASE + "/prize-fighter?pftest=1");
  ok("after a reload the fighter is still there (28 fighters)", await waitFor(() => run(`return [...document.querySelectorAll(".k-stats dd")].map(d => d.textContent)[0] === "28";`), 15000));
  await run(`document.querySelector("[data-pf=fighters]").click(); return 1;`);
  ok("Your fighters lists it", await waitFor(() => run(`return document.querySelectorAll(".pf-list .k-mgrow").length === 1;`), 5000));
  await run(`[...document.querySelectorAll(".pf-list .k-mgrow button")].find(b => b.textContent === "Change").click(); return 1;`);
  ok("Change opens the creator with the fighter in it", await waitFor(() => run(`return window.__PF.screen === "create" && document.getElementById("pfName").value.length > 0;`), 10000));
  await run(`document.querySelector("[data-pf=back]").click(); return 1;`);
  await onScreen('entry', 8000);
  // a second fighter, then deleted with two clicks
  await run(`document.querySelector("[data-pf=create]").click(); return 1;`);
  await waitFor(() => run(`return !!document.getElementById("pfName");`), 10000);
  await run(`document.getElementById("pfName").focus(); return 1;`);
  await cdp("Input.insertText", { text: "Second One" });
  await run(`document.querySelector("[data-pf=save]").click(); return 1;`);
  await onScreen('select', 8000);
  await run(`document.querySelector("[data-pf=back]").click(); return 1;`);
  await onScreen('entry', 8000);
  await run(`document.querySelector("[data-pf=fighters]").click(); return 1;`);
  await waitFor(() => run(`return document.querySelectorAll(".pf-list .k-mgrow").length === 2;`), 5000);
  await run(`[...document.querySelectorAll(".pf-list .k-mgrow")].find(r => r.textContent.includes("Second One")).querySelector(".k-btn-danger").click(); return 1;`);
  ok("the first click on Delete asks to be sure", await run(`return [...document.querySelectorAll(".pf-list .k-btn-danger")].some(b => b.textContent.includes("Sure"));`));
  await run(`[...document.querySelectorAll(".pf-list .k-btn-danger")].find(b => b.textContent.includes("Sure")).click(); return 1;`);
  ok("the second deletes it", await waitFor(() => run(`return JSON.parse(localStorage.getItem("pf_fighters_v1") || "[]").length === 1;`), 5000));
  await run(`document.querySelector(".pf-list .k-modal-x").click(); return 1;`);

  }
  // ================================================================ quick fight
  if (want("select")) {
  step("select");
  await run(`document.querySelector("[data-pf=quick]").click(); return 1;`);
  ok("Quick fight opens with the roster and the face off", await waitFor(() => run(`return window.__PF.screen === "select" && document.querySelectorAll("[data-pf=roster] .pf-row").length === 28 && !!document.querySelector(".pf-faceoff canvas");`), 15000));
  await run(`[...document.querySelectorAll(".pf-seg [role=tab]")][2].click(); return 1;`);
  ok("Yours shows only your fighters", await waitFor(() => run(`return document.querySelectorAll("[data-pf=roster] .pf-row").length === 1;`), 3000));
  await run(`[...document.querySelectorAll(".pf-seg [role=tab]")][1].click(); return 1;`);
  ok("Legends shows the 27 real boxers", await waitFor(() => run(`return document.querySelectorAll("[data-pf=roster] .pf-row").length === 27;`), 3000));
  await run(`const i = document.querySelector(".pf-find"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "tyson"); i.dispatchEvent(new Event("input", { bubbles: true })); return 1;`);
  ok("finding by name works (two Tysons)", await waitFor(() => run(`return document.querySelectorAll("[data-pf=roster] .pf-row").length === 2;`), 3000));
  await run(`const i = document.querySelector(".pf-find"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "zzzz nobody"); i.dispatchEvent(new Event("input", { bubbles: true })); return 1;`);
  ok("and says so when nobody matches", await waitFor(() => run(`return !!document.querySelector(".pf-empty");`), 3000));
  await run(`const i = document.querySelector(".pf-find"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, ""); i.dispatchEvent(new Event("input", { bubbles: true })); [...document.querySelectorAll(".pf-seg [role=tab]")][0].click(); return 1;`);
  await run(`document.querySelector("[data-pf=side-me]").click(); return 1;`);
  await sleep(120);
  await run(`document.querySelector('[data-id="ali"]').click(); return 1;`);
  ok("picking yourself moves on to the opponent", await waitFor(() => pf("P.picks.me === 'ali'"), 3000) && await run(`return document.querySelector("[data-pf=side-them]").classList.contains("is-on");`));
  await run(`document.querySelector('[data-id="ali"]').click(); return 1;`);
  ok("the same boxer on both sides is not allowed", await waitFor(() => pf("P.picks.them === 'ali' && P.picks.me === null"), 3000));
  await run(`document.querySelector("[data-pf=side-me]").click(); return 1;`);
  await sleep(120);
  await run(`document.querySelector('[data-id="tyson"]').click(); return 1;`);
  for (const sel of ["rounds-12", "rounds-6", "rounds-3", "sec-180", "sec-60", "sec-120", "tier-4", "tier-0", "tier-2"]) await run(`document.querySelector("[data-pf=${sel}]").click(); return 1;`);
  ok("rounds, round length and opponent are set and remembered", await waitFor(() => run(`const s = JSON.parse(localStorage.getItem("pf_settings_v1") || "{}"); return s.rounds === 3 && s.roundSec === 120 && s.tier === 2;`), 3000));
  ok("Fight is ready with two different boxers", await run(`const b = document.querySelector("[data-pf=fight]"); return !b.disabled && b.textContent === "Fight";`), await run(`const b = document.querySelector("[data-pf=fight]"); return [b.disabled, b.textContent, window.__PF.picks];`));
  await sleep(1500);
  await shot("04-select");

  }
  // ================================================================ a live fight with the person's keys
  if (want("fight")) {
  step("fight keys");
  // started from the page's own address, as a person would, so a refresh later lands on the entry
  await open(BASE + "/prize-fighter?pftest=1&skipintro");
  await onScreen("entry");
  await run(`window.__PF.go("fight", "mayweather", "canelo"); return 1;`);
  ok("a fight opens with the round card and then the bell", await waitFor(() => pf("P.world && P.st && P.st.phase === 'fight' && P.overlay === 'none'"), 30000));
  ok("the HUD shows both boxers, the round and the clock", await run(`return !!document.querySelector(".pf-bug") && document.querySelector(".pf-clock").textContent.includes(":") && document.querySelectorAll(".pf-guard").length === 3;`));
  // a punch from the keyboard starts at once
  await press("KeyJ");
  ok("J throws a jab straight away", await waitFor(() => pf("P.st.f[0].action && P.st.f[0].action.type === 'punch' && P.st.f[0].action.kind === 'jab' || P.st.f[0].fs.thrown + P.st.f[0].rs.thrown > 0"), 1500));
  // guard switches in the middle of punches
  const guardsOk = [];
  for (const [p, g, want] of [["KeyK", "Digit1", "high"], ["KeyU", "Digit2", "philly"], ["KeyI", "Digit3", "normal"], ["KeyN", "Digit1", "high"]]) {
    await key(p, "keyDown");
    await sleep(30);
    await key(g, "keyDown");
    await sleep(20);
    await key(p, "keyUp");
    await key(g, "keyUp");
    await sleep(160);
    guardsOk.push(await pf("P.st.f[0].guard") === want);
  }
  ok("a guard switch in the middle of a punch always takes", guardsOk.every(Boolean), guardsOk);
  await press("Tab");
  await sleep(150);
  ok("Tab moves to the next guard", (await pf("P.st.f[0].guard")) === "philly", await pf("P.st.f[0].guard"));
  await press("Digit2");
  await sleep(200);
  await shot("05-guard-philly");
  await press("Digit1");
  await sleep(250);
  await shot("06-guard-high");
  await press("Digit3");
  await sleep(250);
  await shot("07-guard-normal");
  const stance0 = await pf("P.st.f[0].stance");
  await press("KeyT");
  ok("T switches stance", await waitFor(async () => (await pf("P.st.f[0].stance")) !== stance0, 3000), stance0);
  await press("KeyT");
  await waitFor(async () => (await pf("P.st.f[0].stance")) === stance0, 3000);
  // every key at once, again and again, with the mouse buttons too
  step("key spam");
  const codes = Object.keys(KEYS).filter(c => c !== "Escape" && c !== "KeyP" && c !== "Enter");
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) {
    for (const c of codes) await key(c, "keyDown");
    await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: 700, y: 450, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: 700, y: 450, button: "left", clickCount: 1 });
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 400 + Math.random() * 600, y: 200 + Math.random() * 400 });
    await sleep(25);
    for (const c of codes) await key(c, "keyUp");
    await sleep(15);
  }
  ok("every key at once for four seconds: the fight carries on with real numbers", (await run(SANE)) === "ok" && ["fight", "kd", "bell", "corner", "pre", "over"].includes(await pf("P.st.phase")), await run(SANE));
  ok("no action is stuck after the spam", await waitFor(() => pf("!P.st.f[0].action || ['down','getup','clinch'].includes(P.st.f[0].action.type) || P.st.f[0].action.t < 140"), 3000));
  // pause and resume in the middle of a round
  step("pause");
  await waitFor(() => pf("P.st.phase === 'fight' && P.overlay === 'none'"), 20000);
  await press("Escape");
  ok("Esc pauses the fight", await waitFor(() => pf("P.paused && P.world.paused && !!document.querySelector('[data-pf=pause]')"), 3000));
  const c1 = await pf("P.st.clock");
  await sleep(1200);
  ok("the clock stands still while paused", Math.abs((await pf("P.st.clock")) - c1) < 0.001);
  await run(`[...document.querySelectorAll(".pf-pause-tabs button")][1].click(); return 1;`);
  ok("the pause menu lists the controls", await waitFor(() => run(`return document.querySelectorAll(".pf-key").length >= 15;`), 3000));
  await run(`[...document.querySelectorAll(".pf-pause-tabs button")][2].click(); return 1;`);
  ok("and the graphics and sound", await waitFor(() => run(`return !!document.querySelector(".pf-pause [data-pf=gfx-3]");`), 3000));
  await run(`[...document.querySelectorAll(".pf-pause-tabs button")][0].click(); return 1;`);
  await press("Escape");
  ok("Esc again carries on", await waitFor(() => pf("!P.paused && !P.world.paused"), 3000));
  await sleep(1200);
  ok("and the clock runs again", (await pf("P.st.clock")) < c1 - 0.5, await pf(`({ c1: ${c1}, clock: P.st.clock, phase: P.st.phase, overlay: P.overlay, mode: P.world.mode, time: P.world.time, paused: P.world.paused, hidden: document.hidden, focus: document.hasFocus(), active: document.activeElement && document.activeElement.outerHTML.slice(0, 120), canvases: document.querySelectorAll("canvas").length, quality: P.quality, guardLog: P.guardLog })`));

  }
  // ================================================================ refreshing in the middle
  if (want("refresh")) {
  step("refresh mid round");
  await sleep(3500);
  const before = await pf("({ round: P.st.round, clock: P.st.clock, phase: P.st.phase })");
  await cdp("Page.reload");
  await waitFor(() => run("return document.readyState === 'complete'"), 20000);
  ok("after a refresh mid round the entry offers to carry on", await waitFor(() => run(`return !!document.querySelector("[data-pf=resume]") && document.querySelector(".pf-resume").textContent.includes("Round " + ${before.round});`), 15000));
  await run(`document.querySelector("[data-pf=resume]").click(); return 1;`);
  ok("Carry on puts the fight back, paused, in the same round", await waitFor(() => pf(`P.st && P.st.round === ${before.round} && P.paused && !!P.world`), 20000), [before, await pf("({ round: P.st && P.st.round, phase: P.st && P.st.phase, paused: P.paused, overlay: P.overlay, world: !!P.world, screen: P.screen })")]);
  const after = await pf("P.st.clock");
  ok("within a few seconds of where it was", Math.abs(after - before.clock) < 5, [before.clock, after]);
  await press("Escape");
  ok("and carries on from there", await waitFor(() => pf("!P.paused && P.st.phase === 'fight'"), 5000));
  // a knockdown, refreshed in the middle of the count
  step("refresh in a knockdown");
  await run(`window.__PF.kd(1); return 1;`);
  ok("a knockdown shows the count", await waitFor(() => run(`return document.querySelector(".pf-kd").dataset.show === "true";`), 4000));
  await sleep(2500);
  await shot("08-knockdown");
  await cdp("Page.reload");
  await waitFor(() => run("return document.readyState === 'complete'"), 20000);
  await waitFor(() => run(`return !!document.querySelector("[data-pf=resume]");`), 15000);
  await run(`document.querySelector("[data-pf=resume]").click(); return 1;`);
  ok("a refresh in the count comes back in the count", await waitFor(() => pf("P.st && P.st.phase === 'kd' && P.paused && !!P.world"), 20000), await pf("P.st && P.st.phase"));
  await press("Escape");
  ok("and the count goes on to a rise or a stoppage", await waitFor(() => pf("P.st.phase === 'fight' || P.st.phase === 'over' || P.st.phase === 'bell'"), 20000));
  // the corner, refreshed
  step("refresh in the corner");
  if (await pf("P.st.phase === 'fight'")) {
    await run(`window.__PF.endRound(); return 1;`);
    ok("the bell takes you to the corner with the round's numbers, the judges and the trainer", await waitFor(() => run(`return window.__PF.overlay === "corner" && !!document.querySelector("[data-pf=corner]") && document.querySelectorAll(".pf-corner tbody tr").length >= 7;`), 10000));
    await sleep(2500);
    await shot("09-corner");
    await cdp("Page.reload");
    await waitFor(() => run("return document.readyState === 'complete'"), 20000);
    await waitFor(() => run(`return !!document.querySelector("[data-pf=resume]");`), 15000);
    await run(`document.querySelector("[data-pf=resume]").click(); return 1;`);
    ok("a refresh on the stool comes back to the corner", await waitFor(() => pf("P.overlay === 'corner' && P.st.phase === 'corner' && !!P.world && !!document.querySelector('[data-pf=corner]')"), 20000));
    await press("Space");
    ok("Space goes out for the next round", await waitFor(() => pf("P.st.round === 2 && (P.overlay === 'round' || P.overlay === 'none')"), 8000), await pf("({ round: P.st && P.st.round, phase: P.st && P.st.phase, paused: P.paused, overlay: P.overlay, world: !!P.world, screen: P.screen })"));
    await waitFor(() => pf("P.overlay === 'none'"), 8000);
  }
  // throwing a saved fight away, and a broken one
  step("throw away");
  await cdp("Page.reload");
  await waitFor(() => run(`return !!document.querySelector("[data-pf=abandon]");`), 20000);
  await run(`document.querySelector("[data-pf=abandon]").click(); return 1;`);
  ok("Throw it away clears the saved fight", await waitFor(() => run(`return !document.querySelector(".pf-resume") && !localStorage.getItem("pf_fight_v1");`), 5000));
  await run(`localStorage.setItem("pf_fight_v1", "{broken"); localStorage.setItem("pf_fighters_v1", "[{"); localStorage.setItem("pf_settings_v1", "nonsense"); return 1;`);
  await cdp("Page.reload");
  ok("broken saves never break the page: the entry comes up clean", await waitFor(() => run(`return !!document.querySelector("[data-pf=quick]") && !document.querySelector(".pf-resume");`), 15000));
  await run(`localStorage.removeItem("pf_fighters_v1"); localStorage.removeItem("pf_settings_v1"); return 1;`);

  }
  // ================================================================ small and odd window sizes
  if (want("resize")) {
  step("resize");
  for (const [w, h] of [[390, 844], [600, 900], [820, 1180], [1024, 640], [1440, 900]]) {
    await viewport(w, h);
    await open(BASE + "/prize-fighter?pftest=1");
    await waitFor(() => run(`return !!document.querySelector("[data-pf=quick]");`), 15000);
    await sleep(300);
    const over = await run(`return document.documentElement.scrollWidth - window.innerWidth;`);
    ok(`the entry fits ${w} px wide`, over <= 1, over);
    await run(`document.querySelector("[data-pf=quick]").click(); return 1;`);
    await onScreen('select', 10000);
    await sleep(600);
    ok(`quick fight fits ${w} px wide`, (await run(`return document.documentElement.scrollWidth - window.innerWidth;`)) <= 1, await run(`return document.documentElement.scrollWidth;`));
    await run(`document.querySelector("[data-pf=back]").click(); return 1;`);
    await onScreen('entry', 8000);
    await run(`document.querySelector("[data-pf=create]").click(); return 1;`);
    await onScreen('create', 10000);
    await sleep(600);
    ok(`the creator fits ${w} px wide`, (await run(`return document.documentElement.scrollWidth - window.innerWidth;`)) <= 1, await run(`return document.documentElement.scrollWidth;`));
  }
  await viewport(1440, 900);
  await open(BASE + "/prize-fighter?pftest=1&screen=fight&me=tyson&them=lewis&skipintro&auto");
  await waitFor(() => pf("P.world && P.overlay === 'none'"), 30000);
  for (const [w, h] of [[390, 844], [700, 500], [1440, 900]]) {
    await viewport(w, h);
    await sleep(700);
    const c = await run(`const c = document.querySelector(".pf-canvas canvas"); return c ? [c.clientWidth, c.clientHeight] : null;`);
    ok(`mid fight the ring fills a ${w} by ${h} window`, !!c && Math.abs(c[0] - w) <= 2 && Math.abs(c[1] - h) <= 2, c);
    ok(`and nothing spills sideways at ${w}`, (await run(`return document.documentElement.scrollWidth - window.innerWidth;`)) <= 1);
    if (w === 390) await shot("10-fight-phone");
  }

  }
  // ================================================================ every real boxer, one round each
  if (want("boxers")) {
  step("every boxer");
  await open(BASE + "/prize-fighter?pftest=1&auto&speed=24&skipintro&rounds=3&sec=60");
  await waitFor(() => pf("P.screen === 'entry' && Array.isArray(P.roster)"), 15000);
  const roster = await pf("P.roster");
  ok("the roster has at least 20 real boxers", roster.length >= 20, roster.length);
  const failedBoxers = [];
  let heap0 = 0, counts0 = null;
  for (let i = 0; i < roster.length; i++) {
    currentStep = "boxer " + roster[i];
    const them = roster[(i + 11) % roster.length];
    await run(`window.__PF.go("fight", ${JSON.stringify(roster[i])}, ${JSON.stringify(them)}); return 1;`);
    const done = await waitFor(() => pf(`P.st && P.st.defs[0].id === ${JSON.stringify(roster[i])} && (P.st.rounds.length >= 1 || P.st.phase === 'over')`), 60000, 250);
    const sane = await run(SANE);
    if (!done || sane !== "ok") failedBoxers.push([roster[i], done, sane]);
    if (i === 2) {
      heap0 = await run(`return performance.memory ? performance.memory.usedJSHeapSize : 0;`);
      counts0 = await run(`const g = window.__pfGL; return g ? { geo: g.info.memory.geometries, tex: g.info.memory.textures } : null;`);
    }
  }
  ok("every real boxer fights at least a full round with real numbers", failedBoxers.length === 0, failedBoxers);
  const heap1 = await run(`return performance.memory ? performance.memory.usedJSHeapSize : 0;`);
  const counts1 = await run(`const g = window.__pfGL; return g ? { geo: g.info.memory.geometries, tex: g.info.memory.textures } : null;`);
  ok("twenty odd fights in one page leave the GPU counts where they were", !!counts0 && !!counts1 && counts1.geo <= counts0.geo * 1.3 + 10 && counts1.tex <= counts0.tex + 4, [counts0, counts1]);
  ok("and the memory does not keep growing", !heap0 || heap1 < heap0 + 120 * 1048576, [Math.round(heap0 / 1048576), Math.round(heap1 / 1048576)]);

  }
  // ================================================================ a whole fight to the result, rematch, new fight
  if (want("result")) {
  step("to the result");
  await run(`window.__PF.go("fight", "ali", "frazier"); return 1;`);
  ok("a fight runs to its result screen with the scorecards and the numbers", await waitFor(() => run(`return window.__PF.overlay === "result" && !!document.querySelector("[data-pf=result]") && document.querySelectorAll(".pf-result .k-table").length >= 1;`), 120000, 400));
  await sleep(1200);
  await shot("11-result");
  ok("the record is kept on the device", await run(`const r = JSON.parse(localStorage.getItem("pf_records_v1") || "{}"); return !!r.ali && r.ali.w + r.ali.l + r.ali.d >= 1;`));
  ok("and the finished fight is not offered to carry on", await run(`return !localStorage.getItem("pf_fight_v1");`));
  await run(`document.querySelector("[data-pf=rematch]").click(); return 1;`);
  ok("Rematch starts the same fight again", await waitFor(() => pf("P.st && P.st.round === 1 && P.st.defs[0].id === 'ali' && P.st.defs[1].id === 'frazier' && P.overlay !== 'result'"), 20000));
  await waitFor(() => run(`return window.__PF.overlay === "result";`), 120000, 400);
  await run(`document.querySelector("[data-pf=newfight]").click(); return 1;`);
  ok("New fight goes back to quick fight", await onScreen('select', 10000));

  }
  // ================================================================ a scorecard decision in full view (the report's picture)
  if (want("decision")) {
  if (SHOTS) {
    step("decision picture");
    await open(BASE + "/prize-fighter?pftest=1&auto&speed=24&skipintro&rounds=6&sec=60&screen=fight&me=usyk&them=lomachenko");
    await waitFor(() => run(`return window.__PF.overlay === "result";`), 180000, 500);
    await sleep(1500);
    await shot("12-decision");
  }

  }
  // ================================================================ the console, the whole way through
  const clockWarn = w => /THREE\.Clock: This module has been deprecated/.test(w);
  const otherWarnings = log.warnings.filter(w => !clockWarn(w));
  ok("no errors in the console at any point (page errors, console errors, failed loads)", log.errors.length === 0 && log.bad.length === 0, log.errors.concat(log.bad).slice(0, 8));
  ok("no warnings beyond React Three Fiber's own note about THREE.Clock", otherWarnings.length === 0, otherWarnings.slice(0, 8));
  console.log("(warnings seen: " + log.warnings.length + ", all of them the library's THREE.Clock note: " + log.warnings.every(clockWarn) + ")");
  clearTimeout(guard);
  console.log(passed + " passed, " + failed + " failed");
  stopAll();
  process.exit(failed ? 1 : 0);
}
main().catch(async e => {
  console.log("FAIL: the browser pass stopped: " + e.message + " (at " + currentStep + ")");
  try { console.log("  the page then: " + JSON.stringify(await run(`return { url: location.href, screen: window.__PF && window.__PF.screen, overlay: window.__PF && window.__PF.overlay, text: document.body.innerText.slice(0, 300) };`))); } catch (x) { /* the page is gone */ }
  if (log.errors.length) console.log("  console errors so far: " + JSON.stringify(log.errors.slice(0, 5))); console.log(passed + " passed, " + (failed + 1) + " failed"); try { server && server.kill(); chrome && chrome.kill(); } catch (x) {} tidy(); process.exit(1); });
