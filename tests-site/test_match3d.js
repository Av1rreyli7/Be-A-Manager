// Checks for the 3D playable match. Run: node tests-site/test_match3d.js
// The game loop and the whole 3D scene run for real (real three.js scene graph, real sim).
// Only the WebGL renderer is stubbed, so this needs no browser and no GPU.
const fs = require("fs");
const path = require("path");
const fl = f => path.join(__dirname, "..", "floodlights", f);
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
const html = fs.readFileSync(fl("index.html"), "utf8");
const engine = fs.readFileSync(fl("match.js"), "utf8");
const view3dText = fs.readFileSync(fl("match3d.mjs"), "utf8");
const FL = require(fl("match.js"));

function testXI(base, tag) {
  const rows = [["GK", "GK"], ["DF", "LB"], ["DF", "CB"], ["DF", "CB"], ["DF", "RB"], ["MF", "CDM"], ["MF", "CM"], ["MF", "CAM"], ["FW", "LW"], ["FW", "ST"], ["FW", "RW"]];
  return rows.map((r, i) => ({ n: tag + " Player" + i, pos: r[0], role: r[1], r: base + (i % 3) - 1 }));
}

async function main() {
  // ---------- static checks ----------
  ok("match3d.mjs has no em or en dashes", !view3dText.includes(String.fromCharCode(8212)) && !view3dText.includes(String.fromCharCode(8211)), null);
  ok("the 3D view never imports three by itself, it is handed in", !/^\s*import\s/m.test(view3dText), null);
  ok("the page wires the 3D loader", html.includes("FLMatch.load3D") && html.includes('import("./match3d.mjs")') && html.includes('import("./vendor/three.module.js")'), null);
  ok("the page has styles for the 3D canvas", html.includes("#matchCanvas3d") && html.includes("#matchWrap.m3d"), null);
  ok("the engine exposes what the 3D view needs", FL.DIMS && FL.DIMS.HALF_L === 52.5 && FL.DIMS.HALF_W === 34 && typeof FL.pickKits === "function" && "load3D" in FL, Object.keys(FL));
  ok("the rules did not change: 6 minutes, 60 steps a second, 12 goal cap", FL.MATCH_SECONDS === 360 && Math.abs(FL.STEP - 1 / 60) < 1e-9 && FL.MAX_GOALS === 12, null);
  for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "Escape"]) ok("the controls still listen for " + key, engine.includes('"' + key + '"'), null);

  // ---------- the 3D view driven by a real match, renderer stubbed ----------
  const THREE = await import("three");
  const { createView3D } = await import("../floodlights/match3d.mjs");
  const renders = [];
  const stubRenderer = { setSize() {}, render(scene, camera) { renders.push([scene, camera]); }, dispose() { this.gone = true; } };
  const view = createView3D(THREE, { FL, renderer: stubRenderer, width: 1280, height: 720, document: null });
  ok("the view builds a scene and a camera", view.scene && view.scene.isScene && view.camera && view.camera.isPerspectiveCamera, null);
  ok("goals with nets are in the scene", view.nets.length === 2, view.nets.length);
  ok("the stadium has a crowd but stays light", view.stats().seats > 300 && view.stats().seats < 2500, view.stats().seats);

  const sim = FL.createSim({ home: "Arsenal", away: "Wolves", side: "home", homeXI: testXI(84, "H"), awayXI: testXI(78, "A") }, {});
  const fx = { shake: 0, net: [0, 0] };
  const finite = v => Number.isFinite(v.x + v.y + v.z);
  let steps = 0, problem = "", sawGoalEvent = false, maxCamJump = 0, lastCamX = null, hold = 0;
  while (!sim.m.done && steps < 60 * 60 * 12) {
    const m = sim.m, c = m.ctrl, b = m.ball, has = c && b.owner === c;
    // the same scripted keyboard player as the classic battery: run at goal, sprint, pass, charge and shoot
    const inp = { mx: 0, my: 0, sprint: true, shoot: false, pass: false };
    if (c) {
      const tx = has ? 52.5 : b.x, ty = has ? 0 : b.y;
      inp.mx = Math.sign(Math.round((tx - c.x) / 2));
      inp.my = Math.sign(Math.round((ty - c.y) / 2));
      if (has && 52.5 - c.x < 22 && Math.abs(c.y) < 16) { hold++; inp.shoot = hold < 36; if (hold >= 36) hold = 0; }
      else { hold = 0; inp.pass = steps % 240 === 0; }
    }
    sim.step(inp);
    steps++;
    for (const ev of sim.m.events.splice(0)) { view.onEvent(ev, sim); if (ev.type === "goal") { sawGoalEvent = true; fx.net[ev.team === 0 ? 1 : 0] = 1; fx.shake = 1; } }
    fx.shake = Math.max(0, fx.shake - 1 / 60); fx.net[0] = Math.max(0, fx.net[0] - 0.015); fx.net[1] = Math.max(0, fx.net[1] - 0.015);
    view.draw(sim, 1 / 60, fx);
    if (steps % 20 === 0 && !problem) {
      if (view.figures.size !== 22) problem = "not 22 figures: " + view.figures.size;
      for (const p of m.players) {
        const f = view.figures.get(p.id);
        if (!f) { problem = "player without a figure"; break; }
        if (Math.abs(f.g.position.x - p.x) > 1e-6 || Math.abs(f.g.position.z - p.y) > 1e-6 || f.g.position.y !== 0) { problem = "figure is not where the sim says"; break; }
      }
      if (Math.abs(view.ball.position.x - b.x) > 1e-6 || Math.abs(view.ball.position.z - b.y) > 1e-6) problem = "ball is not where the sim says";
      if (view.ball.position.y < 0.3) problem = "ball sank into the pitch";
      if (Math.abs(view.ballShadow.position.x - b.x) > 1e-6 || view.ballShadow.position.y > 0.1) problem = "ball shadow is off";
      if (!finite(view.camera.position)) problem = "camera is not a number";
      if (view.camera.position.z < 34 + 20 || view.camera.position.y < 20) problem = "camera left the gantry";
      if (Math.abs(view.camera.position.x - b.x) > 40) problem = "camera lost the ball: " + view.camera.position.x.toFixed(1) + " v " + b.x.toFixed(1);
      const q = view.project(b.x, b.y, b.z);
      if (!Number.isFinite(q.x + q.y)) problem = "projection is not a number";
      if (m.phase === "play" && (q.x < -200 || q.x > 1480 || q.y < -200 || q.y > 920)) problem = "ball is far off screen: " + q.x.toFixed(0) + "," + q.y.toFixed(0);
      if (m.ctrl && view.ring.visible && (Math.abs(view.ring.position.x - m.ctrl.x) > 1e-6 || Math.abs(view.ring.position.z - m.ctrl.y) > 1e-6)) problem = "control ring is not under my player";
    }
    if (lastCamX !== null) maxCamJump = Math.max(maxCamJump, Math.abs(view.camera.position.x - lastCamX));
    lastCamX = view.camera.position.x;
  }
  ok("a full keyboard driven match plays through the 3D view to full time", sim.m.done && sim.m.phase === "full", steps);
  ok("the 3D view stays in step with the sim all match", problem === "", problem);
  ok("one frame is drawn per step", renders.length === steps, [renders.length, steps]);
  ok("the camera follows smoothly, no jumps", maxCamJump < 6, maxCamJump);
  ok("the match still takes about 6 minutes", steps / 60 >= 360 && steps / 60 <= 480, steps / 60);
  ok("the score is still the sim's score", Number.isInteger(sim.result().home) && Number.isInteger(sim.result().away), sim.result());
  ok("my team is in its real shirt colour", view.figures.get(sim.m.teams[0].players.find(p => !p.gk).id).shirt.material.color.getHexString() === new THREE.Color(FL.pickKits("Arsenal", "Wolves")[0][0]).getHexString(), null);
  const tris = (() => { let n = 0; view.scene.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; n += (g.index ? g.index.count : g.getAttribute("position").count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n); })();
  ok("the whole scene stays light on geometry", tris < 60000, tris);
  view.dispose();
  ok("dispose empties the figures and leaves a borrowed renderer alone", view.figures.size === 0 && !stubRenderer.gone, null);

  // a second match with other clubs rebuilds the figures in the new colours
  const view2 = createView3D(THREE, { FL, renderer: stubRenderer, width: 800, height: 900, document: null });
  const auto = FL.createSim({ home: "Chelsea", away: "Liverpool", side: "away", homeXI: testXI(80, "H"), awayXI: testXI(80, "A") }, { auto: true });
  for (let i = 0; i < 600; i++) { auto.step(null); auto.m.events.length = 0; view2.draw(auto, 1 / 60, fx); }
  ok("an away match draws too, with me as team 0", view2.figures.size === 22 && auto.m.teams[0].name === "Liverpool", null);
  ok("no control ring when nobody is at the keyboard", view2.ring.visible === false, null);
  ok("a tall window still gets a sane field of view", view2.camera.fov >= 24 && view2.camera.fov <= 58 && Math.abs(view2.camera.aspect - 800 / 900) < 1e-6, view2.camera.fov);
  view2.dispose();

  // ---------- the real controller in a fake browser ----------
  const { JSDOM } = require("jsdom");
  const boot = () => {
    const dom = new JSDOM('<!DOCTYPE html><body><div id="matchWrap" class="hidden"><canvas id="matchCanvas"></canvas><div id="matchPanel" class="hidden"></div></div></body>', { runScripts: "outside-only" });
    const win = dom.window, doc = win.document;
    const calls = [];
    const sink = new Proxy(function () {}, {
      get: (t, k) => (k === "measureText" ? () => ({ width: 50 }) : k === "createRadialGradient" ? () => ({ addColorStop() {} }) : (...a) => { calls.push(k); return undefined; }),
      set: () => true
    });
    win.HTMLCanvasElement.prototype.getContext = () => sink;
    const st = { cb: null, now: 1000 };
    win.requestAnimationFrame = f => { st.cb = f; return 1; };
    win.cancelAnimationFrame = () => { st.cb = null; };
    win.eval(engine);
    const pump = (n, stop) => { for (let i = 0; i < n && st.cb; i++) { const f = st.cb; st.cb = null; st.now += 16.667; f(st.now); if (stop && stop()) break; } };
    return { win, doc, M: win.FLMatch, pump, calls, panel: doc.getElementById("matchPanel"), wrap: doc.getElementById("matchWrap") };
  };
  const settle = () => new Promise(r => setTimeout(r, 8));
  const setup = { home: "Home FC", away: "Away FC", side: "home", homeXI: testXI(80, "H"), awayXI: testXI(80, "A") };
  const info = { kind: "league", label: "League, week 1", home: "Home FC", away: "Away FC", side: "home", homeRating: 80, awayRating: 80 };
  const cfgFor = c => ({ info, kickoff: async () => setup, finish: async (hg, ag) => { c.finish.push([hg, ag]); return "Saved for the test."; }, simmed: () => c.simVal, recheck: async () => {}, closed: () => { c.closed++; } });

  // 1) no 3D loader on the page (or no WebGL): both looks are offered, 3D is switched off, Classic plays
  let B = boot(), c = { finish: [], closed: 0, simVal: null };
  B.M.open(cfgFor(c));
  ok("the match start screen offers 3D and Classic", !!B.doc.getElementById("mxLook3d") && B.doc.getElementById("mxLook3d").textContent === "3D" && !!B.doc.getElementById("mxLookClassic") && B.doc.getElementById("mxLookClassic").textContent === "Classic", B.panel.textContent.slice(0, 80));
  ok("the start screen still has Kick off and the one go warning", B.panel.textContent.includes("Kick off") && B.panel.textContent.includes("You get one go."), null);
  ok("without the 3D loader the 3D choice is off and Classic is picked", B.doc.getElementById("mxLook3d").disabled && B.doc.getElementById("mxLookClassic").classList.contains("on") && B.panel.textContent.includes("plays in Classic"), null);
  B.doc.getElementById("mxGo").click();
  await settle();
  B.pump(200);
  ok("Classic runs with no 3D view", B.M.isOpen() && !B.M.look3d() && !B.wrap.classList.contains("m3d") && B.panel.classList.contains("hidden"), null);
  ok("Classic paints the pitch itself", B.calls.includes("fillRect") && !B.calls.includes("clearRect"), null);
  B.M.close();

  // 2) 3D available: it is the default, the view is built at kick off and drawn every frame
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  const made = [];
  const fakeView = () => {
    const v = { draws: 0, events: [], disposed: 0, draw(sim, dt, fxx) { v.draws++; v.lastDt = dt; v.lastFx = fxx; }, onEvent(ev) { v.events.push(ev.type); }, project: (x, y) => ({ x: 640 + x * 8, y: 360 + y * 8, visible: true }), dispose() { v.disposed++; } };
    made.push(v);
    return v;
  };
  B.M.load3D = async () => opts => { made.opts = opts; return fakeView(); };
  B.M.open(cfgFor(c));
  ok("with 3D available it is offered and picked by default", !B.doc.getElementById("mxLook3d").disabled && B.doc.getElementById("mxLook3d").classList.contains("on") && !B.doc.getElementById("mxLookClassic").classList.contains("on"), null);
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(120);
  ok("kick off in 3D builds the 3D view once", made.length === 1 && B.M.look3d() && B.wrap.classList.contains("m3d"), made.length);
  ok("the 3D view gets the wrap, the HUD canvas and the engine", made.opts && made.opts.wrap === B.wrap && made.opts.canvas === B.doc.getElementById("matchCanvas") && made.opts.FL === B.M, null);
  ok("the 3D view is drawn every frame", made[0].draws >= 100, made[0].draws);
  ok("in 3D the HUD canvas is cleared, not painted over the scene", B.calls.includes("clearRect"), null);
  const d0 = made[0].draws;
  B.win.dispatchEvent(new B.win.KeyboardEvent("keydown", { code: "Escape" }));
  B.pump(30);
  ok("Esc still pauses in 3D and the scene holds still", B.panel.textContent.includes("Paused") && made[0].draws > d0 && made[0].lastDt === 0, [made[0].draws, made[0].lastDt]);
  B.doc.getElementById("mxRes").click();
  // the host sims mid match: the 3D match stops on the spot exactly like the classic one
  c.simVal = { home: "Home FC", away: "Away FC", hg: 2, ag: 0, note: "" };
  B.pump(40);
  ok("the host simmed screen shows over a 3D match", B.panel.textContent.includes("The host has simmed this week, your match was decided by the sim.") && B.panel.classList.contains("msolid") && c.finish.length === 0, B.panel.textContent.slice(0, 100));
  B.doc.getElementById("mxDone").click();
  ok("closing frees the 3D view", !B.M.isOpen() && made[0].disposed === 1 && !B.wrap.classList.contains("m3d") && c.closed === 1, made[0].disposed);

  // 3) a full match in 3D sends its score exactly once
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  made.length = 0;
  B.M.load3D = async () => () => fakeView();
  B.M.open(cfgFor(c));
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(60 * 60 * 12, () => c.finish.length > 0);
  await settle();
  ok("a finished 3D match sends its score exactly once", c.finish.length === 1 && Number.isInteger(c.finish[0][0]) && Number.isInteger(c.finish[0][1]), c.finish);
  ok("the full time screen shows after a 3D match", B.panel.textContent.includes("Full time") && B.panel.textContent.includes("Saved for the test."), B.panel.textContent.slice(0, 80));
  ok("the 3D view heard the match events", made[0].events.includes("full") && made[0].events.includes("half"), made[0].events.slice(0, 6));
  B.doc.getElementById("mxDone").click();

  // 4) picking Classic on the start screen wins over 3D, and is remembered while the page is open
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  made.length = 0;
  B.M.load3D = async () => () => fakeView();
  B.M.open(cfgFor(c));
  B.doc.getElementById("mxLookClassic").click();
  ok("clicking Classic moves the pick", B.doc.getElementById("mxLookClassic").classList.contains("on") && !B.doc.getElementById("mxLook3d").classList.contains("on"), null);
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(60);
  ok("Classic picked means no 3D view is built", made.length === 0 && !B.M.look3d() && B.M.isOpen(), made.length);
  B.M.close();

  // 5) the 3D code fails to load: the match still starts, in Classic
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  B.M.load3D = async () => { throw new Error("network down"); };
  B.M.open(cfgFor(c));
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(60);
  ok("if 3D cannot load the match starts in Classic anyway", B.M.isOpen() && !B.M.look3d() && B.panel.classList.contains("hidden"), B.panel.textContent.slice(0, 80));
  B.M.close();

  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("CRASH", e && e.stack ? e.stack.split("\n").slice(0, 6).join(" | ") : e); process.exit(1); });
