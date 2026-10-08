// Checks for the rebuilt 3D playable match. Run: node tests-site/test_match3d.js
// The engine (floodlights/m3d) and the whole 3D scene run for real; only the WebGL renderer is stubbed, so this
// needs no browser and no GPU. The last part plays whole matches headless and checks they finish cleanly, with
// goals at sensible rates, no NaN, no stuck states, and fouls and set pieces happening.
const fs = require("fs");
const path = require("path");
const fl = f => path.join(__dirname, "..", "floodlights", f);
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
const EM = String.fromCharCode(8212), EN = String.fromCharCode(8211);
const html = fs.readFileSync(fl("index.html"), "utf8");
const engine = fs.readFileSync(fl("match.js"), "utf8");
const serverText = fs.readFileSync(fl("server.js"), "utf8");
const FL = require(fl("match.js"));
const m3dFiles = fs.readdirSync(fl("m3d")).filter(f => f.endsWith(".mjs")).map(f => "m3d/" + f).concat(fs.readdirSync(fl("m3d/view")).filter(f => f.endsWith(".mjs")).map(f => "m3d/view/" + f));
const src = Object.fromEntries(m3dFiles.concat(["match3d.mjs", "match_sim3d.mjs"]).map(f => [f, fs.readFileSync(fl(f), "utf8")]));

function testXI(base, tag) {
  const rows = [["GK", "GK"], ["DF", "LB"], ["DF", "CB"], ["DF", "CB"], ["DF", "RB"], ["MF", "CDM"], ["MF", "CM"], ["MF", "CAM"], ["FW", "LW"], ["FW", "ST"], ["FW", "RW"]];
  return rows.map((r, i) => ({ n: tag + " Player" + i, pos: r[0], role: r[1], r: base + (i % 3) - 1, age: 22 + i }));
}
function seeded(s) { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return (x + 0.5) / 4294967296; }; }
const setupOf = (a, c, side) => ({ home: "Home FC", away: "Away FC", side: side || "home", homeXI: testXI(a, "H"), awayXI: testXI(c, "A") });

async function main() {
  // ================= static checks =================
  for (const [f, t] of Object.entries(src)) ok(f + " has no em or en dashes", !t.includes(EM) && !t.includes(EN), null);
  const viewFiles = m3dFiles.filter(f => f.startsWith("m3d/view/"));
  const simFiles = m3dFiles.filter(f => !f.startsWith("m3d/view/"));
  ok("the view never imports three by itself, it is handed in", viewFiles.every(f => !/from\s+["']three["']/.test(src[f]) && !/import\s+\*\s+as\s+THREE/.test(src[f])), null);
  ok("the engine imports only its own modules and touches no page", simFiles.every(f => (src[f].match(/^import[^;]*from\s+"([^"]+)"/gm) || []).every(x => x.includes("./")) && !src[f].includes("document.") && !src[f].includes("window.")), null);
  ok("the old 3D match is gone: the two entry files only point at the rebuilt engine and view", src["match3d.mjs"].includes('from "./m3d/view/index.mjs"') && src["match_sim3d.mjs"].includes('from "./m3d/sim.mjs"') && src["match3d.mjs"].length < 600 && src["match_sim3d.mjs"].length < 800, null);
  ok("the engine is split into its parts", ["ball", "body", "control", "kick", "defend", "keeper", "skills", "aerial", "ai", "rules", "user", "sim", "attrs"].every(n => src["m3d/" + n + ".mjs"]) && ["index", "rig", "anim", "camera", "pitch", "stadium", "hud"].every(n => src["m3d/view/" + n + ".mjs"]), null);
  ok("the page wires the 3D loader to the view and the engine", html.includes("FLMatch.load3D") && html.includes('import("./match3d.mjs")') && html.includes('import("./match_sim3d.mjs")') && html.includes('import("./vendor/three.module.js")') && html.includes("view.createSim = mods[2].createSim3D"), null);
  ok("the server serves the engine folder as scripts", serverText.includes('app.use("/floodlights/m3d"') && serverText.includes('"text/javascript; charset=utf-8"') && serverText.includes('app.get("/floodlights/match_sim3d.mjs"') && serverText.includes('app.get("/floodlights/match3d.mjs"'), null);
  ok("the server hands the match each player's age", serverText.includes("num: nums[team][p.id], age: p.age"), null);
  ok("the engine exposes what the 3D view needs", FL.DIMS && FL.DIMS.HALF_L === 52.5 && FL.DIMS.HALF_W === 34 && typeof FL.pickKits === "function" && "load3D" in FL, Object.keys(FL));
  ok("the rules did not change: 6 minutes, 60 steps a second, 12 goal cap", FL.MATCH_SECONDS === 360 && Math.abs(FL.STEP - 1 / 60) < 1e-9 && FL.MAX_GOALS === 12, null);
  for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "Escape", "KeyT", "KeyX", "KeyF", "Space", "KeyC", "KeyR", "KeyG", "KeyV", "KeyZ"]) ok("the controls listen for " + key, engine.includes('"' + key + '"'), null);
  ok("the base key map is kept and extended", engine.includes('const STRIP_KEYS = [["WASD", "Move"], ["Shift", "Sprint"], ["Q", "Pass"], ["T", "Through"], ["C", "Cross"], ["E", "Shoot"], ["R", "Finesse"], ["G", "Chip"], ["F", "Skill"], ["V", "Flair"], ["Z", "Shield"], ["Space", "Tackle"], ["X", "Slide"]];'), null);
  ok("the controls pass held keys, presses and releases with hold times to the 3D engine", engine.includes("inp.held = held; inp.down = down; inp.up = up;") && engine.includes("A.up[e.code] = Math.max(0.02") && engine.includes("A.down = {}; A.up = {};"), null);
  ok("Classic still gets exactly the inputs it had", engine.includes("through: A.throughQ") && engine.includes("slide: A.slideQ") && engine.includes("skill: A.skillQ") && engine.includes("tackle: !!k.Space"), null);
  for (const w of ["<kbd>T</kbd> Through ball", "<kbd>X</kbd> Slide tackle", "<kbd>F</kbd> Skill move", "<kbd>Space</kbd> Hold when defending", "Esc</kbd> Pause", "<kbd>R</kbd> finesse shot", "<kbd>Z</kbd> shield", "E then Q is a fake shot"]) ok("the help screen teaches: " + w.slice(0, 26), engine.includes(w), null);
  ok("the strip uses the site kit look and fades to about a third", engine.includes("var(--k-f-lbl") && engine.includes("var(--k-f-num") && engine.includes("var(--k-accent") && engine.includes(".mx-keys.dim{opacity:.3}"), null);
  ok("in 3D the view gets the events and the sub step position for smooth motion", engine.includes("if (A.view3d) A.view3d.onEvent(ev, A.sim); else A.view.onEvent(ev, A.sim);") && engine.includes("A.view3d.draw(A.sim, dtV, A.view.fx, A.acc / STEP)"), null);
  ok("the Classic sim never uses the 3D engine", !engine.slice(engine.indexOf("function createSim"), engine.indexOf("// LOOK")).includes("m3d"), null);

  // ================= the engine =================
  const S = await import("../floodlights/match_sim3d.mjs");
  const C = await import("../floodlights/m3d/consts.mjs");
  const ballM = await import("../floodlights/m3d/ball.mjs");
  const ctl = await import("../floodlights/m3d/control.mjs");
  const kick = await import("../floodlights/m3d/kick.mjs");
  const skills = await import("../floodlights/m3d/skills.mjs");
  const defend = await import("../floodlights/m3d/defend.mjs");
  const { createSim3D, deriveAttrs, deriveProfile, assignNumbers } = S;
  ok("the engine keeps the same match rules", S.MATCH_SECONDS === 360 && Math.abs(S.STEP - 1 / 60) < 1e-9 && S.MAX_GOALS === 12 && S.DIMS.HALF_L === 52.5, null);

  // ---------- attributes and identity ----------
  {
    const a90 = deriveAttrs({ n: "Star Winger", pos: "FW", role: "RW", r: 90 }), a60 = deriveAttrs({ n: "Star Winger", pos: "FW", role: "RW", r: 60 });
    ok("a 90 rated player beats a 60 rated one of the same role in every outfield attribute", ["acc", "spd", "agi", "dri", "ctl", "fin", "spa", "tck"].every(k => a90[k] > a60[k] + 15), [a90, a60]);
    ok("attributes stay in range and are deterministic", Object.values(a90).every(v => v >= 10 && v <= 99) && JSON.stringify(deriveAttrs({ n: "Star Winger", pos: "FW", role: "RW", r: 90 })) === JSON.stringify(a90), null);
    const st = deriveAttrs({ n: "Nine", role: "ST", r: 80 }), cb = deriveAttrs({ n: "Nine", role: "CB", r: 80 }), rw = deriveAttrs({ n: "Nine", role: "RW", r: 80 }), gk = deriveAttrs({ n: "Nine", role: "GK", r: 80 });
    ok("roles shape the attributes: a striker finishes, a centre back tackles, a winger runs, a keeper keeps", st.fin > cb.fin + 25 && cb.tck > st.tck + 35 && rw.spd > cb.spd + 8 && gk.gkd > st.gkd + 30, [st.fin, cb.fin, cb.tck, st.tck]);
    const old = deriveAttrs({ n: "Veteran", role: "CB", r: 80, age: 35 }), young = deriveAttrs({ n: "Veteran", role: "CB", r: 80, age: 22 });
    ok("age matters: the veteran has lost a yard but kept his head", old.spd < young.spd - 4 && old.com > young.com, [old.spd, young.spd]);
    const pf = deriveProfile({ n: "Quick One", role: "RW" }, deriveAttrs({ n: "Quick One", role: "RW", r: 88 }));
    const pc = deriveProfile({ n: "Big Stopper", role: "CB" }, deriveAttrs({ n: "Big Stopper", role: "CB", r: 80 }));
    ok("identity: the quick winger accelerates harder, turns sharper and is lighter than the big centre back", pf.burst > pc.burst && pf.turnHi > pc.turnHi && pf.mass < pc.mass && pf.h < pc.h + 0.05 && pc.stepMax > 1.8, [pf.burst, pc.burst, pf.turnHi, pc.turnHi]);
    const twins = [deriveProfile({ n: "A Smith", role: "CM" }, deriveAttrs({ n: "A Smith", role: "CM", r: 80 })), deriveProfile({ n: "B Jones", role: "CM" }, deriveAttrs({ n: "B Jones", role: "CM", r: 80 }))];
    ok("two players of the same rating and role still move differently", twins[0].stepMax !== twins[1].stepMax && twins[0].arm !== twins[1].arm && twins[0].upright !== twins[1].upright, null);
    const nums = assignNumbers([{ n: "a", role: "GK" }, { n: "b", role: "ST", num: 9 }, { n: "c", role: "ST", num: 9 }, { n: "d", role: "CB" }, { n: "e", role: "CM", num: 77 }]);
    ok("shirt numbers: the real number is kept, clashes resolved, unique", nums[1].num === 9 && nums[2].num !== 9 && nums[4].num === 77 && new Set(nums.map(p => p.num)).size === 5, nums.map(p => p.num));
  }

  // ---------- ball physics ----------
  {
    const run = (init, T) => { const b = Object.assign(ballM.createBall(), init); const m = { ball: b, players: [], events: [], t: 0 }; let maxZ = 0; for (let i = 0; i < T * 60; i++) { ballM.stepBall(m, 1 / 60); m.t += 1 / 60; maxZ = Math.max(maxZ, b.z); } return { b, maxZ, m }; };
    const p12 = run({ x: -40, vx: 12 }, 10);
    ok("a 12 m/s ground pass rolls 25 to 45 metres and stops (rolling resistance on grass)", p12.b.x + 40 > 25 && p12.b.x + 40 < 45 && Math.hypot(p12.b.vx, p12.b.vy) < 0.1, p12.b.x + 40);
    const lob = run({ x: -40, vx: 16.4, vz: 11.5, wy: -30 }, 4);
    ok("a lofted ball rises 5 to 8 metres and comes down", lob.maxZ > 5 && lob.maxZ < 8 && lob.b.z < 0.2, lob.maxZ);
    const curl = run({ x: -20, vx: 24, vz: 3, wz: 55 }, 1);
    ok("sidespin curls the ball (Magnus): more than a metre over 20 metres", curl.b.y > 1, curl.b.y);
    const drop = Object.assign(ballM.createBall(), { z: 2 });
    const dm = { ball: drop, players: [], events: [], t: 0 };
    let firstUp = 0;
    for (let i = 0; i < 120; i++) { ballM.stepBall(dm, 1 / 60); if (drop.vz > 0 && !firstUp) firstUp = drop.vz; }
    ok("a dropped ball bounces back up at a sensible fraction of its speed", firstUp > 2 && firstUp < 4.5, firstUp);
    const post = run({ x: 45, y: C.GOAL_HALF, z: 1.0, vx: 20 }, 0.5);
    ok("the post sends the ball back", post.b.vx < 0 && post.m.events.some(e => e.type === "post"), post.b.vx);
    const net = run({ x: 50, y: 0, z: 1.0, vx: 25 }, 1);
    ok("the net catches a goal: the ball stays in the goal and the net is hit", net.b.x > C.HALF_L && net.b.x < C.HALF_L + C.GOAL_DEPTH + 0.2 && !!net.b.netHit, [net.b.x, net.b.netHit]);
    const tr = ballM.predict(Object.assign(ballM.createBall(), { vx: 10 }), 2, 1 / 20, []);
    ok("the trajectory predictor agrees with the physics", tr.length === 41 && Math.abs(tr[40][1] - run({ vx: 10 }, 2).b.x) < 0.6, tr.length);
  }

  // ---------- scenario helpers ----------
  function clearPitch(m, keep) {
    for (const p of m.players) {
      if (keep.includes(p)) continue;
      p.x = p.team === 0 ? -48 : 48; p.y = p.gk ? 0 : -32 + (p.idx % 11) * 3; p.vx = 0; p.vy = 0; p.act = null; p.mode = "free";
    }
    m.phase = "play"; m.dead = false; m.restart = null; m.auto = true;
    const b = m.ball; b.ctrl = null; b.held = null; b.flight = null; b.vx = b.vy = b.vz = 0; b.z = C.BALL_R;
  }
  const freeze = (m, keep) => { for (const p of m.players) if (!keep.includes(p)) { p.want.spd = 0; p.ai.think = 99; p.act = null; } };
  const { stepBody } = await import("../floodlights/m3d/body.mjs");

  // ---------- locomotion: intention, body response, no snapping ----------
  function sprintTest(rating) {
    const sim = createSim3D(setupOf(rating, 70), { rng: seeded(7) });
    const m = sim.m, p = m.teams[0].players[8];
    clearPitch(m, [p]);
    p.x = -40; p.y = 20; p.vx = 0; p.vy = 0; p.face = 0; p.stam = 1; p.burstE = 1;
    let t90 = null;
    const top = p.prof.vmax;
    for (let i = 0; i < 180; i++) { p.want = { dx: 1, dy: 0, spd: top, face: null }; stepBody(m, p, 1 / 60); if (t90 === null && p.spd > top * 0.9 * (0.88 + 0.12)) t90 = (i + 1) / 60; }
    return { dist: p.x + 40, t90, top };
  }
  {
    const fast = sprintTest(92), slow = sprintTest(58);
    ok("three seconds of sprinting: the 92 rated runner covers clearly more ground than the 58", fast.dist > slow.dist * 1.12, [fast.dist, slow.dist]);
    ok("speed builds up: no instant top speed, 90 percent of it after 1 to 3.2 seconds", fast.t90 > 1 && fast.t90 < 3.2, fast.t90);
    // a full speed reversal: the body has to brake and pivot, it cannot spin on the spot
    const sim = createSim3D(setupOf(80, 70), { rng: seeded(9) });
    const m = sim.m, p = m.teams[0].players[8];
    clearPitch(m, [p]);
    p.x = 0; p.y = 0; p.face = 0; p.vx = p.prof.vmax * 0.95; p.vy = 0;
    let firstStep = null, reversed = null, minSp = 99;
    for (let i = 0; i < 120; i++) {
      p.want = { dx: -1, dy: 0, spd: p.prof.vmax, face: null };
      stepBody(m, p, 1 / 60);
      if (firstStep === null) firstStep = p.vx;
      minSp = Math.min(minSp, Math.hypot(p.vx, p.vy));
      if (reversed === null && p.vx < -2) reversed = (i + 1) / 60;
    }
    ok("input answers at once: the very first step already slows the runner", firstStep < p.prof.vmax * 0.95, firstStep);
    ok("a full speed about turn takes time (brake, plant, go): more than 0.6 s to be running the other way", reversed > 0.6 && reversed < 2.5, reversed);
    // strafing and backpedalling are slower than running forward
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.face = 0;
    for (let i = 0; i < 120; i++) { p.want = { dx: -1, dy: 0, spd: p.prof.vmax, face: 0 }; stepBody(m, p, 1 / 60); }
    ok("backpedalling is about half speed", Math.abs(p.vx) < p.prof.vmax * 0.55 && Math.abs(p.vx) > 2, p.vx);
    // footsteps: a foot plants every step, the same foot about two steps apart, nothing slides
    p.x = -30; p.y = 0; p.face = 0; p.vx = 0; p.vy = 0;
    const plants = [];
    for (let i = 0; i < 240; i++) { p.want = { dx: 1, dy: 0, spd: 6, face: null }; stepBody(m, p, 1 / 60); if (p.stepped >= 0) plants.push({ f: p.stepped, x: p.gait.feet[p.stepped].x, y: p.gait.feet[p.stepped].y }); }
    const same = plants.filter(q => q.f === 0);
    const gaps = same.slice(3).map((q, i) => q.x - same[i + 2].x);
    ok("the gait plants a foot each step, alternating, about a stride apart at speed", plants.length > 12 && plants.every((q, i) => i === 0 || q.f !== plants[i - 1].f) && gaps.every(g => g > 2 && g < 5.5), [plants.length, gaps.slice(0, 4)]);
    ok("planted feet sit either side of the line of running", Math.abs(plants[plants.length - 1].y - plants[plants.length - 2].y) > 0.12, null);
  }

  // ---------- dribbling: touches, never attached ----------
  {
    const sim = createSim3D(setupOf(84, 70), { rng: seeded(12) });
    const m = sim.m, p = m.teams[0].players[8];
    clearPitch(m, [p]);
    m.auto = false; m.ctrl = p;
    p.x = -30; p.y = 0; p.face = 0;
    m.ball.x = p.x + 0.4; m.ball.y = p.y; m.ball.ctrl = p; m.ball.last = p; m.ball.lastTeam = 0;
    // nobody to bother him: the other side is lying down
    for (const o of m.teams[1].players) { o.mode = "down"; o.modeT = 0; o.downT = 99; }
    let touches = 0, maxGap = 0, minGap = 9, kept = true;
    for (let i = 0; i < 360; i++) {
      sim.step({ mx: 1, my: 0, sprint: i > 150 });
      for (const e of m.events.splice(0)) if (e.type === "touch" && e.by === p.id) touches++;
      const gap = Math.hypot(m.ball.x - p.x, m.ball.y - p.y);
      maxGap = Math.max(maxGap, gap); minGap = Math.min(minGap, gap);
      if (m.ball.ctrl !== p) kept = false;
    }
    ok("dribbling is a series of touches, not a magnet: the ball moves away from the feet and back", touches > 6 && maxGap > 0.6 && minGap < 0.6, [touches, maxGap, minGap]);
    ok("an unpressed dribbler keeps the ball", kept, null);
    // close control versus a sprint: sprint touches push the ball further
    const knock = (sprint) => {
      const s2 = createSim3D(setupOf(84, 70), { rng: seeded(13) });
      const m2 = s2.m, q = m2.teams[0].players[8];
      clearPitch(m2, [q]); m2.auto = false; m2.ctrl = q;
      q.x = -30; q.y = 0; q.face = 0; q.vx = sprint ? 7 : 2; q.vy = 0;
      m2.ball.x = q.x + 0.4; m2.ball.y = 0; m2.ball.ctrl = q; m2.ball.last = q;
      let far = 0;
      for (let i = 0; i < 240; i++) { s2.step({ mx: 1, my: 0, sprint, held: { Z: !sprint }, down: {}, up: {} }); far = Math.max(far, Math.hypot(m2.ball.x - q.x, m2.ball.y - q.y)); }
      return far;
    };
    const fClose = knock(false), fSprint = knock(true);
    ok("sprint dribbling pushes the ball further ahead than close control", fSprint > fClose + 0.3, [fClose, fSprint]);
  }

  // ---------- the person's player: the ball goes where he goes, loose balls are his, the man on the ball is a real challenge ----------
  {
    const userInp = (mx, my, sprint) => ({ mx, my, sprint: !!sprint, held: {}, down: {}, up: {} });
    const farAway = (m, keep) => { for (const q of m.players) if (!keep.includes(q)) { q.x = 55 * (q.team ? 1 : -1); q.y = 37 * (q.idx % 2 ? 1 : -1); q.vx = q.vy = 0; q.want.spd = 0; q.ai.think = 99; } };
    // random sharp turns, sprinting and jogging, nobody near: he never runs away from the ball
    let lost = 0, gapMax = 0;
    for (let k = 0; k < 12; k++) {
      const sim = createSim3D(setupOf(75, 75), { rng: seeded(700 + k) });
      const m = sim.m, p = m.teams[0].players[7];
      clearPitch(m, [p]); m.auto = false; m.ctrl = p;
      p.x = 0; p.y = 0; p.face = 0;
      const b = m.ball; b.x = 0.4; b.y = 0; b.ctrl = p; b.last = p; b.lastTeam = 0;
      const r = seeded(40 + k);
      let a = 0, spr = false;
      for (let i = 0; i < 60 * 10; i++) {
        if (i % 24 === 0) { a += (r() - 0.5) * (r() < 0.3 ? 5.5 : 2.2); spr = r() < 0.5; }
        if (Math.abs(p.x) > 30 || Math.abs(p.y) > 20) a = Math.atan2(-p.y, -p.x);
        farAway(m, [p]);
        sim.step(userInp(Math.cos(a), Math.sin(a), spr)); m.events.length = 0;
        if (b.ctrl !== p) { lost++; break; }
        gapMax = Math.max(gapMax, Math.hypot(b.x - p.x, b.y - p.y));
      }
    }
    ok("the person's dribbler keeps the ball through sharp turns and sprints (it stays within a metre of his feet)", lost === 0 && gapMax < 1.1, [lost, gapMax]);
    // a loose ball last played by the other side: he runs onto it and it is his
    let got = 0;
    for (let k = 0; k < 20; k++) {
      const sim = createSim3D(setupOf(75, 75), { rng: seeded(720 + k) });
      const m = sim.m, p = m.teams[0].players[7];
      clearPitch(m, [p]); m.auto = false; m.ctrl = p;
      p.x = 0; p.y = 0; p.face = 0;
      const b = m.ball; b.x = 7 + k % 5; b.y = -6; b.vx = (k % 3) - 1; b.vy = 3 + (k % 4); b.last = m.teams[1].players[6]; b.lastTeam = 1; b.touchT = 1;
      for (let i = 0; i < 240 && b.ctrl !== p; i++) { farAway(m, [p]); sim.step(userInp(b.x + b.vx * 0.3 - p.x, b.y + b.vy * 0.3 - p.y, true)); m.events.length = 0; }
      if (b.ctrl === p) got++;
    }
    ok("the person collects a loose ball he runs onto", got === 20, got);
    // he runs into the man on the ball: a real challenge, not a free win. One of five things happens, and who wins
    // depends on the men (defending and strength against dribbling, balance and strength), the angle and the timing.
    // c carries the ball toward where its own goal attack points; p is the person's man, coming in as asked.
    const challengeRuns = (a, c0, pIdx, cIdx, place, inputOf, n, seed0) => {
      const tally = { won: 0, loose: 0, bounce: 0, beat: 0, foul: 0, none: 0, retry: 0, tackleBack: 0 };
      for (let k = 0; k < n; k++) {
        const sim = createSim3D(setupOf(a, c0), { rng: seeded(seed0 + k) });
        const m = sim.m, p = m.teams[0].players[pIdx], c = m.teams[1].players[cIdx];
        clearPitch(m, [p, c]); m.auto = false; m.ctrl = p;
        place(m, p, c, k);
        const b = m.ball; b.x = c.x + Math.cos(c.face) * 0.45; b.y = c.y + Math.sin(c.face) * 0.45; b.ctrl = c; b.last = c; b.lastTeam = 1;
        let out = null, outT = 0, again = false;
        for (let i = 0; i < 240; i++) {
          farAway(m, [p, c]);
          if (b.ctrl === c) { c.want.dx = Math.cos(c.face0); c.want.dy = Math.sin(c.face0); c.want.spd = c.run; c.ai.think = 99; }
          sim.step(inputOf(m, p, c));
          for (const e of m.events) if (e.type === "challenge" && e.by === p.id) { if (out) again = again || m.t - outT < 0.3; else { out = e.out; outT = m.t; } }
          m.events.length = 0;
          if (out && m.t - outT > 0.35) break;
        }
        tally[out || "none"]++;
        if (again) tally.retry++;
        if (out === "won" && defend.startTackle(m, c, false)) tally.tackleBack++;
      }
      return tally;
    };
    const toward = (m, p, c, sprint, jockey) => { const i = userInp(c.x - p.x, c.y - p.y, sprint); if (jockey) i.held.Z = true; return i; };
    // a strong centre back, set and face on, against a poor winger running at him
    const set = challengeRuns(86, 56, 2, 8, (m, p, c, k) => { p.x = 0; p.y = 0; p.face = 0; c.x = 6; c.y = (k % 5 - 2) * 0.2; c.face = c.face0 = Math.PI; c.run = 3.2; }, (m, p, c) => toward(m, p, c, false, true), 30, 760);
    // a weak midfielder sprinting into the back of a fine winger running away from him
    const back = challengeRuns(56, 86, 5, 10, (m, p, c, k) => { p.x = 0; p.y = 0; p.face = Math.PI; p.vx = -6; c.x = -1.6; c.y = (k % 5 - 2) * 0.15; c.face = c.face0 = Math.PI; c.vx = -2.5; c.run = 2.5; }, (m, p, c) => toward(m, p, c, true, false), 30, 800);
    // two even men, the person flying in face on at a sprint
    const fly = challengeRuns(75, 75, 6, 7, (m, p, c, k) => { p.x = 0; p.y = 0; p.face = 0; c.x = 9; c.y = (k % 5 - 2) * 0.2; c.face = c.face0 = Math.PI; c.run = 4; }, (m, p, c) => toward(m, p, c, true, false), 30, 840);
    ok("challenges: a strong defender, set and face on to a poor dribbler, wins most of them and gives nothing away", set.won + set.loose >= 18 && set.foul <= 2, set);
    ok("challenges: a weak man sprinting into the back of a fine dribbler hardly ever wins it and often gives away a foul", back.won + back.loose <= 5 && back.foul >= 6, back);
    ok("challenges: flying in face on is mistimed often, and the man knocks it past and goes", fly.beat >= 6 && fly.won + fly.loose < set.won + set.loose, fly);
    const all = [set, back, fly];
    ok("challenges: every outcome happens (won clean, poked loose, bounced off, knocked past, a foul)", ["won", "loose", "bounce", "beat", "foul"].every(k => all.some(t => t[k] > 0)), all);
    ok("challenges: one that is over cannot be tried again at once", all.every(t => t.retry === 0), all.map(t => t.retry));
    ok("challenges: the man who lost it clean cannot tackle straight back", all.some(t => t.won > 0) && all.every(t => t.tackleBack === 0), all.map(t => t.tackleBack));
    // the other way: the person runs the ball into a set defender, who challenges him the same way
    const into = { won: 0, loose: 0, bounce: 0, beat: 0, foul: 0, none: 0 };
    for (let k = 0; k < 30; k++) {
      const sim = createSim3D(setupOf(76, 76), { rng: seeded(880 + k) });
      const m = sim.m, p = m.teams[0].players[9], o = m.teams[1].players[2];
      clearPitch(m, [p, o]); m.auto = false; m.ctrl = p;
      p.x = 0; p.y = 0; p.face = 0; o.x = 8; o.y = (k % 5 - 2) * 0.2; o.face = Math.PI;
      const b = m.ball; b.x = 0.45; b.y = 0; b.ctrl = p; b.last = p; b.lastTeam = 0;
      let out = null;
      for (let i = 0; i < 240 && !out; i++) {
        farAway(m, [p, o]);
        sim.step(userInp(1, 0, true));
        for (const e of m.events) if (e.type === "challenge" && e.on === p.id && !out) out = e.out;
        m.events.length = 0;
      }
      into[out || "none"]++;
    }
    ok("challenges: a set defender the person runs the ball into challenges him the same way (he wins some, the man keeps it some)", into.won + into.loose >= 5 && into.bounce + into.beat >= 5 && into.none <= 5, into);
  }

  // ---------- first touch quality ----------
  {
    const grades = (rating, speed) => {
      const tally = { good: 0, bad: 0 };
      for (let k = 0; k < 40; k++) {
        const sim = createSim3D(setupOf(rating, 70), { rng: seeded(100 + k) });
        const m = sim.m, p = m.teams[0].players[6];
        clearPitch(m, [p]);
        p.x = 0; p.y = 0; p.face = Math.PI; p.vx = 0; p.vy = 0;
        m.ball.x = 5; m.ball.y = 0; m.ball.vx = -speed; m.ball.z = C.BALL_R;
        const g = ctl.firstTouch(m, p, 0);
        if (g === "perfect" || g === "good") tally.good++; else tally.bad++;
      }
      return tally;
    };
    const elite = grades(90, 9), poor = grades(58, 9), poorFast = grades(58, 22);
    ok("first touch: a 90 rated player controls a normal pass far more cleanly than a 58", elite.good > poor.good + 8, [elite, poor]);
    ok("first touch: a fast pass is harder to control than a normal one", poorFast.good < poor.good, [poor, poorFast]);
  }

  // ---------- kicks: passes arrive, shots by finishing, curve ----------
  {
    const sim = createSim3D(setupOf(85, 70), { rng: seeded(21) });
    const m = sim.m, p = m.teams[0].players[6], q = m.teams[0].players[9];
    clearPitch(m, [p, q]);
    p.x = -10; p.y = 0; p.face = 0; q.x = 8; q.y = 6;
    m.ball.x = p.x + 0.38; m.ball.y = 0; m.ball.ctrl = p; m.ball.last = p; m.ball.lastTeam = 0;
    const spec = kick.planPass(m, p, Math.atan2(q.y - p.y, q.x - p.x), null, {});
    ok("the pass planner picks the team mate in that direction", spec.to === q, spec.to && spec.to.name);
    kick.startKick(m, p, spec);
    let reached = false;
    freeze(m, [p, q]);
    for (let i = 0; i < 200 && !reached; i++) { sim.step({ mx: 0, my: 0 }); m.events.splice(0); if (Math.hypot(m.ball.x - q.x, m.ball.y - q.y) < 1.2) reached = true; }
    ok("a short pass gets to the team mate", reached, [m.ball.x, m.ball.y]);
    const shots = (rating, kind) => {
      let on = 0, speeds = [], lat = [];
      for (let k = 0; k < 40; k++) {
        const s2 = createSim3D(setupOf(rating, 60), { rng: seeded(300 + k) });
        const m2 = s2.m, sh = m2.teams[0].players[9];
        clearPitch(m2, [sh]);
        for (const g of m2.players) if (g.gk) { g.x = 80; }
        sh.x = 34; sh.y = 4; sh.face = 0; sh.stam = 1; sh.bal = 1;
        m2.ball.x = sh.x + 0.38; m2.ball.y = sh.y - 0.12; m2.ball.ctrl = sh; m2.ball.last = sh;
        const sp = kick.planShot(m2, sh, 0.95, 0.6, kind);
        kick.startKick(m2, sh, sp);
        let v0 = 0;
        for (let i = 0; i < 100; i++) {
          s2.step({ mx: 0, my: 0 });
          for (const e of m2.events.splice(0)) if (e.type === "kick") v0 = Math.hypot(m2.ball.vx, m2.ball.vy, m2.ball.vz);
          if (Math.abs(m2.ball.x) > C.HALF_L) break;
        }
        if (Math.abs(m2.ball.y) < C.GOAL_HALF && m2.ball.z < C.BAR_H && m2.ball.x > C.HALF_L) on++;
        speeds.push(v0);
      }
      return { on, v: speeds.reduce((a, b) => a + b, 0) / speeds.length };
    };
    const good = shots(90, "shot"), bad = shots(58, "shot"), power = shots(85, "power"), fin = shots(85, "finesse");
    ok("shooting: a 90 rated finisher hits the target more often than a 58 from 18 metres", good.on > bad.on + 3, [good.on, bad.on]);
    ok("power shots fly faster than finesse shots", power.v > fin.v + 4, [power.v, fin.v]);
    ok("attributes give odds, not certainties: the 90 still misses sometimes and the 58 still scores sometimes", good.on < 40 && bad.on > 0, [good.on, bad.on]);
  }

  // ---------- keepers ----------
  {
    const keepTest = rating => {
      let saved = 0, goals = 0;
      for (let k = 0; k < 24; k++) {
        const s2 = createSim3D(setupOf(75, rating), { rng: seeded(500 + k) });
        const m2 = s2.m, sh = m2.teams[0].players[9], gk = m2.teams[1].gk;
        clearPitch(m2, [sh, gk]);
        gk.x = C.HALF_L - 1.2; gk.y = 0; gk.face = Math.PI;
        sh.x = 36; sh.y = (k % 5 - 2) * 2; sh.face = 0;
        m2.ball.x = sh.x + 0.38; m2.ball.y = sh.y; m2.ball.ctrl = sh; m2.ball.last = sh; m2.ball.lastTeam = 0;
        kick.startKick(m2, sh, kick.planShot(m2, sh, (k % 2 ? 1 : -1) * 0.7, 0.55, "shot"));
        for (let i = 0; i < 150; i++) { s2.step({ mx: 0, my: 0 }); for (const e of m2.events.splice(0)) { if (e.type === "save") saved++; if (e.type === "goal") goals++; } if (m2.phase !== "play") break; }
      }
      return { saved, goals };
    };
    const strongK = keepTest(90), weakK = keepTest(55);
    ok("keepers: a 90 rated keeper lets in clearly fewer of the same shots than a 55", strongK.goals + 4 <= weakK.goals && strongK.saved > 0, [strongK, weakK]);
    // positioning: the keeper stands on the line from the goal centre to the ball
    const s3 = createSim3D(setupOf(75, 80), { rng: seeded(31) });
    const m3 = s3.m, gk = m3.teams[1].gk;
    clearPitch(m3, [gk]);
    m3.ball.x = 30; m3.ball.y = 15;
    for (let i = 0; i < 180; i++) { s3.step({ mx: 0, my: 0 }); m3.events.splice(0); }
    const ang = Math.atan2(15 - 0, 30 - C.HALF_L), angK = Math.atan2(gk.y, gk.x - C.HALF_L);
    ok("keepers narrow the angle: on the line from the goal to the ball, off his line", Math.abs(ang - angK) < 0.35 && gk.x < C.HALF_L - 1, [ang, angK, gk.x, gk.y]);
  }

  // ---------- defending ----------
  {
    let won = 0, fouls = 0, tries = 0;
    for (let k = 0; k < 30; k++) {
      const s2 = createSim3D(setupOf(85, 70), { rng: seeded(700 + k) });
      const m2 = s2.m, d = m2.teams[0].players[2], a = m2.teams[1].players[8];
      clearPitch(m2, [d, a]);
      a.x = 0; a.y = 0; a.face = Math.PI; a.vx = -3;
      d.x = -1.3; d.y = 0; d.face = 0;
      m2.ball.x = a.x - 0.75; m2.ball.y = 0; m2.ball.ctrl = a; m2.ball.last = a; m2.ball.lastTeam = 1; m2.ball.touchT = 0.3;
      if (defend.startTackle(m2, d, false)) tries++;
      for (let i = 0; i < 50; i++) { s2.step({ mx: 0, my: 0 }); for (const e of m2.events.splice(0)) { if (e.type === "tackle" && e.won) won++; if (e.type === "foul") fouls++; } }
    }
    ok("standing tackles: a well timed one on an exposed ball wins it often, but not always", tries === 30 && won > 10 && won < 30, [won, fouls]);
    // a late slide from behind on the man: a foul
    let slideFouls = 0, slides = 0;
    for (let k = 0; k < 20; k++) {
      const s2 = createSim3D(setupOf(80, 80), { rng: seeded(800 + k) });
      const m2 = s2.m, d = m2.teams[0].players[2], a = m2.teams[1].players[8];
      clearPitch(m2, [d, a]);
      // the man stands on the ball facing away; the slide comes in straight through his legs from behind
      a.x = 0; a.y = 0; a.face = 0; a.vx = 0; a.ai.think = 99; a.want.spd = 0;
      d.x = -2.6; d.y = 0; d.face = 0; d.vx = 6;
      m2.ball.x = a.x + 0.45; m2.ball.y = 0; m2.ball.ctrl = a; m2.ball.last = a; m2.ball.lastTeam = 1;
      if (s2.startSlide(d, 0)) slides++;
      for (let i = 0; i < 70; i++) { s2.step({ mx: 0, my: 0 }); for (const e of m2.events.splice(0)) if (e.type === "foul") slideFouls++; }
    }
    ok("slide tackles: a late slide through the man from behind is a foul", slides === 20 && slideFouls >= 12, [slides, slideFouls]);
  }

  // ---------- skill moves ----------
  {
    const ids = Object.keys(skills.SKILLS);
    ok("thirty skill moves are defined, each with its own name, contacts and timing", ids.length === 30 && ids.every(id => skills.SKILLS[id].name && skills.SKILLS[id].touches.length >= 1 && skills.SKILLS[id].dur > 0.3), ids.length);
    const contacts = {}, failedStart = [];
    for (const id of ids) {
      const s2 = createSim3D(setupOf(92, 60), { rng: seeded(900) });
      const m2 = s2.m, p = m2.teams[0].players[8];
      clearPitch(m2, [p]);
      m2.auto = true; p.ai.think = 99;
      p.prof.stars = 5;
      p.x = 0; p.y = 0; p.face = 0; p.vx = 3;
      m2.ball.x = 0.4; m2.ball.y = 0; m2.ball.ctrl = p; m2.ball.last = p;
      if (!skills.startSkill(m2, p, id, 1)) { failedStart.push(id); continue; }
      contacts[id] = 0;
      for (let i = 0; i < 70; i++) { s2.step({ mx: 0, my: 0 }); for (const e of m2.events.splice(0)) if (e.type === "touch" && e.by === p.id) contacts[id]++; }
    }
    ok("every skill move starts from a run", failedStart.length === 0, failedStart);
    ok("every skill move actually plays the ball (its own contacts)", Object.values(contacts).every(c => c >= 1), Object.entries(contacts).filter(([k, v]) => v < 1));
    // the elite do it quicker, a one star player gets a simpler move
    const s4 = createSim3D(setupOf(92, 60), { rng: seeded(901) }), m4 = s4.m, ace = m4.teams[0].players[8];
    ace.prof.stars = 5; skills.startSkill(m4, ace, "elastico", 1);
    const s5 = createSim3D(setupOf(58, 60), { rng: seeded(901) }), m5 = s5.m, plod = m5.teams[0].players[2];
    plod.prof.stars = 1; skills.startSkill(m5, plod, "elastico", 1);
    ok("a five star dribbler does the elastico; a one star player falls back to a body feint", ace.act.id === "elastico" && plod.act.id === "body_feint", [ace.act.id, plod.act.id]);
    const s6 = createSim3D(setupOf(60, 60), { rng: seeded(902) }), m6 = s6.m, mid = m6.teams[0].players[8];
    mid.prof.stars = 5; skills.startSkill(m6, mid, "elastico", 1);
    ok("elite technique executes the same move faster", ace.act.T < mid.act.T, [ace.act.T, mid.act.T]);
    // the key map: F with a direction relative to the body
    const pk = skills.pickSkill({ prof: { foot: 1 } }, "F", 0, true), pk2 = skills.pickSkill({ prof: { foot: 1 } }, "F", Math.PI, true), pk3 = skills.pickSkill({ prof: { foot: 1 } }, "V", 0.8, true), pk4 = skills.pickSkill({ prof: { foot: 1 } }, "VV", 0, true);
    ok("skill keys: F forward is a stepover, F back a drag back, V diagonal an elastico, V twice forward a rainbow", pk.id === "stepover" && pk2.id === "drag_back" && /elastico/.test(pk3.id) && pk4.id === "rainbow", [pk.id, pk2.id, pk3.id, pk4.id]);
    // a feint fools a defender in front: he leans the wrong way
    const s7 = createSim3D(setupOf(90, 70), { rng: seeded(903) }), m7 = s7.m, dr = m7.teams[0].players[8], df = m7.teams[1].players[2];
    clearPitch(m7, [dr, df]);
    dr.x = 0; dr.y = 0; dr.face = 0; df.x = 2.5; df.y = 0; df.face = Math.PI; dr.prof.stars = 5;
    m7.ball.x = 0.4; m7.ball.ctrl = dr; m7.ball.last = dr;
    skills.startSkill(m7, dr, "stepover", 1);
    for (let i = 0; i < 25; i++) { s7.step({ mx: 0, my: 0 }); m7.events.splice(0); }
    ok("feints work on the defender's reading: he is fooled for a moment", !!df.feinted && df.feinted.k > 0, df.feinted);
  }

  // ---------- the person in control ----------
  {
    const sim = createSim3D(setupOf(80, 70), { rng: seeded(41) });
    const m = sim.m;
    // let the kick off happen
    for (let i = 0; i < 400 && m.phase !== "play"; i++) { sim.step({ mx: 0, my: 0, held: {}, down: {}, up: {} }); m.events.splice(0); }
    ok("the match kicks off and comes alive (on its own after a short wait if nobody presses)", m.phase === "play", m.phase);
    const p = m.ctrl;
    ok("a player is under the person's control", !!p && p.team === 0, null);
    const v0 = Math.hypot(p.vx, p.vy);
    sim.step({ mx: 0, my: 1, sprint: true, held: {}, down: {}, up: {} });
    ok("the controlled player answers the stick on the very next step", Math.hypot(p.vx, p.vy) !== v0 || p.want.dy > 0, null);
    // switching on defence with Q
    const before = m.ctrl;
    m.ball.ctrl = m.teams[1].players[9]; m.ball.x = m.teams[1].players[9].x; m.ball.y = m.teams[1].players[9].y;
    sim.step({ mx: 0, my: 0, held: {}, down: { Q: true }, up: {} });
    ok("Q switches player when defending", m.ctrl && m.ctrl.team === 0, null);
  }

  // ================= the view on a stub renderer =================
  {
    const THREE = await import("../node_modules/three/build/three.module.js");
    const { createView3D } = await import("../floodlights/match3d.mjs");
    const renders = [];
    const stubRenderer = { setSize() {}, render(scene, camera) { renders.push(1); }, dispose() { this.gone = true; }, setPixelRatio() {}, shadowMap: {}, info: { render: { calls: 0, triangles: 0 } } };
    const view = createView3D(THREE, { FL, renderer: stubRenderer, width: 1280, height: 720, document: null });
    const sim = createSim3D(setupOf(82, 78), { rng: seeded(51), auto: true });
    const m = sim.m;
    let nan = 0, frames = 0, ms = 0;
    const v = new THREE.Vector3();
    while (m.phase !== "full" && frames < 60 * 600) {
      sim.step({ mx: 0, my: 0 });
      const evs = m.events.splice(0);
      for (const e of evs) view.onEvent(e, sim);
      const a = Date.now();
      view.draw(sim, 1 / 60, {}, 1);
      ms += Date.now() - a;
      frames++;
      if (frames % 900 === 0) for (const F of view.figures.values()) { F.root.updateMatrixWorld(true); for (const b of F.rig.bones) { b.getWorldPosition(v); if (!isFinite(v.x + v.y + v.z)) nan++; } }
    }
    ok("the view builds 22 skinned players with their own rigs", view.figures.size === 22 && [...view.figures.values()].every(F => F.mesh.isSkinnedMesh && F.rig.bones.length >= 24), view.figures.size);
    ok("the view draws a whole match with no NaN anywhere in the bodies", nan === 0 && renders.length === frames && m.phase === "full", [nan, renders.length, frames]);
    ok("the view is cheap: under 3 ms a frame in node (stub renderer)", ms / frames < 3, (ms / frames).toFixed(2));
    const heights = [...view.figures.values()].map(F => F.p.prof.h);
    ok("players differ in build: heights spread over at least 12 cm", Math.max(...heights) - Math.min(...heights) > 0.12, heights);
    view.setQuality(0); view.setQuality(2);
    ok("quality steps work", view.quality() === 2, null);
    view.dispose();
    ok("dispose empties the figures and leaves a borrowed renderer alone", view.figures.size === 0 && !stubRenderer.gone, null);
  }

  // ================= player lock (Player Career) =================
  {
    const indexHtml = fs.readFileSync(fl("index.html"), "utf8");
    ok("player lock: the page opens a live Player Career match from #pcmatch through the same overlay", indexHtml.includes('location.hash !== "#pcmatch"') && indexHtml.includes('post("/api/pc/matchstart")') && indexHtml.includes('post("/api/pc/matchresult"') && indexHtml.includes("FLMatch.open({"), null);
    ok("player lock: its own key strip and help, 3D only, and the finished sim goes to the page", engine.includes("const STRIP_KEYS_LOCK = ") && engine.includes("lockKeysHtml(cfg)") && engine.includes("(!!cfg.lock || readLook()") && engine.includes("cfg.finish(Math.min(MAX_GOALS, r.home), Math.min(MAX_GOALS, r.away), A.sim)"), null);
    ok("player lock: Classic is untouched by it", !/cfg\.lock|m\.lock|lockLine|STRIP_KEYS_LOCK/.test(engine.slice(engine.indexOf("function createSim"), engine.indexOf("// LOOK"))), null);
    ok("player lock: a normal match has no lock", createSim3D(setupOf(78, 76), { rng: seeded(3) }).m.lock === null, null);
    const lockXI = idx => { const xi = testXI(78, "H"); xi[idx].pc = true; xi[idx].n = "Locked Man"; xi[idx].look = { skinF: 0.4, hair: 5, beard: 2, watch: "gold" }; return xi; };
    let switched = 0, finished = 0, toHim = 0, calls = 0, setPiecesHis = 0, setPiecesOthers = 0, ratings = [], lines = [];
    for (let k = 0; k < 3; k++) {
      const sim = createSim3D({ home: "Home FC", away: "Away FC", side: k === 1 ? "away" : "home", homeXI: k === 1 ? testXI(76, "A") : lockXI(9), awayXI: k === 1 ? lockXI(7) : testXI(76, "A"), instruction: { kind: "shots", n: 3, text: "Get shots away" } }, { rng: seeded(900 + k) });
      const m = sim.m, L = m.lock;
      if (k === 0) {
        ok("player lock: the marked row is the one he controls, in his own look", L && L.name === "Locked Man" && m.ctrl === L && L.prof.skinF === 0.4 && L.prof.watch === "gold", L && L.name);
        ok("player lock: the manager's instruction is on the match", m.instruction && m.instruction.kind === "shots", null);
      }
      let steps = 0, eH = 0, lastCall = -9;
      while (m.phase !== "full" && steps++ < 60 * 700) {
        const b = m.ball, inp = { mx: 0, my: 0, sprint: false, held: {}, down: {}, up: {} };
        const gx = m.teams[0].dir * C.HALF_L;
        if (b.ctrl === L) { const dx = gx - L.x, dy = -L.y, d = Math.hypot(dx, dy); inp.mx = dx / d; inp.my = dy / d; if (d < 22) { if (eH < 0.45) { inp.held.E = true; eH += 1 / 60; } else { inp.up.E = eH; eH = 0; } } }
        else if (b.ctrl && b.ctrl.team === 0) { const dx = b.x + m.teams[0].dir * 6 - L.x, dy = -b.y * 0.3 - L.y, d = Math.hypot(dx, dy) || 1; if (d > 2) { inp.mx = dx / d; inp.my = dy / d; } if (steps % 90 === 0) { inp.down.Q = true; calls++; lastCall = m.t; } if (steps % 400 === 200) inp.down.T = true; }
        else { const dx = b.x - L.x, dy = b.y - L.y, d = Math.hypot(dx, dy) || 1; if (d < 20) inp.held.S = true; else { inp.mx = dx / d; inp.my = dy / d; } }
        if (m.phase === "restart" && m.restart && m.restart.team === 0 && m.restart.ready) { if (m.restart.taker === L) setPiecesHis++; else setPiecesOthers++; }
        sim.step(inp);
        if (m.ctrl && m.ctrl !== L) switched++; // a red card leaves no one under control, never someone else
        for (const e of m.events) if (e.type === "kick" && e.to === L.id && e.by !== L.id) toHim++;
        m.events.length = 0;
      }
      if (m.phase === "full") finished++;
      const line = sim.lockLine();
      lines.push(line);
      ratings.push(line.rating);
    }
    ok("player lock: three full matches finish (home and away)", finished === 3, finished);
    ok("player lock: control never leaves him, not even at a set piece someone else takes", switched === 0 && setPiecesOthers > 0, [switched, setPiecesOthers, setPiecesHis]);
    ok("player lock: team mates pass to him in a real match when he calls", toHim >= 2 && calls > 10, [toHim, calls]);
    // the call itself: a team mate on the ball with him free ahead looks for him first once he calls
    let answered = 0, unasked = 0;
    for (let k = 0; k < 10; k++) {
      for (const call of [true, false]) {
        const sim = createSim3D({ home: "Home FC", away: "Away FC", side: "home", homeXI: lockXI(9), awayXI: testXI(76, "A") }, { rng: seeded(960 + k) });
        const m = sim.m, L = m.lock, q = m.teams[0].players[6], o = m.teams[0].players[7], d = m.teams[1].players[3];
        clearPitch(m, [L, q, o, d]); m.auto = false; m.ctrl = L;
        // another free man is the safe ball; the lane to him has a man near it, so only his call makes it worth it
        q.x = -10; q.y = 0; q.face = 0; L.x = 8; L.y = 10 + (k % 3); L.face = Math.PI; o.x = -2; o.y = -7 - (k % 2); d.x = 3; d.y = 5; d.face = Math.PI;
        const b = m.ball; b.x = q.x + 0.4; b.y = 0; b.ctrl = q; b.last = q; b.lastTeam = 0; q.ai.think = 0.5;
        let passed = false;
        for (let i = 0; i < 150; i++) {
          o.want.spd = 0; o.ai.think = 9; d.want.spd = 0; d.ai.think = 9; d.x = 3; d.y = 5;
          sim.step({ mx: 0, my: 0, held: {}, down: call && i === 2 ? { Q: true } : {}, up: {} });
          for (const e of m.events) if (e.type === "kick" && e.by === q.id) { passed = e.to === L.id; i = 999; }
          m.events.length = 0;
        }
        if (passed) { if (call) answered++; else unasked++; }
      }
    }
    ok("player lock: a team mate on the ball plays the riskier ball to him when he calls, and not when he does not", answered >= 8 && unasked <= 2, [answered, unasked]);
    ok("player lock: his line and live rating are sane", lines.every(l => l && [l.g, l.a, l.shots, l.passes, l.passOk, l.won, l.rating].every(Number.isFinite) && l.rating >= 3 && l.rating <= 10 && l.passOk <= l.passes && l.onTarget <= l.shots), lines);
    const idle = createSim3D({ home: "Home FC", away: "Away FC", side: "home", homeXI: lockXI(7), awayXI: testXI(76, "A") }, { rng: seeded(77) });
    let n2 = 0;
    while (idle.m.phase !== "full" && n2++ < 60 * 700) { idle.step({ mx: 0, my: 0, held: {}, down: {}, up: {} }); idle.m.events.length = 0; }
    ok("player lock: a player who does nothing gets a poor or ordinary rating, never a good one", idle.m.phase === "full" && idle.lockLine().rating <= 6.6, idle.lockLine().rating);
  }

  // ================= player lock at every stage: a youth side and a pro side, a good game and a bad one =================
  {
    const lockM = await import("../floodlights/m3d/lock.mjs");
    const look = { skinF: 0.62, hair: 9, hairCol: 1, beard: 2, muscle: 0.7, watch: "gold", boot: 7, h: 1.78, mass: 70 };
    // a side the way the career sends it: a normal 4-3-3 around one strength, his row marked pc with his look
    const careerXI = (base, tag, ages, meIdx) => testXI(base, tag).map((r, i) => Object.assign(r, { age: ages[0] + (i % (ages[1] - ages[0] + 1)) }, i === meIdx ? { n: tag + " Me", pc: true, look, num: 9, r: base + 4 } : {}));
    const setups = {
      youth: side => ({ kind: "youth", home: "Ascend School", away: "Campion School", side, homeXI: side === "home" ? careerXI(52, "Y", [14, 16], 9) : careerXI(53, "C", [14, 16], -1), awayXI: side === "home" ? careerXI(53, "C", [14, 16], -1) : careerXI(52, "Y", [14, 16], 9), instruction: { kind: "shots", n: 3 } }),
      pro: side => ({ kind: "league", home: "Pro Town", away: "Pro City", side, homeXI: side === "home" ? careerXI(77, "P", [21, 31], 9) : careerXI(76, "Q", [21, 31], -1), awayXI: side === "home" ? careerXI(76, "Q", [21, 31], -1) : careerXI(77, "P", [21, 31], 9), instruction: { kind: "shots", n: 3 } })
    };
    // two people at the keys: one plays well (runs at goal, shoots, passes forward, calls for it, presses),
    // one gives it away (calls for it, then walks it into their players, and never presses, passes or shoots)
    const bots = {
      good: (m, L, st) => {
        const b = m.ball, inp = { mx: 0, my: 0, held: {}, down: {}, up: {} }, gx = m.teams[0].dir * C.HALF_L;
        if (b.ctrl === L) {
          const dx = gx - L.x, dy = -L.y, d = Math.hypot(dx, dy);
          let ux = dx / d, uy = dy / d;
          st.had = (st.had || 0) + 1;
          // a man in the way: go round him, or if he is right there and a team mate is free further on, give it
          let block = null;
          for (const o of m.teams[1].players) {
            if (o.off || o.gk) continue;
            const rx = o.x - L.x, ry = o.y - L.y, ah = rx * ux + ry * uy, lat = -rx * uy + ry * ux;
            if (ah > 0 && ah < 5 && Math.abs(lat) < 2 && (!block || ah < block.ah)) block = { ah, lat };
          }
          if (block) { const sd = block.lat > 0 ? -1 : 1, nx = ux - uy * sd * 0.9, ny = uy + ux * sd * 0.9, nl = Math.hypot(nx, ny); ux = nx / nl; uy = ny / nl; }
          inp.mx = ux; inp.my = uy;
          if (d < 22) { if ((st.eH || 0) < 0.45) { inp.held.E = true; st.eH = (st.eH || 0) + 1 / 60; } else { inp.up.E = st.eH; st.eH = 0; } }
          else if (block && block.ah < 2.5 && st.had > 20) {
            let mate = null, ms = -1e9;
            for (const q of m.teams[0].players) {
              if (q === L || q.off || q.gk) continue;
              let free = 9; for (const o of m.teams[1].players) if (!o.off) free = Math.min(free, Math.hypot(o.x - q.x, o.y - q.y));
              const fwd = (q.x - L.x) * m.teams[0].dir, dq = Math.hypot(q.x - L.x, q.y - L.y);
              const sc = Math.min(free, 6) * 2 + fwd * 0.3 - Math.abs(dq - 15) * 0.2;
              if (free > 3 && dq > 6 && dq < 30 && sc > ms) { ms = sc; mate = q; }
            }
            if (mate) { const qx = mate.x - L.x, qy = mate.y - L.y, ql = Math.hypot(qx, qy); inp.mx = qx / ql; inp.my = qy / ql; inp.up.Q = 0.35; st.had = 0; }
          }
        } else {
          st.had = 0;
          if (b.ctrl && b.ctrl.team === 0) { const dx = b.x + m.teams[0].dir * 6 - L.x, dy = -b.y * 0.3 - L.y, d = Math.hypot(dx, dy) || 1; if (d > 2) { inp.mx = dx / d; inp.my = dy / d; } if (st.n % 90 === 0) inp.down.Q = true; }
          else { const dx = b.x - L.x, dy = b.y - L.y, d = Math.hypot(dx, dy) || 1; if (d < 20) inp.held.S = true; else { inp.mx = dx / d; inp.my = dy / d; } }
        }
        return inp;
      },
      bad: (m, L, st) => {
        const b = m.ball, inp = { mx: 0, my: 0, held: {}, down: {}, up: {} };
        if (b.ctrl === L) {
          // walks it straight at the nearest man on the other side until he takes it
          let near = null, nd = 1e9;
          for (const o of m.teams[1].players) { const d = Math.hypot(o.x - L.x, o.y - L.y); if (!o.off && !o.gk && d < nd) { nd = d; near = o; } }
          if (near) { const dx = near.x - L.x, dy = near.y - L.y, d = Math.hypot(dx, dy) || 1; inp.mx = dx / d; inp.my = dy / d; }
        } else {
          if (b.ctrl && b.ctrl.team === 0) { const dx = b.x - L.x, dy = b.y + 6 - L.y, d = Math.hypot(dx, dy) || 1; if (d > 6) { inp.mx = dx / d; inp.my = dy / d; } if (st.n % 90 === 0) inp.down.Q = true; }
          // a loose ball near him he goes for (the man on the ball he leaves alone)
          else if (!b.ctrl && !b.held && Math.hypot(b.x - L.x, b.y - L.y) < 15) { const dx = b.x - L.x, dy = b.y - L.y, d = Math.hypot(dx, dy) || 1; inp.mx = dx / d; inp.my = dy / d; }
        }
        return inp;
      }
    };
    const run = (setup, seed, bot) => {
      const sim = createSim3D(setup, { rng: seeded(seed) });
      const m = sim.m, L = m.lock, st = { n: 0 };
      const mates = m.teams[0].players.filter(p => p !== L), start = mates.map(p => ({ x: p.x, y: p.y })), moved = mates.map(() => 0);
      let notHim = 0;
      while (m.phase !== "full" && st.n++ < 60 * 700) {
        sim.step(bot(m, L, st));
        if (m.ctrl && m.ctrl !== L) notHim++;
        mates.forEach((p, i) => { moved[i] += Math.hypot(p.x - start[i].x, p.y - start[i].y); start[i] = { x: p.x, y: p.y }; });
        m.events.length = 0;
      }
      return { m, L, notHim, moved, line: sim.lockLine(), res: sim.result() };
    };
    for (const kind of ["youth", "pro"]) {
      const good = run(setups[kind]("home"), kind === "youth" ? 4101 : 4201, bots.good);
      const bad = run(setups[kind]("away"), kind === "youth" ? 4102 : 4202, bots.bad);
      const L = good.L;
      ok("player lock (" + kind + "): his marked row is the locked player, with his look and number", L && L.pc && L.name.endsWith(" Me") && L.prof.skinF === 0.62 && L.prof.watch === "gold" && L.num === 9 && good.m.lock === L, L && [L.name, L.num]);
      ok("player lock (" + kind + "): only he is ever under control, in a whole match (home and away)", good.m.phase === "full" && bad.m.phase === "full" && good.notHim === 0 && bad.notHim === 0, [good.notHim, bad.notHim]);
      ok("player lock (" + kind + "): his team mates play on their own (every one of them covers ground)", good.moved.every(d => d > 60) && bad.moved.every(d => d > 60), good.moved.map(Math.round));
      ok("player lock (" + kind + "): the good game counts goals, shots and good passes", good.line.shots >= 3 && good.line.g >= 1 && good.line.passOk >= 1, good.line);
      ok("player lock (" + kind + "): the bad game counts the ball given away", bad.line.lost >= 3 && bad.line.shots === 0, bad.line);
      ok("player lock (" + kind + "): the rating follows how he played (good game above bad game)", good.line.rating > bad.line.rating + 0.8, [good.line.rating, bad.line.rating]);
    }
    // the tackle bug, played out: a player who only chases the man on the ball flat out and runs into him (then runs
    // at goal and shoots) used to win every challenge and school games 6-0 to 10-0. Now he wins few of them and the
    // scores look like football.
    const chaser = (m, L, st) => {
      const b = m.ball, inp = { mx: 0, my: 0, sprint: true, held: {}, down: {}, up: {} }, gx = m.teams[0].dir * C.HALF_L;
      if (b.ctrl === L) {
        const dx = gx - L.x, dy = -L.y, d = Math.hypot(dx, dy);
        inp.mx = dx / d; inp.my = dy / d;
        if (d < 22) { if ((st.eH || 0) < 0.45) { inp.held.E = true; st.eH = (st.eH || 0) + 1 / 60; } else { inp.up.E = st.eH; st.eH = 0; } }
      } else if (b.ctrl && b.ctrl.team === 0) { const dx = b.x + m.teams[0].dir * 6 - L.x, dy = -b.y * 0.3 - L.y, d = Math.hypot(dx, dy) || 1; if (d > 2) { inp.mx = dx / d; inp.my = dy / d; } }
      else { const t = b.ctrl || b.held || b, dx = t.x - L.x, dy = t.y - L.y, d = Math.hypot(dx, dy) || 1; inp.mx = dx / d; inp.my = dy / d; }
      return inp;
    };
    const chased = [];
    for (const [kind, side, seed] of [["youth", "home", 4301], ["youth", "away", 4302], ["pro", "home", 4303], ["pro", "away", 4304]]) {
      const sim = createSim3D(setups[kind](side), { rng: seeded(seed) });
      const m = sim.m, L = m.lock, st = { n: 0 };
      let won = 0, tries = 0;
      while (m.phase !== "full" && st.n++ < 60 * 700) {
        sim.step(chaser(m, L, st));
        for (const e of m.events) if (e.type === "challenge" && e.by === L.id) { tries++; if (e.out === "won") won++; }
        m.events.length = 0;
      }
      chased.push({ kind, side, score: m.score[0] + "-" + m.score[1], margin: m.score[0] - m.score[1], won, tries, done: m.phase === "full" });
    }
    const tries = chased.reduce((n, c) => n + c.tries, 0), wins = chased.reduce((n, c) => n + c.won, 0);
    ok("the chaser: every match finishes", chased.every(c => c.done), chased);
    ok("the chaser: running into the man on the ball wins it clean less than a third of the time (it used to be every time)", tries >= 20 && wins < tries * 0.3, [wins, tries]);
    ok("the chaser: no blowouts, the scores look like football (no win by 6 or more, the average margin under 3.5)", chased.every(c => c.margin < 6) && chased.reduce((n, c) => n + c.margin, 0) / chased.length < 3.5, chased.map(c => c.score));
    // the rating, piece by piece: goals and good passes lift it, lost balls and wild passes drop it
    const rateOf = S => lockM.lockRating({ lock: { pos: "FW", role: "ST" }, lockStats: Object.assign({ touches: 0, passes: 0, passOk: 0, shots: 0, onTarget: 0, goals: 0, assists: 0, tackles: 0, won: 0, skills: 0, lost: 0 }, S), score: [0, 0], clock: 90 });
    const base = rateOf({});
    ok("player lock: goals lift the rating", rateOf({ goals: 2, shots: 3, onTarget: 2 }) > base + 1.5, [base, rateOf({ goals: 2, shots: 3, onTarget: 2 })]);
    ok("player lock: good passes lift it, lost balls and wild passes drop it", rateOf({ passes: 20, passOk: 19 }) > base && rateOf({ lost: 10, passes: 12, passOk: 3 }) < base - 0.8, [rateOf({ passes: 20, passOk: 19 }), rateOf({ lost: 10, passes: 12, passOk: 3 })]);
  }

  // ================= both ends play the same =================
  {
    // the same seed twice, the second with both teams turned round and every player rotated half a turn about
    // the centre spot: if no code favours one end, the second match is the first one rotated, step for step
    const { startRestart } = await import("../floodlights/m3d/rules.mjs");
    const same = () => createSim3D(setupOf(80, 80), { rng: seeded(8), auto: true });
    const A = same(), B = same(), a = A.m, b = B.m;
    for (const T of b.teams) T.dir *= -1;
    a.players.forEach((P, i) => {
      const Q = b.players[i];
      Q.x = -P.x; Q.y = -P.y; Q.face = P.face + Math.PI;
      for (const f of [0, 1]) { Q.gait.feet[f].x = -P.gait.feet[f].x; Q.gait.feet[f].y = -P.gait.feet[f].y; }
    });
    startRestart(a, "kickoff", a.firstKick, 0, 0); startRestart(b, "kickoff", b.firstKick, 0, 0);
    let worst = 0;
    for (let s = 0; s < 300; s++) {
      A.step({ mx: 0, my: 0 }); B.step({ mx: 0, my: 0 });
      worst = Math.max(worst, Math.hypot(a.ball.x + b.ball.x, a.ball.y + b.ball.y));
      a.players.forEach((P, i) => { worst = Math.max(worst, Math.hypot(P.x + b.players[i].x, P.y + b.players[i].y)); });
    }
    ok("the engine plays the same toward either goal (a mirrored kick off stays a mirror image for 5 seconds)", worst < 0.001, worst);
  }

  // ================= headless match battery =================
  {
    const N = Number(process.env.M3D_MATCHES || 8);
    let goals = 0, problems = [], repairs = 0, stuck = 0, fouls = 0, setPieces = { throwin: 0, corner: 0, freekick: 0, goalkick: 0, penalty: 0, kickoff: 0 }, shots = 0, passes = 0, skillsN = 0, saves = 0, cards = 0, offsides = 0;
    const scores = [];
    let stepMs = 0, steps = 0;
    for (let k = 0; k < N; k++) {
      const a = 70 + (k * 7) % 20, c = 70 + (k * 11) % 20;
      const sim = createSim3D(setupOf(a, c, k % 2 ? "away" : "home"), { rng: seeded(1000 + k), auto: true });
      const m = sim.m;
      let lastMove = 0, lastBall = { x: 0, y: 0 }, n = 0, restartT = 0;
      const t0 = Date.now();
      while (m.phase !== "full" && n < 60 * 600) {
        sim.step({ mx: 0, my: 0 });
        n++;
        for (const e of m.events.splice(0)) {
          if (e.type in setPieces) setPieces[e.type]++;
          if (e.type === "foul") fouls++;
          if (e.type === "card") cards++;
          if (e.type === "offside") offsides++;
        }
        // stuck: the ball does not move for 25 seconds of play
        const b = m.ball;
        if (Math.hypot(b.x - lastBall.x, b.y - lastBall.y) > 0.5 || m.phase !== "play") { lastMove = m.t; lastBall = { x: b.x, y: b.y }; }
        if (m.t - lastMove > 25) { stuck++; lastMove = m.t; }
        // a restart that never gets taken is stuck too
        if (m.phase === "restart") { restartT += 1 / 60; if (restartT > 20) { stuck++; restartT = 0; } } else restartT = 0;
        for (const p of m.players) if (!isFinite(p.x + p.y + p.vx + p.vy + p.face)) { problems.push("NaN player in match " + k); break; }
        if (!isFinite(b.x + b.y + b.z)) problems.push("NaN ball in match " + k);
      }
      stepMs += Date.now() - t0; steps += n;
      if (m.phase !== "full") problems.push("match " + k + " did not finish");
      const r = sim.result();
      if (!(Number.isInteger(r.home) && Number.isInteger(r.away) && r.home <= 12 && r.away <= 12)) problems.push("bad result " + JSON.stringify(r));
      goals += m.score[0] + m.score[1];
      scores.push(r.home + "-" + r.away);
      repairs += m.repairs || 0;
      shots += m.stats.shots[0] + m.stats.shots[1]; passes += m.stats.passes[0] + m.stats.passes[1]; skillsN += m.stats.skills[0] + m.stats.skills[1]; saves += m.stats.saves[0] + m.stats.saves[1];
    }
    console.log("headless matches: " + N + ", scores " + scores.join(" ") + ", goals a match " + (goals / N).toFixed(2) + ", shots " + (shots / N).toFixed(1) + ", passes " + (passes / N).toFixed(0) + ", skills " + (skillsN / N).toFixed(1) + ", saves " + (saves / N).toFixed(1) + ", fouls " + (fouls / N).toFixed(1) + ", cards " + cards + ", offsides " + offsides + ", set pieces " + JSON.stringify(setPieces) + ", " + (stepMs / steps).toFixed(3) + " ms a step");
    ok("every headless match finishes with a valid result and nothing goes NaN", problems.length === 0, problems.slice(0, 4));
    ok("the engine never needed to repair a broken state", repairs === 0, repairs);
    ok("no stuck states: the ball never sits still for 25 seconds of play and no restart hangs for 20", stuck === 0, stuck);
    ok("goals come at a sensible rate: 0.8 to 6 a match on average", goals / N >= 0.8 && goals / N <= 6, goals / N);
    ok("shots, passes and skill moves all happen", shots / N >= 3 && passes / N >= 40 && skillsN / N >= 1, [shots / N, passes / N, skillsN / N]);
    ok("fouls happen and set pieces trigger: throw ins, corners, free kicks, goal kicks, kick offs", fouls > 0 && setPieces.throwin > 0 && setPieces.corner > 0 && setPieces.freekick > 0 && setPieces.goalkick > 0 && setPieces.kickoff >= N, setPieces);
    ok("keepers make saves", saves > 0, saves);
    ok("the engine is fast: under 0.6 ms a step on average", stepMs / steps < 0.6, (stepMs / steps).toFixed(3));
  }

  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
