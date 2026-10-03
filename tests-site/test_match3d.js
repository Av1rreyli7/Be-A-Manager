// Checks for the 3D playable match. Run: node tests-site/test_match3d.js
// The game loop and the whole 3D scene run for real (real three.js scene graph, real deep sim).
// Only the WebGL renderer is stubbed, so this needs no browser and no GPU.
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
const view3dText = fs.readFileSync(fl("match3d.mjs"), "utf8");
const simText = fs.readFileSync(fl("match_sim3d.mjs"), "utf8");
const serverText = fs.readFileSync(fl("server.js"), "utf8");
const FL = require(fl("match.js"));

function testXI(base, tag) {
  const rows = [["GK", "GK"], ["DF", "LB"], ["DF", "CB"], ["DF", "CB"], ["DF", "RB"], ["MF", "CDM"], ["MF", "CM"], ["MF", "CAM"], ["FW", "LW"], ["FW", "ST"], ["FW", "RW"]];
  return rows.map((r, i) => ({ n: tag + " Player" + i, pos: r[0], role: r[1], r: base + (i % 3) - 1 }));
}
// a seeded random so the scenario checks below are the same every run
function seeded(s) { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return (x + 0.5) / 4294967296; }; }
const setupOf = (a, c, side) => ({ home: "Home FC", away: "Away FC", side: side || "home", homeXI: testXI(a, "H"), awayXI: testXI(c, "A") });

async function main() {
  // ---------- static checks ----------
  for (const [name, txt] of [["match3d.mjs", view3dText], ["match_sim3d.mjs", simText]]) ok(name + " has no em or en dashes", !txt.includes(EM) && !txt.includes(EN), null);
  ok("the 3D view never imports three by itself, it is handed in", !/^\s*import\s/m.test(view3dText), null);
  ok("the deep sim imports nothing and touches no DOM", !/^\s*import\s/m.test(simText) && !simText.includes("document.") && !simText.includes("window."), null);
  ok("the page wires the 3D loader with the view and the deep sim", html.includes("FLMatch.load3D") && html.includes('import("./match3d.mjs")') && html.includes('import("./match_sim3d.mjs")') && html.includes('import("./vendor/three.module.js")') && html.includes("view.createSim = mods[2].createSim3D"), null);
  ok("the page has styles for the 3D canvas and the 3D HUD", html.includes("#matchCanvas3d") && html.includes("#matchWrap.m3d") && html.includes("#m3dHud .m3-score") && html.includes("#m3dHud .m3-ticker") && html.includes("#m3dHud .m3-card"), null);
  ok("the server serves the deep sim next to the view", serverText.includes('app.get("/floodlights/match_sim3d.mjs"') && serverText.includes('app.get("/floodlights/match3d.mjs"'), null);
  ok("the engine exposes what the 3D view needs", FL.DIMS && FL.DIMS.HALF_L === 52.5 && FL.DIMS.HALF_W === 34 && typeof FL.pickKits === "function" && "load3D" in FL, Object.keys(FL));
  ok("the rules did not change: 6 minutes, 60 steps a second, 12 goal cap", FL.MATCH_SECONDS === 360 && Math.abs(FL.STEP - 1 / 60) < 1e-9 && FL.MAX_GOALS === 12, null);
  for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "Escape", "KeyT", "KeyX", "KeyF", "Space"]) ok("the controls listen for " + key, engine.includes('"' + key + '"'), null);
  ok("the controls pass the new actions to the sim", engine.includes("through: A.throughQ") && engine.includes("slide: A.slideQ") && engine.includes("skill: A.skillQ") && engine.includes("tackle: !!k.Space"), null);
  for (const w of ["<kbd>T</kbd> Through ball", "<kbd>X</kbd> Slide tackle", "<kbd>F</kbd> Skill move", "<kbd>Space</kbd> Hold when defending", "Esc</kbd> Pause"]) ok("the help screen teaches: " + w.slice(0, 24), engine.includes(w), null);
  ok("the Classic sim in match.js is the deep sim's starting point but was not edited", engine.indexOf("function createSim") > 0 && !engine.slice(engine.indexOf("function createSim"), engine.indexOf("// LOOK")).includes("startSkill"), null);

  // ---------- the deep sim: attributes ----------
  const S = await import("../floodlights/match_sim3d.mjs");
  const { createSim3D, deriveAttrs, assignNumbers, skillChance, slideChance, tackleChance, topSpeedFor, LINES } = S;
  ok("the deep sim keeps the same rules as Classic", S.MATCH_SECONDS === 360 && Math.abs(S.STEP - 1 / 60) < 1e-9 && S.MAX_GOALS === 12 && S.DIMS.HALF_L === 52.5, null);
  const a90 = deriveAttrs({ n: "Star Winger", pos: "FW", role: "RW", r: 90 }), a60 = deriveAttrs({ n: "Star Winger", pos: "FW", role: "RW", r: 60 });
  ok("a 90 rated player beats a 60 rated one of the same role in every attribute", ["pac", "dri", "sho", "pas", "def", "phy"].every(k => a90[k] > a60[k] + 20), [a90, a60]);
  ok("attributes stay in range and are deterministic", Object.values(a90).every(v => v >= 30 && v <= 99) && JSON.stringify(deriveAttrs({ n: "Star Winger", pos: "FW", role: "RW", r: 90 })) === JSON.stringify(a90), a90);
  const st = deriveAttrs({ n: "Nine", pos: "FW", role: "ST", r: 80 }), cb = deriveAttrs({ n: "Nine", pos: "DF", role: "CB", r: 80 }), rw = deriveAttrs({ n: "Nine", pos: "FW", role: "RW", r: 80 });
  ok("roles shape the attributes: a striker shoots, a centre back defends, a winger runs", st.sho > cb.sho + 15 && cb.def > st.def + 15 && rw.pac > cb.pac + 8 && rw.dri > cb.dri + 10, [st, cb, rw]);
  const nums = assignNumbers(testXI(80, "N").map(r => Object.assign({}, r)));
  ok("shirt numbers are unique inside the eleven and the keeper wears 1", new Set(nums.map(p => p.num)).size === 11 && nums[0].num === 1 && nums.every(p => p.num >= 1 && p.num <= 99), nums.map(p => p.num));
  ok("pace sets top speed and a 30 point gap is a clear gap", topSpeedFor(90) > topSpeedFor(60) * 1.2, [topSpeedFor(60), topSpeedFor(90)]);
  ok("skill move chances follow dribbling against defending", skillChance(90, 60, "stepover") > 0.5 && skillChance(60, 85, "stepover") < 0.15 && skillChance(80, 80, "nutmeg") < skillChance(80, 80, "feint"), [skillChance(90, 60, "stepover"), skillChance(60, 85, "stepover")]);
  ok("slide tackles reward timing and defending", slideChance(80, 70, true) > slideChance(80, 70, false) + 0.3 && slideChance(90, 60, true) > 0.85 && slideChance(55, 90, false) < 0.12, [slideChance(90, 60, true), slideChance(55, 90, false)]);
  ok("a committed standing tackle beats a brush of the shoulder", tackleChance(80, 70, true) > tackleChance(80, 70, false) + 0.2 && tackleChance(60, 90, false) < 0.1, null);

  const strong = createSim3D(setupOf(90, 60), { rng: seeded(1) }), weak = strong.m.teams[1];
  ok("the deep sim marks itself and gives every player attributes and a number", strong.deep && strong.m.deep && strong.m.players.every(p => p.a && p.num && p.sp > 0 && p.acc > 0 && p.turn > 0), null);
  ok("every player on the 90 team is faster, sharper turning and longer lasting than his opposite number", strong.m.teams[0].players.every((p, i) => p.sp > weak.players[i].sp && p.turn > weak.players[i].turn && p.drain < weak.players[i].drain && p.carry < weak.players[i].carry), null);
  ok("the better keeper reacts sooner, dives faster and catches harder shots", strong.m.teams[0].gk.reactTime < weak.gk.reactTime - 0.1 && strong.m.teams[0].gk.dive > weak.gk.dive && strong.m.teams[0].gk.catchLimit > weak.gk.catchLimit + 5, null);

  // a fast player covers ground quicker than a slow one, same keys, same time
  function sprintTest(rating) {
    const sim = createSim3D(setupOf(rating, 70), { rng: seeded(7) });
    const m = sim.m, c = m.ctrl;
    m.phase = "play";
    for (const p of m.players) if (p !== c) { p.x = 40 * (p.team === 0 ? -1 : 1); p.y = -30; p.tx = p.x; p.ty = p.y; }
    c.x = -45; c.y = 28; c.vx = 0; c.vy = 0; c.face = 0; c.stamina = 1;
    m.ball.owner = c; m.ball.x = c.x + c.carry; m.ball.y = c.y; m.ball.vx = 0; m.ball.vy = 0;
    const x0 = c.x;
    for (let i = 0; i < 120; i++) sim.step({ mx: 1, my: 0, sprint: true });
    return { dist: c.x - x0, still: m.ctrl === c, has: m.ball.owner === c };
  }
  const fast = sprintTest(92), slow = sprintTest(58);
  ok("two seconds of sprinting: the 92 rated player covers far more ground than the 58", fast.dist > slow.dist * 1.18 && fast.still && slow.still, [fast, slow]);
  ok("both kept the ball at their feet while running", fast.has && slow.has, [fast.has, slow.has]);

  // stamina drains and comes back by physical
  {
    const sim = createSim3D(setupOf(90, 60), { rng: seeded(3) });
    const fit = sim.m.teams[0].players[6], unfit = sim.m.teams[1].players[6];
    fit.stamina = 1; unfit.stamina = 1;
    ok("stamina drain and recovery follow the physical attribute", fit.drain < unfit.drain && fit.regen > unfit.regen, [fit.drain, unfit.drain]);
  }

  // ---------- scenario helpers ----------
  function clearPitch(m, keep) {
    for (const p of m.players) {
      if (keep.includes(p)) continue;
      p.x = p.team === 0 ? -48 : 48; p.y = p.gk ? 0 : -32 + (p.id % 11) * 3; p.vx = 0; p.vy = 0; p.tx = p.x; p.ty = p.y; p.think = 9;
      p.stun = 0; p.slide = null; p.down = 0; p.move = null;
    }
    m.phase = "play"; m.phaseT = 0; m.switchCd = 9; m.hands = 0; m.assist = false;
    m.ball.protect = 0; m.ball.passTo = null; m.ball.through = false; m.ball.shot = null; m.ball.vx = 0; m.ball.vy = 0; m.ball.z = 0; m.ball.vz = 0;
  }
  function give(m, p) { m.ball.owner = p; m.ball.x = p.x + Math.cos(p.face) * p.carry; m.ball.y = p.y + Math.sin(p.face) * p.carry; m.ball.lastTeam = p.team; m.ball.lastPlayer = p; }
  const events = sim => sim.m.events.splice(0);

  // ---------- slide tackles ----------
  function slideTrials(defR, attR, dist, n) {
    const sim = createSim3D(setupOf(defR, attR), { rng: seeded(11 + dist * 10) });
    const m = sim.m;
    const c = m.teams[0].players[2]; // a centre back
    const o = m.teams[1].players[8]; // their winger
    let won = 0, lost = 0, downAfterLoss = 0, goodT = 0, busyDuring = 0;
    for (let i = 0; i < n; i++) {
      clearPitch(m, [c, o]);
      m.ctrl = c;
      o.x = 0; o.y = 0; o.vx = 0; o.vy = 0; o.face = 0; o.drib = 0; o.think = 5; o.stun = 0; o.tackleCd = 0; o.burst = 0; o.move = null;
      c.x = -dist; c.y = 0; c.vx = 0; c.vy = 0; c.face = 0; c.slide = null; c.slideCd = 0; c.down = 0; c.stun = 0; c.tackleCd = 0;
      give(m, o);
      ok("slide number " + i + " starts", sim.startSlide(c) === true && !!c.slide, null);
      if (c.slide.good) goodT++;
      let res = null;
      for (let s = 0; s < 45 && !res; s++) {
        sim.step({});
        if (c.slide && m.ctrl === c) { /* the player on the slide cannot be steered: the sim keeps him on his line */ busyDuring++; }
        for (const ev of events(sim)) if (ev.type === "tackle" && ev.kind === "slide") res = ev;
      }
      if (!res) continue;
      if (res.ok) won++; else { lost++; if (c.down > 0 || c.slide) downAfterLoss++; }
    }
    return { won, lost, goodT, downAfterLoss, busyDuring, contact: won + lost };
  }
  const closeGood = slideTrials(92, 58, 1.1, 24);
  ok("a slide from close range reads as good timing", closeGood.goodT === 24, closeGood);
  ok("a 92 rated defender sliding on a 58 rated winger with good timing wins the ball nearly every time", closeGood.contact >= 18 && closeGood.won >= closeGood.contact * 0.8, closeGood);
  const farBad = slideTrials(56, 92, 1.5, 24);
  ok("a slide from far out reads as a late lunge", farBad.goodT === 0, farBad);
  ok("a 56 rated defender lunging late at a 92 rated winger is mostly beaten and left on the ground", farBad.contact >= 10 && farBad.lost >= farBad.contact * 0.6 && farBad.downAfterLoss === farBad.lost, farBad);
  ok("a sliding player cannot be steered while he is down", closeGood.busyDuring > 24, closeGood.busyDuring);

  // ---------- standing tackle and pressure (Space) ----------
  function standTrials(defR, attR, hold, n) {
    const sim = createSim3D(setupOf(defR, attR), { rng: seeded(21) });
    const m = sim.m, c = m.teams[0].players[2], o = m.teams[1].players[8];
    let won = 0, tried = 0;
    for (let i = 0; i < n; i++) {
      clearPitch(m, [c, o]);
      m.ctrl = c;
      o.x = 0; o.y = 0; o.vx = 0; o.vy = 0; o.face = 0; o.drib = 0; o.think = 5; o.stun = 0; o.tackleCd = 0; o.burst = 0;
      c.x = 0.3; c.y = 1.2; c.vx = 0; c.vy = 0; c.face = 0; c.stun = 0; c.tackleCd = 0; c.slide = null; c.down = 0;
      give(m, o);
      for (let s = 0; s < 40; s++) {
        sim.step({ tackle: hold });
        for (const ev of events(sim)) if (ev.type === "tackle" && ev.kind === "stand" && ev.team === 0) { tried++; if (ev.ok) won++; }
        if (m.ball.owner === c) break;
      }
      if (m.ball.owner === c) won++;
    }
    return { won, tried };
  }
  const pressWin = standTrials(92, 58, true, 20), brush = standTrials(92, 58, false, 20);
  ok("holding Space and closing a weak dribbler down wins the ball most of the time", pressWin.won >= 12, pressWin);
  ok("just brushing past without Space wins it far less often", brush.won < pressWin.won * 0.6, [brush, pressWin]);
  {
    const sim = createSim3D(setupOf(80, 80), { rng: seeded(5) });
    const m = sim.m, c = m.teams[0].players[5], o = m.teams[1].players[7];
    clearPitch(m, [c, o]);
    m.ctrl = c; o.x = 6; o.y = 0; o.face = 0; o.think = 5; c.x = -6; c.y = -6; c.face = 0; give(m, o);
    const d0 = Math.hypot(o.x - c.x, o.y - c.y);
    for (let s = 0; s < 30; s++) sim.step({ tackle: true });
    ok("Space with no direction pressed runs my player at the ball carrier", m.pressing && Math.hypot(o.x - c.x, o.y - c.y) < d0 - 2, [d0, Math.hypot(o.x - c.x, o.y - c.y)]);
  }

  // ---------- through balls ----------
  {
    const sim = createSim3D(setupOf(88, 70), { rng: seeded(31) });
    const m = sim.m, c = m.teams[0].players[6], mate = m.teams[0].players[9];
    clearPitch(m, [c, mate]);
    m.ctrl = c;
    c.x = 0; c.y = 0; c.face = 0; give(m, c);
    mate.x = 9; mate.y = 6; mate.vx = 6; mate.vy = 0; mate.tx = 40; mate.ty = 6; mate.think = 9;
    sim.step({ through: true });
    const b = m.ball;
    ok("T plays a through ball to the running team mate", b.owner === null && b.passTo === mate && b.through === true && m.stats.throughs[0] === 1, [b.passTo && b.passTo.label, b.through]);
    const aimAhead = b.vx > 8 && Math.atan2(b.vy, b.vx) < Math.atan2(mate.y - c.y, mate.x - c.x);
    ok("the ball goes into the space ahead of him, not to his feet", aimAhead, [b.vx, b.vy]);
    let got = null, said = [];
    for (let s = 0; s < 240 && !got; s++) {
      sim.step({});
      for (const ev of events(sim)) { if (ev.type === "through") got = ev; if (ev.type === "say") said.push(ev.text); }
    }
    ok("the runner collects it and the commentary calls the through ball", !!got && got.team === 0 && said.some(t => LINES.through.some(l => t === l.replace("{n}", c.label))), [got, said]);
    ok("the person playing is handed the runner", m.ctrl === mate, m.ctrl && m.ctrl.label);
  }

  // ---------- skill moves ----------
  function skillTrials(attR, defR, where, n) {
    const sim = createSim3D(setupOf(attR, defR), { rng: seeded(41 + attR) });
    const m = sim.m, c = m.teams[0].players[8], q = m.teams[1].players[2];
    let okN = 0, failN = 0, types = {}, stumbled = 0, loose = 0, lines = [];
    events(sim);
    for (let i = 0; i < n; i++) {
      clearPitch(m, [c, q]);
      m.ctrl = c;
      c.x = 0; c.y = 0; c.face = 0; c.skillCd = 0; c.stun = 0; c.move = null; c.burst = 0;
      q.x = where[0]; q.y = where[1]; q.vx = 0; q.vy = 0; q.stun = 0; q.slide = null; q.down = 0; q.think = 5; q.tackleCd = 2;
      give(m, c);
      sim.step({ skill: true });
      const mv = c.move;
      if (!mv) continue;
      types[mv.type] = (types[mv.type] || 0) + 1;
      for (const ev of events(sim)) { if (ev.type === "skill") { if (ev.ok) okN++; else failN++; } if (ev.type === "say") lines.push(ev.text); }
      if (mv.ok && q.stun > 0 && q.stumble > 0) stumbled++;
      if (!mv.ok && m.ball.owner !== c && c.stun > 0) loose++;
    }
    return { okN, failN, types, stumbled, loose, lines };
  }
  const star = skillTrials(95, 55, [1.5, 0], 30);
  ok("a 95 rated dribbler facing a 55 rated defender beats him most of the time", star.okN >= 20 && star.okN + star.failN === 30, star);
  ok("head on and close means a roulette or a nutmeg", Object.keys(star.types).every(t => t === "roulette" || t === "nutmeg"), star.types);
  ok("a beaten defender is left stumbling behind", star.stumbled === star.okN, [star.stumbled, star.okN]);
  ok("skill move lines come from the skill pools with personality", star.lines.length === 30 && star.lines.every(t => LINES.skill.concat(LINES.nutmeg, LINES.skillfail).some(l => l.replace("{n}", "Player8") === t)) && star.lines.some(t => /Dropped him|done him|shops|Twisted his blood|NUTMEG/.test(t)), star.lines.slice(0, 5));
  const dud = skillTrials(45, 92, [1.5, 0], 30);
  ok("a 45 rated player trying it on a 92 rated defender fails most of the time", dud.failN >= 22, dud);
  ok("a failed move gives the ball away and leaves the dribbler off balance", dud.loose === dud.failN, [dud.loose, dud.failN]);
  const sideT = skillTrials(85, 70, [0.5, 2.2], 10), backT = skillTrials(85, 70, [-2.5, 0.3], 10), midT = skillTrials(85, 70, [3.2, 0], 10);
  ok("a defender at the side gets a body feint", Object.keys(sideT.types).join() === "feint", sideT.types);
  ok("a defender behind gets a drag back", Object.keys(backT.types).join() === "dragback", backT.types);
  ok("a defender a few metres in front gets a stepover", Object.keys(midT.types).join() === "stepover", midT.types);
  {
    const sim = createSim3D(setupOf(85, 70), { rng: seeded(99) });
    const m = sim.m, c = m.teams[0].players[8];
    clearPitch(m, [c]); m.ctrl = c; c.x = 0; c.y = 0; c.face = 0; give(m, c);
    sim.step({ skill: true });
    ok("a skill move with nobody near is a harmless showboat", c.move && c.move.show === true && m.ball.owner === c && events(sim).every(ev => ev.type !== "skill"), c.move);
  }

  // ---------- commentary pools ----------
  const poolSizes = Object.fromEntries(Object.entries(LINES).map(([k, v]) => [k, v.length]));
  ok("every event has a pool of lines, the fun ones have plenty", Object.values(LINES).every(v => v.length >= 2) && LINES.skill.length >= 8 && LINES.sitter.length >= 5 && LINES.slidewin.length >= 5 && LINES.goal.length >= 6, poolSizes);
  ok("the lines ask for are there: Dropped him, Oh he has done him, sent him to the shops, Twisted his blood, and a nutmeg", ["Dropped him!", "Oh he has done him!", "He has sent him to the shops!", "Twisted his blood!"].every(l => LINES.skill.includes(l)) && LINES.nutmeg.length >= 3, null);
  ok("no commentary line has an em or en dash", Object.values(LINES).every(v => v.every(l => !l.includes(EM) && !l.includes(EN))), null);

  // ---------- AI uses the toolkit by rating ----------
  function autoMatch(a, c, seed) {
    const sim = createSim3D(setupOf(a, c, seed % 2 ? "away" : "home"), { auto: true, rng: seeded(seed) });
    let steps = 0, prob = "", sayN = 0, consecutiveRepeat = false, last = "";
    while (!sim.m.done && steps < 60 * 60 * 12) {
      sim.step(null); steps++;
      for (const ev of events(sim)) if (ev.type === "say") { sayN++; if (ev.text === last) consecutiveRepeat = true; last = ev.text; }
      if (steps % 30 === 0 && !prob) {
        const m = sim.m, b = m.ball;
        if (!Number.isFinite(b.x + b.y + b.z + b.vx + b.vy + b.vz) || Math.abs(b.x) > 58 || Math.abs(b.y) > 38) prob = "ball";
        for (const p of m.players) if (!Number.isFinite(p.x + p.y + p.vx + p.vy) || Math.abs(p.x) > 55 || Math.abs(p.y) > 36.5 || p.stamina < 0 || p.stamina > 1) prob = "player " + p.label;
      }
    }
    return { sim, steps, prob, sayN, consecutiveRepeat };
  }
  let strongG = 0, weakG = 0, skillsStrong = 0, skillsWeak = 0, okStrong = 0, okWeak = 0, throughsS = 0, throughsW = 0, probs = "", secs = [];
  for (let i = 0; i < 6; i++) {
    const r = autoMatch(88, 68, 100 + i);
    const st = r.sim.m.stats;
    const strongIdx = r.sim.m.teams[0].name === "Home FC" ? 0 : 1;
    strongG += r.sim.m.score[strongIdx]; weakG += r.sim.m.score[1 - strongIdx];
    skillsStrong += st.skills[strongIdx]; skillsWeak += st.skills[1 - strongIdx]; okStrong += st.skillsOk[strongIdx]; okWeak += st.skillsOk[1 - strongIdx];
    throughsS += st.throughs[strongIdx]; throughsW += st.throughs[1 - strongIdx];
    if (r.prob || !r.sim.m.done) probs = r.prob || "did not finish";
    if (r.consecutiveRepeat) probs = "a commentary line repeated back to back";
    secs.push(r.steps / 60);
  }
  ok("six AI v AI deep sim matches finish clean", probs === "", probs);
  ok("the deep sim match still takes about 6 minutes", secs.every(s => s >= 360 && s <= 480), secs);
  ok("the 88 rated AI team outscores the 68 rated one", strongG > weakG, [strongG, weakG]);
  ok("the better AI team attempts and lands more skill moves", skillsStrong >= skillsWeak && okStrong > okWeak, [skillsStrong, okStrong, skillsWeak, okWeak]);
  ok("the better AI team plays more through balls", throughsS > throughsW, [throughsS, throughsW]);
  ok("the AI uses skill moves and through balls at all", skillsStrong + skillsWeak >= 6 && throughsS + throughsW >= 20, [skillsStrong + skillsWeak, throughsS + throughsW]);

  // ---------- the 3D view driven by a real deep match, renderer stubbed ----------
  const THREE = await import("three");
  const { createView3D } = await import("../floodlights/match3d.mjs");
  const renders = [];
  const stubRenderer = { setSize() {}, render(scene, camera) { renders.push([scene, camera]); }, dispose() { this.gone = true; }, setPixelRatio() {}, shadowMap: {} };
  const view = createView3D(THREE, { FL, renderer: stubRenderer, width: 1280, height: 720, document: null });
  ok("the view builds a scene and a camera", view.scene && view.scene.isScene && view.camera && view.camera.isPerspectiveCamera, null);
  ok("goals with reacting nets are in the scene", view.nets.length === 2 && view.nets.every(n => n.mesh && n.mesh.isLineSegments && n.base.length > 100), view.nets.length);
  ok("the stadium bowl has a crowd but stays light", view.stats().seats > 1200 && view.stats().seats < 2500, view.stats().seats);
  ok("the view owns its HUD in 3D", view.ownHud === true, null);
  let shadowLights = 0; view.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) shadowLights++; });
  ok("one shadow casting key light, like Hardwood Legends", shadowLights === 1, shadowLights);

  const sim = createSim3D({ home: "Arsenal", away: "Wolves", side: "home", homeXI: testXI(84, "H"), awayXI: testXI(78, "A") }, { rng: seeded(777) });
  const finite = v => Number.isFinite(v.x + v.y + v.z);
  let steps = 0, problem = "", sawGoalEvent = false, maxCamJump = 0, lastCamX = null, hold = 0, bulged = false, zoomed = false, fovBack = false, nanJoint = false, slidPose = false, ringOk = true;
  let baseFov = null;
  while (!sim.m.done && steps < 60 * 60 * 12) {
    const m = sim.m, c = m.ctrl, b = m.ball, has = c && b.owner === c;
    // a scripted keyboard player using the whole toolkit: run at goal, sprint, pass, through ball, skill move, press, slide, shoot
    const inp = { mx: 0, my: 0, sprint: true, shoot: false, pass: false, through: false, slide: false, tackle: false, skill: false };
    if (c) {
      const tx = has ? 52.5 : b.x, ty = has ? 0 : b.y;
      inp.mx = Math.sign(Math.round((tx - c.x) / 2));
      inp.my = Math.sign(Math.round((ty - c.y) / 2));
      if (has && 52.5 - c.x < 22 && Math.abs(c.y) < 16) { hold++; inp.shoot = hold < 36; if (hold >= 36) hold = 0; }
      else { hold = 0; inp.pass = steps % 300 === 0; inp.through = steps % 300 === 150; inp.skill = steps % 90 === 0; }
      if (!has) { inp.tackle = true; inp.slide = steps % 120 === 0; }
    }
    sim.step(inp);
    steps++;
    for (const ev of sim.m.events.splice(0)) { view.onEvent(ev, sim); if (ev.type === "goal") sawGoalEvent = true; }
    view.draw(sim, 1 / 60);
    if (baseFov === null) baseFov = view.camera.fov;
    if (sawGoalEvent && view.nets.some(n => n.bulge > 0.5)) bulged = true;
    if (view.camera.fov < baseFov - 2) zoomed = true;
    if (zoomed && Math.abs(view.camera.fov - baseFov) < 0.05) fovBack = true;
    if (steps % 20 === 0 && !problem) {
      if (view.figures.size !== 22) problem = "not 22 figures: " + view.figures.size;
      for (const p of m.players) {
        const f = view.figures.get(p.id);
        if (!f) { problem = "player without a figure"; break; }
        if (Math.abs(f.g.position.x - p.x) > 1e-6 || Math.abs(f.g.position.z - p.y) > 1e-6 || f.g.position.y !== 0) { problem = "figure is not where the sim says"; break; }
        if (p.slide && f.body.position.y < -0.3) slidPose = true;
        f.g.traverse(o => { if (o.rotation && !Number.isFinite(o.rotation.x + o.rotation.y + o.rotation.z + o.position.y)) nanJoint = true; });
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
      if (m.ctrl && view.ring.visible && (Math.abs(view.ring.position.x - m.ctrl.x) > 1e-6 || Math.abs(view.ring.position.z - m.ctrl.y) > 1e-6)) ringOk = false;
      if (m.passHint && view.passRing.visible && Math.abs(view.passRing.position.x - m.passHint.x) > 1e-6) problem = "pass ring is not under the pass target";
    }
    if (lastCamX !== null) maxCamJump = Math.max(maxCamJump, Math.abs(view.camera.position.x - lastCamX));
    lastCamX = view.camera.position.x;
  }
  ok("a full keyboard driven match plays through the 3D view to full time", sim.m.done && sim.m.phase === "full", steps);
  ok("the 3D view stays in step with the sim all match", problem === "", problem);
  ok("the control ring stays under my player", ringOk, null);
  ok("no joint ever goes to not a number", !nanJoint, null);
  ok("a sliding player is drawn down on the ground", slidPose, sim.m.stats.slides);
  ok("one frame is drawn per step", renders.length === steps, [renders.length, steps]);
  ok("the camera follows smoothly, no jumps", maxCamJump < 6, maxCamJump);
  ok("the match still takes about 6 minutes", steps / 60 >= 360 && steps / 60 <= 480, steps / 60);
  ok("there was a goal to look at", sawGoalEvent, sim.m.score);
  ok("the net bulges on a goal", bulged, view.nets.map(n => n.bulge));
  ok("the camera pulls in on a goal and settles back", zoomed && fovBack, [baseFov, view.camera.fov]);
  ok("the score is still the sim's score", Number.isInteger(sim.result().home) && Number.isInteger(sim.result().away), sim.result());
  const mine = view.figures.get(sim.m.teams[0].players.find(p => !p.gk).id);
  ok("my team is in its real shirt colour and every figure knows its number", mine.kit[0] === FL.pickKits("Arsenal", "Wolves")[0][0] && [...view.figures.values()].every(f => f.num >= 1), mine.kit);
  ok("numbers are unique inside each team", [0, 1].every(t => new Set(sim.m.teams[t].players.map(p => view.figures.get(p.id).num)).size === 11), null);
  let bodies = 0; view.scene.traverse(o => { if (o.isMesh && o.castShadow) bodies++; });
  ok("players cast shadows", bodies > 22 * 8, bodies);
  const tris = (() => { let n = 0; view.scene.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; n += (g.index ? g.index.count : g.getAttribute("position").count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n); })();
  ok("the whole scene stays light on geometry (crowd is two instanced draws)", tris < 75000, tris);
  const seatsFull = view.crowd.count;
  view.setQuality(0);
  ok("the quality guard can drop shadows and halve the crowd", view.quality() === 0 && view.crowd.count < seatsFull, [view.quality(), view.crowd.count, seatsFull]);
  view.dispose();
  ok("dispose empties the figures and leaves a borrowed renderer alone", view.figures.size === 0 && !stubRenderer.gone, null);

  // a second match with other clubs rebuilds the figures in the new colours, with the Classic sim too
  const view2 = createView3D(THREE, { FL, renderer: stubRenderer, width: 800, height: 900, document: null });
  const auto = FL.createSim({ home: "Chelsea", away: "Liverpool", side: "away", homeXI: testXI(80, "H"), awayXI: testXI(80, "A") }, { auto: true });
  const fx = { shake: 0, net: [0, 0] };
  for (let i = 0; i < 600; i++) { auto.step(null); auto.m.events.length = 0; view2.draw(auto, 1 / 60, fx); }
  ok("an away match draws too, with me as team 0, even on the Classic sim", view2.figures.size === 22 && auto.m.teams[0].name === "Liverpool", null);
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
  ok("the start screen teaches the new controls in simple words", ["Through ball", "Skill move", "Slide tackle", "standing tackle", "Esc"].every(w => B.panel.textContent.includes(w)), null);
  ok("without the 3D loader the 3D choice is off and Classic is picked", B.doc.getElementById("mxLook3d").disabled && B.doc.getElementById("mxLookClassic").classList.contains("on") && B.panel.textContent.includes("plays in Classic"), null);
  B.doc.getElementById("mxGo").click();
  await settle();
  B.pump(200);
  ok("Classic runs with no 3D view", B.M.isOpen() && !B.M.look3d() && !B.wrap.classList.contains("m3d") && B.panel.classList.contains("hidden"), null);
  ok("Classic paints the pitch itself", B.calls.includes("fillRect") && !B.calls.includes("clearRect"), null);
  B.M.close();

  // 2) 3D available: it is the default, the view is built at kick off with the deep sim, drawn every frame, owning the HUD
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  const made = [];
  const deepCalls = [], stepInputs = [];
  const fakeView = () => {
    const v = { draws: 0, events: [], disposed: 0, ownHud: true, draw(sim, dt, fxx) { v.draws++; v.lastDt = dt; v.lastFx = fxx; }, onEvent(ev) { v.events.push(ev.type); }, project: (x, y) => ({ x: 640 + x * 8, y: 360 + y * 8, visible: true }), dispose() { v.disposed++; } };
    v.createSim = (s, o) => { deepCalls.push(s); const real = createSim3D(s, o); const step = real.step; real.step = inp => { if (inp && (inp.through || inp.slide || inp.skill || inp.tackle)) stepInputs.push(inp); return step(inp); }; v.sim = real; return real; };
    made.push(v);
    return v;
  };
  B.M.load3D = async () => opts => { made.opts = opts; return fakeView(); };
  B.M.open(cfgFor(c));
  ok("with 3D available it is offered and picked by default", !B.doc.getElementById("mxLook3d").disabled && B.doc.getElementById("mxLook3d").classList.contains("on") && !B.doc.getElementById("mxLookClassic").classList.contains("on"), null);
  ok("the look note says 3D is the full game and Classic is the simple one", B.panel.textContent.includes("3D is the full game") && B.panel.textContent.includes("Classic is the simple top down match"), null);
  const callsBefore = B.calls.length;
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(120);
  ok("kick off in 3D builds the 3D view once", made.length === 1 && B.M.look3d() && B.wrap.classList.contains("m3d"), made.length);
  ok("kick off in 3D runs the deep sim that came with the view", deepCalls.length === 1 && made[0].sim && made[0].sim.deep === true && made[0].sim.m.players.every(p => p.a && p.num), deepCalls.length);
  ok("the 3D view gets the wrap, the HUD canvas and the engine", made.opts && made.opts.wrap === B.wrap && made.opts.canvas === B.doc.getElementById("matchCanvas") && made.opts.FL === B.M, null);
  ok("the 3D view is drawn every frame", made[0].draws >= 100, made[0].draws);
  ok("when the 3D view owns the HUD the Classic canvas is left alone", B.calls.length === callsBefore, B.calls.length - callsBefore);
  for (const code of ["KeyT", "KeyX", "KeyF", "Space"]) { B.win.dispatchEvent(new B.win.KeyboardEvent("keydown", { code })); B.pump(2); B.win.dispatchEvent(new B.win.KeyboardEvent("keyup", { code })); }
  ok("T, X, F and Space reach the deep sim as through, slide, skill and tackle", stepInputs.some(i => i.through) && stepInputs.some(i => i.slide) && stepInputs.some(i => i.skill) && stepInputs.some(i => i.tackle), stepInputs.length);
  ok("the one shot keys fire once per press, not every frame", stepInputs.filter(i => i.through).length === 1 && stepInputs.filter(i => i.skill).length === 1, stepInputs.filter(i => i.through).length);
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

  // 3) a full match in 3D on the deep sim sends its score exactly once
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  made.length = 0;
  B.M.load3D = async () => () => fakeView();
  B.M.open(cfgFor(c));
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(60 * 60 * 12, () => c.finish.length > 0);
  await settle();
  ok("a finished 3D match sends its score exactly once", c.finish.length === 1 && Number.isInteger(c.finish[0][0]) && Number.isInteger(c.finish[0][1]), c.finish);
  ok("the score sent is the deep sim's score", made[0].sim.m.done && c.finish[0][0] === made[0].sim.result().home && c.finish[0][1] === made[0].sim.result().away, [c.finish, made[0].sim.result()]);
  ok("the full time screen shows after a 3D match", B.panel.textContent.includes("Full time") && B.panel.textContent.includes("Saved for the test."), B.panel.textContent.slice(0, 80));
  ok("the 3D view heard the match events", made[0].events.includes("full") && made[0].events.includes("half"), made[0].events.slice(0, 6));
  B.doc.getElementById("mxDone").click();

  // 4) picking Classic on the start screen wins over 3D, and Classic runs the Classic sim
  B = boot(); c = { finish: [], closed: 0, simVal: null };
  made.length = 0;
  B.M.load3D = async () => () => fakeView();
  B.M.open(cfgFor(c));
  B.doc.getElementById("mxLookClassic").click();
  ok("clicking Classic moves the pick", B.doc.getElementById("mxLookClassic").classList.contains("on") && !B.doc.getElementById("mxLook3d").classList.contains("on"), null);
  B.doc.getElementById("mxGo").click();
  await settle(); await settle();
  B.pump(60);
  ok("Classic picked means no 3D view and no deep sim", made.length === 0 && !B.M.look3d() && B.M.isOpen() && deepCalls.length === 2, [made.length, deepCalls.length]);
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

  // 6) the real view inside the fake browser builds its DOM HUD and tears it down
  {
    const dom = new JSDOM('<!DOCTYPE html><body><div id="matchWrap"><canvas id="matchCanvas"></canvas><div id="matchPanel" class="hidden"></div></div></body>');
    const win = dom.window, doc = win.document;
    const sink = new Proxy(function () {}, { get: (t, k) => (k === "measureText" ? () => ({ width: 50 }) : k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
    win.HTMLCanvasElement.prototype.getContext = () => sink;
    const wrap = doc.getElementById("matchWrap"), canvas = doc.getElementById("matchCanvas");
    const v = createView3D(THREE, { FL, renderer: stubRenderer, wrap, canvas, document: doc, width: 1280, height: 720 });
    const s = createSim3D(setupOf(84, 78), { rng: seeded(5) });
    for (let i = 0; i < 200; i++) { s.step({ mx: 1 }); for (const ev of s.m.events.splice(0)) v.onEvent(ev); v.draw(s, 1 / 60); }
    const hudEl = doc.getElementById("m3dHud");
    ok("the real view builds the DOM HUD inside the match wrap", !!hudEl && hudEl.parentNode === wrap && v.stats().hud, null);
    ok("the scorebug shows both teams, the score and the clock", hudEl.querySelector(".m3-score").textContent.includes("HOME FC") && hudEl.querySelector(".m3-score").textContent.includes("AWAY FC") && hudEl.querySelector(".m3-num").textContent.trim() === "0  0" && /\d+'/.test(hudEl.querySelector(".m3-min").textContent), hudEl.querySelector(".m3-score").textContent);
    ok("the player card names my player with his number and rating", hudEl.querySelector(".m3-cname").textContent === s.m.ctrl.label && hudEl.querySelector(".m3-cnum").textContent === String(s.m.ctrl.num) && hudEl.querySelector(".m3-cmeta").textContent.includes(s.m.ctrl.rating + " OVR"), hudEl.querySelector(".m3-card").textContent);
    ok("the ticker carries the latest commentary line", hudEl.querySelector(".m3-ticker div").textContent.length > 5 && LINES.kickoff.includes(hudEl.querySelector(".m3-ticker div").textContent), hudEl.querySelector(".m3-ticker div").textContent);
    ok("the shirt textures draw the number on the back and the chest", view3dText.includes("strokeText(num, 192, 76)") && view3dText.includes("strokeText(num, 46, 44)"), null);
    ok("the figures carry skin, hair and boot variety", view3dText.includes("SKIN = [") && view3dText.includes("HAIR = [") && view3dText.includes("hairKind") && view3dText.includes("bootMats"), null);
    v.dispose();
    ok("dispose removes the DOM HUD", !doc.getElementById("m3dHud"), null);
  }

  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("CRASH", e && e.stack ? e.stack.split("\n").slice(0, 6).join(" | ") : e); process.exit(1); });
