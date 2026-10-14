// Hardwood Legends with friends, tested for real: two headless Chrome browsers (each with its own storage, like
// two devices) play one game against each other through the real server.
// Run: npm run build, then node tests-site/test_hardwood_mp.js
// Browser A creates a room, browser B joins it with the code, both see each other in the room, the host sets
// the quarter and tips off, B's keys move B's player in the host's game, the whole game is played to the final
// buzzer (both sides on autopilot, the host's game ten times faster), both browsers show the same final score,
// and the result is saved with the room and on each device. Then a third player joins, the server restarts
// (the room comes back from disk and both browsers reconnect by themselves), and a server that lost the room
// gets it back from a browser's copy. Needs Google Chrome; without it the checks are skipped and say so.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const PORT = process.env.HL_MP_TEST_PORT || "3483";
const BASE = "http://localhost:" + PORT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hl-mp-"));
const SAVE = path.join(tmp, "games.json");
const ROOMS = path.join(tmp, "hardwood_rooms.json");
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
const PAGE = "/games/hardwood-legends.html?hltest=1";
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 400)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms, every) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { /* not yet */ } await sleep(every || 250); }
  return false;
}

let server = null;
async function start() {
  server = spawn("node", ["server.js"], { cwd: root, env: Object.assign({}, process.env, { PORT, NODE_ENV: "production", FL_SAVE_FILE: SAVE }), stdio: "ignore" });
  if (!await waitFor(async () => (await fetch(BASE + "/healthz")).ok, 40000)) throw new Error("the server did not start");
}
async function stop() {
  if (!server) return;
  const s = server; server = null;
  const gone = new Promise(r => s.once("exit", r));
  s.kill("SIGTERM");
  await gone;
}

// one Chrome per player, each with its own profile; one DevTools connection per command
const chromes = [];
function browser(name, port) {
  const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(tmp, "chrome-" + name), "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--window-size=1280,800", "about:blank"], { stdio: "ignore" });
  chromes.push(proc);
  const cdp = async (method, params) => {
    const list = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
    const pg = list.find(t => t.type === "page");
    const ws = new WebSocket(pg.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    try {
      return await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("timeout " + method)), 60000);
        ws.onmessage = m => { const j = JSON.parse(m.data); if (j.id === 1) { clearTimeout(t); j.error ? rej(new Error(j.error.message)) : res(j.result); } };
        ws.send(JSON.stringify({ id: 1, method, params: params || {} }));
      });
    } finally { ws.close(); }
  };
  const run = async js => {
    const r = await cdp("Runtime.evaluate", { expression: "(async () => {" + js + "})()", awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  };
  const up = () => waitFor(async () => (await fetch("http://127.0.0.1:" + port + "/json/version")).ok, 30000);
  const open = async url => { await cdp("Page.navigate", { url }); return waitFor(() => run("return !!window.__HLMP && document.readyState === 'complete' && __HLMP.screen() === 'main';"), 40000); };
  const consoleErrors = () => run("return (window.__errs || []).slice(0, 5);");
  return { cdp, run, up, open, consoleErrors };
}

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) { console.log("No production build found. Run npm run build first."); process.exit(1); }
  if (!CHROME) { console.log("test_hardwood_mp: Google Chrome not found, checks skipped"); console.log("0 passed, 0 failed"); return; }
  const stopAll = () => { try { if (server) server.kill(); } catch (e) {} for (const c of chromes) { try { c.kill(); } catch (e) {} } };
  process.on("exit", stopAll);
  const guard = setTimeout(() => { console.log("FAIL: the two browser run took longer than 12 minutes"); console.log(passed + " passed, " + (failed + 1) + " failed"); stopAll(); process.exit(1); }, 720000);
  guard.unref();
  await start();
  const A = browser("a", String(Number(PORT) + 1)), B = browser("b", String(Number(PORT) + 2));
  ok("two browsers start", await A.up() && await B.up(), null);
  // the host's game runs ten times faster, so a whole game fits in the test
  ok("browser A opens Hardwood Legends", await A.open(BASE + PAGE + "&hlspeed=10"), null);
  ok("browser B opens Hardwood Legends", await B.open(BASE + PAGE), null);
  for (const [P, n] of [[A, "Ann"], [B, "Ben"]]) await P.run(`window.__errs=[]; addEventListener("error", e => __errs.push(String(e.message))); localStorage.setItem("hl_name", ${JSON.stringify(n)}); document.getElementById("nameIn").value = ${JSON.stringify(n)}; return 1;`);

  // ============ create, join, the room ============
  ok("the entry has a join box like Floodlights", await A.run(`return !!document.getElementById("codeIn") && !!document.querySelector("[data-a=join]") && !!document.querySelector("[data-a=create]");`), null);
  await A.run(`document.querySelector("[data-a=create]").click(); return 1;`);
  const code = await waitFor(() => A.run(`return __HLMP.screen() === "select" && /^[A-Z0-9]{4}$/.test(__HLMP.code) ? __HLMP.code : "";`), 15000);
  ok("Create a game opens a room with a code", !!code, code);
  ok("the room shows its code to share", await A.run(`return document.body.innerText.includes("FRIENDS JOIN WITH THIS CODE") && document.body.innerText.includes(${JSON.stringify(code)});`), null);
  await B.run(`document.getElementById("codeIn").value = "ZZZZ"; document.querySelector("[data-a=join]").click(); return 1;`);
  ok("a wrong code says so", await waitFor(() => B.run(`return /No room with that code/.test(document.querySelector(".k-card .msg").textContent);`), 10000), null);
  await B.run(`document.getElementById("codeIn").value = ${JSON.stringify(code)}; document.querySelector("[data-a=join]").click(); return 1;`);
  const both = async () => (await A.run(`return __HLMP.screen() === "room" && __HLMP.room.members.length === 2 && __HLMP.room.members.every(m => m.online && m.side !== null);`)) && (await B.run(`return __HLMP.screen() === "room" && __HLMP.room.members.length === 2 && __HLMP.room.members.every(m => m.online && m.side !== null);`));
  ok("both browsers see each other in the room, each on a side", await waitFor(both, 15000), await B.run(`return __HLMP.room;`).catch(() => null));
  const room = await B.run(`return __HLMP.room;`);
  ok("the two sides have different teams", room.members[0].side !== room.members[1].side && room.members[0].team !== room.members[1].team, room.members);
  ok("only the host has the Tip off button", await A.run(`return !!document.querySelector("[data-a=mpStart]");`) && !(await B.run(`return !!document.querySelector("[data-a=mpStart]");`)), null);
  await A.run(`document.querySelector("[data-a=mpQ][data-v='2']").click(); return 1;`);
  ok("the host's quarter length reaches the friend", await waitFor(() => B.run(`return __HLMP.room.opts.qLen === 2;`), 10000), null);
  // a third player joins (the server's own API, no third browser), and both browsers see it
  let r = await fetch(BASE + "/api/hl/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name: "Cal" }) }).then(x => x.json());
  ok("a third player can join with the code", r.code === code && !!r.token, r);
  ok("and both browsers see three players", await waitFor(async () => (await A.run(`return __HLMP.room.members.length;`)) === 3 && (await B.run(`return __HLMP.room.members.length;`)) === 3, 10000), null);
  const cal = new WebSocket(`ws://localhost:${PORT}/api/hl/live?code=${code}&name=Cal&token=${r.token}`);
  await new Promise(res => { cal.onopen = res; cal.onerror = res; });
  cal.send(JSON.stringify({ t: "leave" }));
  ok("and when the third player leaves, both see two again", await waitFor(async () => (await A.run(`return __HLMP.room.members.length;`)) === 2 && (await B.run(`return __HLMP.room.members.length;`)) === 2, 10000), null);

  // ============ tip off ============
  await A.run(`document.querySelector("[data-a=mpStart]").click(); return 1;`);
  ok("the host's browser plays the game", await waitFor(() => A.run(`return __HLMP.host && __HLMP.G().mode === "game";`), 15000), null);
  ok("the friend's browser draws it", await waitFor(() => B.run(`return __HLMP.remote && __HLMP.G().mode === "game" && __HLMP.G().state !== "tipoff";`), 15000), null);
  ok("each browser steers its own player", (await A.run(`return !!__HLMP.G().user && __HLMP.G().userTeam === 0;`)) && (await B.run(`return !!__HLMP.G().user && __HLMP.G().userTeam === 1;`)), null);
  // B's keys move B's player in the host's game (the court on B follows)
  const before = await A.run(`const c = __HLMP.ctl.find(c => c.name === "Ben"); return [c.p.x, c.p.z];`);
  await B.run(`dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" })); await new Promise(r => setTimeout(r, 1200)); dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" })); return 1;`);
  const after = await A.run(`const c = __HLMP.ctl.find(c => c.name === "Ben"); return [c.p.x, c.p.z, __HLMP.G().clock];`);
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
  ok("the friend's keys move the friend's player in the host's game", moved > 5, [before, after]);
  await sleep(400);
  const seen = await B.run(`const g = __HLMP.G(); return [g.user.x, g.user.z, g.clock];`);
  const hostNow = await A.run(`const c = __HLMP.ctl.find(c => c.name === "Ben"); return [c.p.x, c.p.z, __HLMP.G().clock];`);
  ok("and the friend's screen shows it where the host has it", Math.hypot(seen[0] - hostNow[0], seen[1] - hostNow[1]) < 6, [seen, hostNow]);
  ok("both clocks agree", Math.abs(seen[2] - hostNow[2]) < 4, [seen[2], hostNow[2]]);

  // ============ the whole game ============
  await A.run(`__HLMP.G().autopilot = true; return 1;`);
  await B.run(`__HLMP.G().autopilot = true; return 1;`);
  const done = await waitFor(() => A.run(`return __HLMP.G().mode === "post" && __HLMP.saved;`), 480000, 1000);
  ok("the game is played to the final buzzer and the room keeps the result", !!done, await A.run(`const g = __HLMP.G(); return [g.mode, g.quarter, g.clock, g.state];`).catch(() => null));
  const finalA = await A.run(`const g = __HLMP.G(); return [g.teams[0].score, g.teams[1].score, __HLMP.screen()];`);
  ok("the friend sees the same final score on the box score", await waitFor(async () => { const b = await B.run(`const g = __HLMP.G(); return [g.teams[0].score, g.teams[1].score, __HLMP.screen(), g.mode];`); return b[2] === "box" && b[3] === "post" && b[0] === finalA[0] && b[1] === finalA[1]; }, 20000), [finalA, await B.run(`const g = __HLMP.G(); return [g.teams[0].score, g.teams[1].score, __HLMP.screen(), g.mode];`).catch(() => null)]);
  ok("it is a real game: both sides scored and someone won", finalA[0] > 10 && finalA[1] > 10 && finalA[0] !== finalA[1], finalA);
  ok("the host sees the box score too", finalA[2] === "box", finalA[2]);
  const savedText = P => P.run(`return /RESULT SAVED TO ROOM/i.test(document.body.innerText);`);
  ok("both box scores say the result was saved", await waitFor(async () => (await savedText(A)) && (await savedText(B)), 10000),
    [await A.run(`return [__HLMP.screen(), __HLMP.saved, (document.querySelector(".hl-foot") || {}).innerText];`).catch(e => String(e)), await B.run(`return [__HLMP.screen(), __HLMP.saved, (document.querySelector(".hl-foot") || {}).innerText];`).catch(e => String(e))]);
  const tok = await A.run(`return __HLMP.token;`);
  const srv = await fetch(`${BASE}/api/hl/room?code=${code}&name=Ann&token=${tok}`).then(x => x.json());
  const res = srv.room && srv.room.results[srv.room.results.length - 1];
  ok("the server has the result with the room", !!res && res.home.score === finalA[0] && res.away.score === finalA[1] && res.home.names.includes("Ann") && res.away.names.includes("Ben") && res.home.box.length > 0, res);
  ok("the room is back in its lobby for a rematch", srv.room && srv.room.phase === "lobby", srv.room && srv.room.phase);
  await sleep(600);
  ok("the result is on disk", (() => { try { const d = JSON.parse(fs.readFileSync(ROOMS, "utf8")); return d[code] && d[code].results.length === 1; } catch (e) { return false; } })(), null);
  ok("and on each device", (await A.run(`return JSON.parse(localStorage.getItem("hl_mp_results") || "[]").length;`)) === 1 && (await B.run(`return JSON.parse(localStorage.getItem("hl_mp_results") || "[]").length;`)) === 1, null);
  for (const P of [A, B]) await P.run(`document.querySelector("[data-a=mpBack]").click(); return 1;`);
  ok("both go back to the room, which counts the game", await waitFor(async () => (await A.run(`return __HLMP.screen() === "room" && /Games played\\s*1/i.test(document.body.innerText);`)) && (await B.run(`return __HLMP.screen() === "room";`)), 10000), null);

  // ============ a restart and a lost room ============
  await stop();
  await start();
  ok("after a restart both browsers reconnect by themselves", await waitFor(async () => (await A.run(`return __HLMP.ws && __HLMP.ws.readyState === 1 && __HLMP.room.members.every(m => m.online);`)) && (await B.run(`return __HLMP.ws && __HLMP.ws.readyState === 1;`)), 30000), null);
  ok("and the room came back from disk with its result", (await B.run(`return __HLMP.room.results.length;`)) === 1, null);
  await stop();
  fs.rmSync(ROOMS, { force: true });
  await start();
  ok("a server that lost the room: the friend sees one clean end screen", await waitFor(() => B.run(`return __HLMP.screen() === "ended" && /This game session ended/i.test(document.body.innerText) && !!document.querySelector("[data-a=mpRestore]");`), 30000), await B.run(`return [__HLMP.screen(), __HLMP.code, __HLMP.copy && __HLMP.copy.code, __HLMP.ws && __HLMP.ws.readyState, document.body.innerText.slice(0, 160)];`).catch(e => String(e)));
  await B.run(`document.querySelector("[data-a=mpRestore]").click(); return 1;`);
  ok("Restore puts the room back with its result", await waitFor(() => B.run(`return __HLMP.screen() === "room" && __HLMP.room.results.length === 1 && __HLMP.code === ${JSON.stringify(code)};`), 20000), null);
  // A was the host: its browser ends too, then comes back in by name when it goes back in with the code
  ok("the host's browser saw the end too", await waitFor(() => A.run(`return __HLMP.screen() === "ended" || __HLMP.screen() === "room";`), 20000), null);
  const errs = (await A.consoleErrors()).concat(await B.consoleErrors());
  ok("no script errors in either browser", errs.length === 0, errs);

  await stop();
  console.log(passed + " passed, " + failed + " failed");
  stopAll();
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("FAIL: two browser run crashed", String(e && e.stack || e).slice(0, 500)); console.log(passed + " passed, " + (failed + 1) + " failed"); try { if (server) server.kill(); } catch (x) {} for (const c of chromes) { try { c.kill(); } catch (x) {} } process.exit(1); });
