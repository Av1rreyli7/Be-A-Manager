// Proves the combined server boots and serves everything from one port.
// Run: npm run build, then node tests-site/test_boot.js
// It starts the real server.js in production mode on its own port and checks the landing page,
// Floodlights (page, engine, 3D files, fonts, API) and the Front Office pages.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const PORT = process.env.BOOT_TEST_PORT || "3477";
const BASE = "http://localhost:" + PORT;
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(route, opts) {
  const r = await fetch(BASE + route, Object.assign({ redirect: "manual" }, opts || {}));
  const text = await r.text();
  return { status: r.status, type: r.headers.get("content-type") || "", loc: r.headers.get("location") || "", text };
}
const post = (route, body) => get(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) {
    console.log("No production build found. Run npm run build first.");
    process.exit(1);
  }
  const save = path.join(root, "floodlights", "games.json");
  const hadSave = fs.existsSync(save) ? fs.readFileSync(save) : null;
  const t0 = Date.now();
  const server = spawn("node", ["server.js"], { cwd: root, env: Object.assign({}, process.env, { PORT, NODE_ENV: "production" }), stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  server.stdout.on("data", d => { log += d; });
  server.stderr.on("data", d => { log += d; });
  const stop = () => { try { server.kill(); } catch (e) {} };
  process.on("exit", stop);

  let up = false;
  for (let i = 0; i < 80 && !up; i++) {
    await sleep(250);
    try { up = (await fetch(BASE + "/healthz")).status === 200; } catch (e) {}
  }
  ok("the combined server boots", up, log.slice(-300));
  if (!up) { console.log(passed + " passed, " + failed + " failed"); process.exit(1); }
  const bootMs = Date.now() - t0;
  ok("it boots in a few seconds", bootMs < 20000, bootMs);

  // ---- landing page (Next) ----
  let r = await get("/");
  ok("the landing page is served at the root", r.status === 200 && r.type.includes("text/html"), r.status);
  ok("the landing has the title", r.text.includes("<title>Be-A-Manager</title>") && /<h1[^>]*>[\s\S]*Be-A-Manager[\s\S]*<\/h1>/.test(r.text), null);
  ok("the landing links to both games", r.text.includes('href="/floodlights/"') && r.text.includes('href="/front-office"'), null);
  ok("the landing has both enter buttons", r.text.includes("ENTER FLOODLIGHTS") && r.text.includes("ENTER GAME NIGHT") && !r.text.includes("ENTER FRONT OFFICE"), null);
  ok("the landing is the light version: no footer, stats, chips or long copy", !r.text.includes("bam-foot") && !r.text.includes("bam-stats") && !r.text.includes("k-chip") && !r.text.includes("bam-blurb") && !r.text.includes("BASKETBALL BUNDLE"), null);
  ok("the landing forces a black page from the first byte", r.text.includes("html,body{background:#000000 !important") && r.text.includes("background:#000"), null);
  ok("the starfield is in the first HTML, before any script runs", r.text.includes("bam-stars") && (r.text.match(/vw [0-9.]+vh/g) || []).length >= 168, null);
  ok("both games are in the first HTML with their glass enter buttons", r.text.includes('data-game="floodlights"') && r.text.includes('data-game="frontoffice"') && (r.text.match(/k-btn-primary/g) || []).length >= 2, null);
  ok("each game has its one short line", r.text.includes("Run a football club with your mates.") && r.text.includes("Run the team, or play it yourself."), null);
  ok("no em or en dashes in the landing HTML", !r.text.includes(String.fromCharCode(8212)) && !r.text.includes(String.fromCharCode(8211)), null);
  ok("three.js is not in the first HTML", !r.text.includes("WebGLRenderer"), null);
  ok("the landing has no side preview card", !r.text.includes("bam-side-cap") && !r.text.includes("bam-mock") && !r.text.includes("ALSO HERE"), null);

  // ---- Floodlights (Express) ----
  r = await get("/floodlights");
  ok("/floodlights redirects to the slash path", r.status === 308 && r.loc === "/floodlights/", [r.status, r.loc]);
  r = await get("/floodlights/");
  ok("the Floodlights page is served", r.status === 200 && r.text.includes("<title>Floodlights</title>") && r.text.includes('<script src="match.js"></script>'), r.status);
  ok("the Floodlights page links home", r.text.includes('href="/"'), null);
  r = await get("/floodlights/match.js");
  ok("the match engine is served", r.status === 200 && r.text.includes("FLMatch") && r.type.includes("javascript"), [r.status, r.type]);
  r = await get("/floodlights/match3d.mjs");
  ok("the 3D view is served as a script", r.status === 200 && r.text.includes("createView3D") && r.type.includes("javascript"), [r.status, r.type]);
  r = await get("/floodlights/match_sim3d.mjs");
  ok("the deep sim behind the 3D view is served as a script", r.status === 200 && r.text.includes("createSim3D") && r.type.includes("javascript"), [r.status, r.type]);
  for (const f of ["m3d/sim.mjs", "m3d/ball.mjs", "m3d/view/index.mjs", "m3d/view/anim.mjs"]) {
    const g = await get("/floodlights/" + f);
    ok("the rebuilt 3D match file " + f + " is served as a script", g.status === 200 && g.type.includes("javascript") && g.text.length > 1000, [g.status, g.type]);
  }
  for (const f of ["three.module.js", "three.core.js"]) {
    const g = await get("/floodlights/vendor/" + f);
    ok("three.js file " + f, g.status === 200 && g.type.includes("javascript") && g.text.length > 100000, [g.status, g.text.length]);
  }
  for (const f of ["inter.woff2", "chakra-petch-700.woff2", "chakra-petch-600.woff2", "instrument-serif-italic.woff2", "geist-mono.woff2"]) {
    const g = await get("/floodlights/fonts/" + f);
    ok("font " + f, g.status === 200 && g.type.includes("font/woff2"), [g.status, g.type]);
  }
  r = await get("/floodlights/stats.json");
  let stats = null; try { stats = JSON.parse(r.text); } catch (e) {}
  ok("the live stats answer", r.status === 200 && stats && stats.clubs === 320 && stats.leagues === 15, r.text.slice(0, 100));

  // ---- Floodlights API through the combined server ----
  r = await post("/api/create", { name: "BootHost" });
  let code = ""; try { code = JSON.parse(r.text).code; } catch (e) {}
  ok("a room can be created", r.status === 200 && /^[A-Z0-9]{4}$/.test(code), r.text.slice(0, 80));
  r = await post("/api/join", { code, name: "BootMate" });
  ok("a friend can join with the code", r.status === 200, r.text.slice(0, 80));
  r = await get("/api/state?code=" + code + "&name=BootHost");
  let state = null; try { state = JSON.parse(r.text); } catch (e) {}
  ok("the state poll works", r.status === 200 && state && state.code === code, r.text.slice(0, 80));
  r = await get("/api/state?code=ZZZZ&name=Nobody");
  ok("a wrong room code is turned down with JSON", r.status >= 400 && r.type.includes("json"), [r.status, r.type]);

  // ---- Front Office (Next) ----
  for (const page of ["/front-office", "/gm", "/game", "/online", "/game/roster", "/game/trade", "/game/play", "/game/standings", "/game/player/abc", "/game/team/BOS"]) {
    const g = await get(page);
    ok("Front Office page " + page, g.status === 200 && g.type.includes("text/html") && g.text.includes("Front Office"), g.status);
  }
  r = await get("/front-office");
  ok("the Front Office hub still offers both of its games", r.text.includes("Open Front Office") && r.text.includes("Play Hardwood Legends") && r.text.includes('href="/gm"'), null);
  r = await get("/games/hardwood-legends.html");
  ok("Hardwood Legends is served", r.status === 200 && r.text.includes("Hardwood Legends"), r.status);
  r = await post("/api/refresh-data");
  ok("the Front Office API route still answers (Next owns it)", r.status === 403 && r.text.includes("only available when running locally"), [r.status, r.text.slice(0, 60)]);
  r = await post("/api/not-a-real-route", { code, name: "BootHost" });
  ok("an unknown API path is a 404", r.status === 404, r.status);
  r = await get("/definitely-not-a-page");
  ok("an unknown page is a 404", r.status === 404, r.status);

  // ---- memory, for the 512 MB free instance ----
  let rss = 0;
  try { rss = parseInt(require("child_process").execSync("ps -o rss= -p " + server.pid).toString().trim(), 10) / 1024; } catch (e) {}
  console.log("server memory after the checks: " + Math.round(rss) + " MB, boot time " + bootMs + " ms");
  ok("memory stays well inside the 512 MB free tier", rss > 0 && rss < 380, Math.round(rss));

  stop();
  await sleep(700);
  // put the save file back the way it was
  try { if (hadSave) fs.writeFileSync(save, hadSave); else fs.unlinkSync(save); } catch (e) {}
  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("CRASH", e && e.stack ? e.stack.split("\n").slice(0, 5).join(" | ") : e); process.exit(1); });
