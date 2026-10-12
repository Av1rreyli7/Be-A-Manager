// Restart battery: games survive a server reboot, and a game the server lost comes back from a player's device.
// Run: npm run build, then node tests-site/test_restart.js
// It boots the real server.js (production) on its own port and save file, and restarts it again and again:
// a stop straight after a change, a hard kill, a broken side file, and a wiped disk (what the free host does
// when it sleeps or redeploys). Then, in headless Chrome when it is installed, the real pages: no lobby flash
// while a saved room loads, a quiet RECONNECTING while the server sleeps (a little front proxy answers 503 like
// the host does), one clean "this game session ended" screen when the room is gone, and Restore bringing it
// back, on the Floodlights page and on the Player Career page.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const http = require("http");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const PORT = process.env.RESTART_TEST_PORT || "3479";
const FRONT = String(Number(PORT) + 1);
const DEBUG = String(Number(PORT) + 2);
const BASE = "http://127.0.0.1:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fl-restart-"));
const SAVE = path.join(tmp, "games.json");
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 400)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { /* not yet */ } await sleep(200); }
  return false;
}
async function api(p, body) {
  const r = await fetch(BASE + p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  let j = {};
  try { j = await r.json(); } catch (e) { /* empty */ }
  return { status: r.status, j };
}
async function copyOf(code, name) {
  const r = await fetch(BASE + "/api/save/copy?code=" + code + "&name=" + encodeURIComponent(name));
  return { status: r.status, data: r.ok ? Buffer.from(await r.arrayBuffer()) : null };
}
async function restore(name, data) {
  const r = await fetch(BASE + "/api/save/restore?name=" + encodeURIComponent(name), { method: "POST", headers: { "Content-Type": "application/gzip" }, body: data });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

// ---------- the server, started and stopped like the host does it ----------
let server = null;
async function start() {
  server = spawn("node", ["server.js"], { cwd: root, env: Object.assign({}, process.env, { PORT, NODE_ENV: "production", FL_SAVE_FILE: SAVE }), stdio: "ignore" });
  const up = await waitFor(async () => (await fetch(BASE + "/healthz")).ok, 40000);
  if (!up) throw new Error("the server did not start");
}
async function stop(sig) {
  if (!server) return;
  const s = server;
  server = null;
  const gone = new Promise(r => s.once("exit", r));
  s.kill(sig || "SIGTERM");
  await gone;
}

// ---------- the front: passes everything to the server, or answers 503 while "asleep" (like the host) ----------
let asleep = false;
const front = http.createServer((req, res) => {
  if (asleep && req.url.startsWith("/api/")) { res.writeHead(503, { "Content-Type": "text/plain" }); res.end("waking up"); return; }
  const up = http.request({ host: "127.0.0.1", port: PORT, path: req.url, method: req.method, headers: req.headers }, r2 => { res.writeHead(r2.statusCode, r2.headers); r2.pipe(res); });
  up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(up);
});

// ---------- headless Chrome: one DevTools connection per command, each with a time limit ----------
let chrome = null;
async function page() {
  const list = await (await fetch("http://127.0.0.1:" + DEBUG + "/json/list")).json();
  return list.find(t => t.type === "page");
}
async function cdp(method, params) {
  const pg = await page();
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  try {
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout " + method)), 60000);
      ws.onmessage = m => { const j = JSON.parse(m.data); if (j.id === 1) { clearTimeout(t); j.error ? rej(new Error(j.error.message)) : res(j.result); } };
      ws.send(JSON.stringify({ id: 1, method, params: params || {} }));
    });
  } finally { ws.close(); }
}
async function run(js) {
  const r = await cdp("Runtime.evaluate", { expression: "(async () => {" + js + "})()", awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
  return r.result.value;
}
async function go(url) { await cdp("Page.navigate", { url }); await sleep(600); await waitFor(() => run("return document.readyState === 'complete';"), 30000); }
const copyIn = code => run(`const q = indexedDB.open("floodlights", 1); q.onupgradeneeded = () => q.result.createObjectStore("copies"); const db = await new Promise(r => q.onsuccess = () => r(q.result)); const rec = await new Promise(r => { const g = db.transaction("copies").objectStore("copies").get(${JSON.stringify(code)}); g.onsuccess = () => r(g.result); g.onerror = () => r(null); }); return rec ? rec.data.byteLength : 0;`);

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) { console.log("No production build found. Run npm run build first."); process.exit(1); }
  const stopAll = () => { try { if (server) server.kill(); } catch (e) {} try { if (chrome) chrome.kill(); } catch (e) {} };
  process.on("exit", stopAll);
  const guard = setTimeout(() => { console.log("FAIL: the restart run took longer than 8 minutes"); console.log(passed + " passed, " + (failed + 1) + " failed"); stopAll(); process.exit(1); }, 480000);
  guard.unref();
  await start();

  // ============ API: a restart keeps every room ============
  let r = await api("/api/create", { name: "Ann" });
  const M = r.j.code;
  await api("/api/join", { code: M, name: "Ben" });
  await api("/api/pick", { code: M, name: "Ann", team: "Arsenal" });
  const FORM = { first: "Pia", last: "Rao", nick: "PR", dobY: 2011, dobM: 3, dobD: 14, country: "India", nat: "India", lang: "Hindi", foot: "Right", height: 177, weight: 66, pos: "ST", pos2: "CAM", num: 9, style: "Poacher", look: { skinF: 0.55, hair: 3, hairCol: 0, beard: 0, muscle: 0.5, eyeCol: 2, watch: "steel", boot: 6 } };
  r = await api("/api/pc/create", { name: "Pia", player: FORM });
  const P = r.j.code;
  ok("a manager room and a Player Career to work with", !!M && !!P, [M, P]);
  // a change and a stop straight after it, inside the moment before the write
  await api("/api/pick", { code: M, name: "Ben", team: "Chelsea" });
  await stop("SIGTERM");
  await start();
  let st = await api(`/api/state?code=${M}&name=Ben`);
  ok("a stop straight after a change keeps the change", st.status === 200 && st.j.myClub && st.j.myClub.name === "Chelsea", st.j.myClub && st.j.myClub.name);
  st = await api(`/api/state?code=${M}&name=Ann`);
  ok("and the rest of the room", st.status === 200 && st.j.myClub && st.j.myClub.name === "Arsenal", st.status);
  st = await api(`/api/pc/state?code=${P}&name=Pia`);
  ok("the Player Career is still there", st.status === 200 && st.j.state && st.j.state.person.first === "Pia", st.status);
  // a hard kill (no time to write) a moment after a change: the change was already on disk
  await api("/api/pick", { code: M, name: "Ben", team: "Liverpool" });
  await sleep(1200);
  await stop("SIGKILL");
  await start();
  st = await api(`/api/state?code=${M}&name=Ben`);
  ok("a hard kill a moment after a change keeps the change", st.status === 200 && st.j.myClub && st.j.myClub.name === "Liverpool", st.j.myClub && st.j.myClub.name);
  // a write cut off half way leaves only a broken side file; the save itself is whole
  fs.writeFileSync(SAVE + ".tmp", '{"half":');
  await stop("SIGKILL");
  await start();
  st = await api(`/api/state?code=${M}&name=Ann`);
  ok("a half written side file never breaks the save", st.status === 200, st.status);
  ok("the save on disk is always whole JSON", (() => { try { JSON.parse(fs.readFileSync(SAVE, "utf8")); return true; } catch (e) { return false; } })(), null);

  // ============ API: a copy on the device brings a lost room back ============
  const ann = await copyOf(M, "Ann"), pia = await copyOf(P, "Pia"), eve = await copyOf(M, "Eve");
  ok("a member gets a packed copy of the game", ann.status === 200 && ann.data.length > 10000 && ann.data.length < 2000000, ann.data && ann.data.length);
  ok("someone not in the room does not", eve.status === 403, eve.status);
  ok("the copy is the whole game", (() => { const g = JSON.parse(zlib.gunzipSync(ann.data)); return g.code === M && g.users.Ann && g.users.Ben && !!g.uid; })(), null);
  await stop();
  fs.rmSync(SAVE, { force: true });
  await start();
  st = await api(`/api/state?code=${M}&name=Ann`);
  ok("a wiped disk loses the room (what the free host does)", st.status === 404 && st.j.error === "Game not found.", st);
  r = await restore("Ann", ann.data);
  ok("the copy puts the room back under its own code", r.status === 200 && r.j.code === M && r.j.restored === true && r.j.mode === "manager", r.j);
  st = await api(`/api/state?code=${M}&name=Ann`);
  ok("with everything in it", st.status === 200 && st.j.myClub && st.j.myClub.name === "Arsenal", st.status);
  r = await restore("Ben", ann.data);
  ok("a friend's copy of the same game just goes back in, the room is not replaced", r.status === 200 && r.j.code === M && r.j.restored === false, r.j);
  st = await api(`/api/state?code=${M}&name=Ben`);
  ok("and the friend is in", st.status === 200 && st.j.myClub && st.j.myClub.name === "Liverpool", st.status);
  r = await restore("Eve", ann.data);
  ok("someone not in the game cannot use the copy", r.status === 400, r.j);
  r = await restore("Ann", Buffer.from("not a game"));
  ok("a broken copy is refused", r.status === 400, r.j);
  r = await restore("Pia", pia.data);
  ok("a Player Career comes back the same way", r.status === 200 && r.j.code === P && r.j.mode === "player", r.j);
  st = await api(`/api/pc/state?code=${P}&name=Pia`);
  ok("and plays on", st.status === 200 && st.j.state.person.first === "Pia", st.status);
  // the code went to another game meanwhile: the copy comes back under a new code, the other game is untouched
  const other = JSON.parse(zlib.gunzipSync(ann.data));
  other.uid = "someone-else";
  r = await restore("Ann", zlib.gzipSync(JSON.stringify(other)));
  ok("a copy whose code is taken by another game gets a new code", r.status === 200 && r.j.restored === true && r.j.code !== M && /^[A-Z0-9]{4}$/.test(r.j.code), r.j);
  st = await api(`/api/state?code=${M}&name=Ben`);
  ok("and the game that holds the code is not touched", st.status === 200 && st.j.myClub && st.j.myClub.name === "Liverpool", null);
  await stop();
  await start();
  st = await api(`/api/state?code=${M}&name=Ann`);
  ok("a restored room survives the next restart", st.status === 200, st.status);

  // ============ the pages, in headless Chrome ============
  if (!CHROME) { console.log("test_restart: Google Chrome not found, page checks skipped"); }
  else {
    await new Promise(res => front.listen(FRONT, res));
    const FB = "http://localhost:" + FRONT;
    chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + DEBUG, "--user-data-dir=" + path.join(tmp, "chrome"), "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--window-size=1280,860", "about:blank"], { stdio: "ignore" });
    ok("headless Chrome starts", await waitFor(async () => (await fetch("http://127.0.0.1:" + DEBUG + "/json/version")).ok, 30000), null);
    // Floodlights: a saved room loads behind a still screen, the lobby form never flashes
    await go(FB + "/floodlights/");
    await run(`localStorage.setItem("fl_name", "Ann"); localStorage.setItem("fl_code", ${JSON.stringify(M)}); return 1;`);
    await cdp("Page.navigate", { url: FB + "/floodlights/" });
    const seen = [];
    for (let i = 0; i < 25; i++) {
      seen.push(await run(`const l = document.getElementById("lobby"), c = l && l.querySelector(".card:not(#endedCard)"); if (!l) return "none"; const lobby = !l.classList.contains("hidden") && getComputedStyle(l).visibility !== "hidden" && c && !c.classList.contains("hidden"); return lobby ? "lobby" : !document.getElementById("app").classList.contains("hidden") ? "app" : "gate";`).catch(() => "loading"));
      if (seen[seen.length - 1] === "app") break;
      await sleep(120);
    }
    ok("a saved room opens straight into the game, the lobby never flashes", seen.includes("app") && !seen.includes("lobby"), seen);
    ok("this device keeps a copy of the game", await waitFor(() => copyIn(M), 15000), null);
    // the server asleep: 503 from the front for a while, then it answers again
    asleep = true;
    const waking = await waitFor(() => run(`return document.getElementById("hLive").textContent === "RECONNECTING" && !document.getElementById("app").classList.contains("hidden");`), 15000);
    ok("while the server sleeps the page keeps the game and says RECONNECTING", !!waking, null);
    ok("and never the end screen", await run(`return document.getElementById("endedCard").classList.contains("hidden");`), null);
    asleep = false;
    ok("when it answers again the page carries on by itself", await waitFor(() => run(`return /LIVE/.test(document.getElementById("hLive").textContent) && document.getElementById("hLive").textContent !== "RECONNECTING";`), 15000), null);
    // the room is wiped: one clean end screen, no loop, Restore brings it back
    await stop();
    fs.rmSync(SAVE, { force: true });
    await start();
    ok("a wiped room ends the session on one clean screen", await waitFor(() => run(`return !document.getElementById("endedCard").classList.contains("hidden") && document.getElementById("app").classList.contains("hidden");`), 15000), null);
    const states = [];
    for (let i = 0; i < 6; i++) { states.push(await run(`return [!document.getElementById("endedCard").classList.contains("hidden"), document.getElementById("app").classList.contains("hidden"), document.getElementById("gate").classList.contains("hidden")].join();`)); await sleep(500); }
    ok("the end screen holds still (no flicker, no loop)", states.every(x => x === "true,true,true"), states);
    ok("it offers this device's copy", await run(`return !document.getElementById("restoreRow").classList.contains("hidden") && /kept a copy/.test(document.getElementById("endedText").textContent);`), null);
    ok("with a way home and a new game", await run(`return !!document.getElementById("endedHome") && !!document.getElementById("endedNew");`), null);
    await run(`document.getElementById("restoreBtn").click(); return 1;`);
    ok("Restore puts the room back and opens it", await waitFor(() => run(`return !document.getElementById("app").classList.contains("hidden") && document.getElementById("hCode").textContent === ${JSON.stringify(M)};`), 15000), null);
    st = await api(`/api/state?code=${M}&name=Ben`);
    ok("the friend's code works again", st.status === 200, st.status);

    // Player Career: the title waits for the saved career (no swap of buttons), then the end screen and Restore
    // (the wipe above took the career too: Pia puts it back from the copy taken earlier, through the API)
    r = await restore("Pia", pia.data);
    ok("the career is back for the page checks", r.status === 200 && r.j.code === P, r.j);
    await go(FB + "/floodlights/career");
    await run(`localStorage.setItem("fl_pc_code", ${JSON.stringify(P)}); localStorage.setItem("fl_pc_name", "Pia"); return 1;`);
    await cdp("Page.navigate", { url: FB + "/floodlights/career" });
    const btns = [];
    for (let i = 0; i < 25; i++) {
      const b = await run(`return [...document.querySelectorAll(".pc-title-btns > *")].map(e => e.textContent.trim()).join("|");`).catch(() => "");
      btns.push(b);
      if (/^Continue as/.test(b)) break;
      await sleep(120);
    }
    ok("a saved career never flashes Start a new career while it loads", btns.some(b => /^Continue as Pia/.test(b)) && !btns.some(b => /Start a new career/.test(b)), btns);
    ok("this device keeps a copy of the career", await waitFor(() => copyIn(P), 15000), null);
    await stop();
    fs.rmSync(SAVE, { force: true });
    await start();
    await cdp("Page.navigate", { url: FB + "/floodlights/career" });
    ok("a wiped career ends on one clean screen", await waitFor(() => run(`return !!document.querySelector(".pc-ended") && /Restore the career/.test(document.querySelector(".pc-title-btns").textContent);`), 20000), null);
    await run(`[...document.querySelectorAll("button")].find(b => /Restore the career/.test(b.textContent)).click(); return 1;`);
    ok("Restore puts the career back and opens it", await waitFor(() => run(`return !document.querySelector(".pc-title") && localStorage.getItem("fl_pc_code") === ${JSON.stringify(P)};`), 20000), null);
    st = await api(`/api/pc/state?code=${P}&name=Pia`);
    ok("and the server has it again", st.status === 200, st.status);
  }
  await stop();
  front.close();
  console.log(passed + " passed, " + failed + " failed");
  stopAll();
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("FAIL: restart run crashed", String(e && e.stack || e).slice(0, 400)); console.log(passed + " passed, " + (failed + 1) + " failed"); try { if (server) server.kill(); if (chrome) chrome.kill(); } catch (x) {} process.exit(1); });
