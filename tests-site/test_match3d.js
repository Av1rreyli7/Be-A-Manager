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
  ok("the page has styles for the 3D canvas and the view carries the styles of its broadcast HUD", html.includes("#matchCanvas3d") && html.includes("#matchWrap.m3d") && view3dText.includes("#m3dHud .m3-bug") && view3dText.includes("#m3dHud .m3-feed") && view3dText.includes("#m3dHud .m3-card") && view3dText.includes("prefers-reduced-motion"), null);
  ok("the server serves the deep sim next to the view", serverText.includes('app.get("/floodlights/match_sim3d.mjs"') && serverText.includes('app.get("/floodlights/match3d.mjs"'), null);
  ok("the engine exposes what the 3D view needs", FL.DIMS && FL.DIMS.HALF_L === 52.5 && FL.DIMS.HALF_W === 34 && typeof FL.pickKits === "function" && "load3D" in FL, Object.keys(FL));
  ok("the rules did not change: 6 minutes, 60 steps a second, 12 goal cap", FL.MATCH_SECONDS === 360 && Math.abs(FL.STEP - 1 / 60) < 1e-9 && FL.MAX_GOALS === 12, null);
  for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "Escape", "KeyT", "KeyX", "KeyF", "Space"]) ok("the controls listen for " + key, engine.includes('"' + key + '"'), null);
  ok("the controls pass the new actions to the sim", engine.includes("through: A.throughQ") && engine.includes("slide: A.slideQ") && engine.includes("skill: A.skillQ") && engine.includes("tackle: !!k.Space"), null);
  for (const w of ["<kbd>T</kbd> Through ball", "<kbd>X</kbd> Slide tackle", "<kbd>F</kbd> Skill move", "<kbd>Space</kbd> Hold when defending", "Esc</kbd> Pause"]) ok("the help screen teaches: " + w.slice(0, 24), engine.includes(w), null);
  // the controls strip replaces the old hint lines in both looks
  ok("the 3D view has no old help overlay left", !view3dText.includes("m3-help") && !view3dText.includes("YOU ATTACK TO THE RIGHT") && !view3dText.includes("WASD move"), null);
  ok("the Classic canvas no longer paints the long key hint line", !engine.includes("SHIFT SPRINT  ·  Q PASS") && !engine.includes("const t2 ="), null);
  ok("the controls strip lists exactly the keys asked for, in order", engine.includes('const STRIP_KEYS = [["WASD", "Move"], ["E", "Shoot"], ["Q", "Pass"], ["T", "Through"], ["X", "Slide"], ["Space", "Tackle"], ["F", "Skill"], ["Shift", "Sprint"]];'), null);
  ok("the strip uses the site kit look (kit tokens, Chakra Petch labels, Geist Mono keys) and fades to about a third", engine.includes("var(--k-f-lbl") && engine.includes("var(--k-f-num") && engine.includes("var(--k-accent") && engine.includes(".mx-keys.dim{opacity:.3}"), null);
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
  // the model gives about 61 percent here (18 of 30), so "most of the time" is more than half
  ok("a 95 rated dribbler facing a 55 rated defender beats him most of the time", star.okN >= 16 && star.okN + star.failN === 30, star);
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

  // ---------- set pieces and the game in the air (kick off, goal kicks, corners, free kicks, penalties, crosses, headers) ----------
  const { headingFor, heightFor, aerialScore, foulChance, penaltyGuess } = S;
  for (const w of ["<kbd>C</kbd> Cross", "<kbd>E</kbd> heads at goal", "Kick off: just run with it", "Corners: W A S D aim", "Free kicks: W or S aim, A or D bend", "Penalties: W or S picks the side", "In goal, hold W or S to dive"]) ok("the help screen teaches: " + w.replace(/<[^>]+>/g, "").slice(0, 30), engine.includes(w), null);
  ok("the controls listen for C and pass the cross on to the sim", engine.includes('"KeyC"') && engine.includes("cross: A.crossQ") && engine.includes('if (e.code === "KeyC") A.crossQ = true;'), null);
  {
    const cbRow = { n: "Big Centre", pos: "DF", role: "CB", r: 80 }, lwRow = { n: "Big Centre", pos: "FW", role: "LW", r: 80 };
    ok("heading favours centre backs and strikers over wingers", headingFor(cbRow, deriveAttrs(cbRow)) > headingFor(lwRow, deriveAttrs(lwRow)) + 10, [headingFor(cbRow, deriveAttrs(cbRow)), headingFor(lwRow, deriveAttrs(lwRow))]);
    ok("heights are sane and a centre back is taller than a winger", heightFor(cbRow) >= 1.68 && heightFor(cbRow) <= 1.98 && heightFor(cbRow) > heightFor(lwRow), [heightFor(cbRow), heightFor(lwRow)]);
    ok("the duel score rises with heading, height and strength", aerialScore(85, 1.9, 80) > aerialScore(70, 1.9, 80) && aerialScore(80, 1.92, 80) > aerialScore(80, 1.75, 80) && aerialScore(80, 1.85, 85) > aerialScore(80, 1.85, 60), null);
    ok("a slide from behind is far more likely a foul, and poor defenders foul more", foulChance("slide", 70, true) > foulChance("slide", 70, false) + 0.25 && foulChance("slide", 55, false) > foulChance("slide", 85, false) && foulChance("stand", 60, true) > foulChance("stand", 60, false), [foulChance("slide", 70, true), foulChance("slide", 70, false)]);
    ok("a good keeper reads a poor penalty taker more often, within limits", penaltyGuess(90, 60) > penaltyGuess(60, 90) && penaltyGuess(99, 30) <= 0.48 && penaltyGuess(30, 99) >= 0.2, [penaltyGuess(90, 60), penaltyGuess(60, 90)]);
  }

  // kick off: my player stands on the centre spot and can just run with it, no pass first
  {
    const sim = createSim3D(setupOf(80, 80), { rng: seeded(5) });
    const m = sim.m, k = m.ctrl;
    ok("at kick off my player is on the centre spot with the ball at his feet", m.phase === "kickoff" && m.ball.owner === k && Math.abs(k.x) < 1 && Math.abs(k.y) < 0.01 && Math.abs(m.ball.x) < 1 && m.setPiece && m.setPiece.kind === "kickoff" && sim.setPiece === m.setPiece, [k.x, m.ball.x, m.setPiece]);
    let steps = 0, startedAt = -1;
    while (steps < 60 * 3) {
      sim.step({ mx: 1, my: 0, sprint: steps > 80 });
      steps++;
      if (startedAt < 0 && m.phase === "play") startedAt = steps;
    }
    ok("pressing a key starts play straight away, I do not wait out the whistle", startedAt > 0 && startedAt < 2.2 * 60 - 10, startedAt);
    ok("I dribbled away from kick off with nobody else touching it", m.ball.owner === k && k.x > 8 && m.stats.throughs[0] === 0, [k.x, m.ball.owner && m.ball.owner.label]);
    ok("the kick off marker clears once play is on", m.setPiece === null, m.setPiece);
    // passing first still works
    const sim2 = createSim3D(setupOf(80, 80), { rng: seeded(6) });
    let st2 = 0;
    while (sim2.m.phase !== "play" && st2 < 400) { sim2.step({}); st2++; }
    sim2.step({ pass: true });
    ok("passing first from kick off is still fine", sim2.m.ball.owner === null && sim2.m.ball.passTo && sim2.m.ball.passTo.team === 0, null);
    // the AI sometimes runs with it too
    let ran = 0, passed = 0;
    for (let i = 0; i < 24; i++) {
      const s3 = createSim3D(setupOf(84, 84, "away"), { rng: seeded(300 + i) });
      const kk = s3.m.ball.owner, x0 = kk.x;
      for (let j = 0; j < 60 * 3.4; j++) s3.step(null);
      if (s3.m.ball.owner === kk && Math.abs(kk.x - x0) > 3) ran++; else passed++;
    }
    ok("an AI kicker sometimes dribbles from kick off and sometimes passes", ran >= 2 && passed >= 2, [ran, passed]);
  }

  // goal kicks: the other side must be out of the box first, even a player who will not move gets waved out
  {
    let clean = 0, fast = 0;
    for (let i = 0; i < 12; i++) {
      const sim = createSim3D(setupOf(80, 80), { auto: true, rng: seeded(60 + i) });
      const m = sim.m;
      for (let j = 0; j < 120; j++) sim.step(null);
      // three attackers parked inside the box the keeper kicks from (team 1 defends the right hand goal)
      const parked = m.teams[0].players.filter(p => p.line === "FW");
      parked.forEach((p, n) => { p.x = 44 + n; p.y = -4 + n * 4; p.tx = p.x; p.ty = p.y; });
      if (i % 3 === 0) parked[0].stun = 99; // one of them simply will not move
      sim.restart("goalkick", 1, 52.5 - 5.5, 5);
      let st = 0, inBoxAtKick = -1;
      while (st < 60 * 10) {
        sim.step(null); st++;
        if (m.phase === "play") { inBoxAtKick = m.teams[0].players.filter(p => Math.abs(p.x - 52.5) < 16.5 && Math.abs(p.y) < 20.16).length; break; }
      }
      if (inBoxAtKick === 0) clean++;
      if (st < 60 * 6.5) fast++;
    }
    ok("every goal kick is taken with the other side out of the box", clean === 12, clean);
    ok("goal kicks never stall: a dawdler is waved out after a few seconds", fast === 12, fast);
  }

  // corners: off a defender over his own line is a corner from the arc
  {
    const sim = createSim3D(setupOf(80, 80), { auto: true, rng: seeded(71) });
    const m = sim.m;
    for (let j = 0; j < 120; j++) sim.step(null);
    const d = m.teams[1].players[2];
    clearPitch(m, []);
    m.ball.owner = null; m.ball.x = 51.5; m.ball.y = 12; m.ball.vx = 14; m.ball.vy = 2; m.ball.z = 0.5; m.ball.vz = 0; m.ball.lastTeam = 1; m.ball.lastPlayer = d;
    events(sim);
    for (let j = 0; j < 10 && m.phase === "play"; j++) sim.step(null);
    ok("a ball out over the line off a defender gives a corner from the arc", m.phase === "restart" && m.restart.type === "corner" && m.restart.team === 0 && Math.abs(m.restart.x) > 51.5 && Math.abs(m.restart.y) > 33 && m.setPiece.kind === "corner", m.restart && m.restart.type);
    const ev = events(sim);
    ok("the corner is announced", ev.some(e => e.type === "corner") && ev.some(e => e.type === "say" && LINES.corner.includes(e.text)), ev.map(e => e.type));
  }
  // AI corners: runners at the near and far post, a cross, a fight in the air
  {
    let crosses = 0, attWon = 0, defWon = 0, runnersOk = 0, markersOk = 0, shots = 0, claim = 0, phases = new Set();
    for (let i = 0; i < 40; i++) {
      const sim = createSim3D(setupOf(82, 80), { auto: true, rng: seeded(900 + i) });
      const m = sim.m;
      for (let j = 0; j < 150; j++) sim.step(null);
      events(sim);
      // a corner comes from an attack, so the attacking side is already up the pitch
      for (const p of m.players) if (!p.gk) { p.x = Math.min(46, Math.max(-50, p.x + 28)); p.tx = p.x; }
      sim.restart("corner", 0, 52.5 - 0.6, i % 2 ? 33.4 : -33.4);
      let st = 0, counted = false, done = false;
      while (st < 60 * 9 && !done) {
        sim.step(null); st++;
        if (m.setPiece) phases.add(m.setPiece.phase);
        if (m.phase === "setpiece" && !counted) {
          counted = true;
          if (m.teams[0].players.filter(p => p.x > 52.5 - 17 && Math.abs(p.y) < 14).length >= 3) runnersOk++;
          if (m.teams[1].players.filter(p => !p.gk && p.x > 52.5 - 17 && Math.abs(p.y) < 14).length >= 4) markersOk++;
        }
        for (const e of events(sim)) {
          if (e.type === "cross") crosses++;
          if (e.type === "header" && e.cross) { if (e.team === 0) { attWon++; if (e.kind === "shot") shots++; } else defWon++; done = true; }
        }
        if (m.ball.owner && m.ball.owner.gk && m.ball.owner.team === 1 && !done) { claim++; done = true; }
        if (m.ball.owner && !done && st > 60) done = true;
      }
    }
    ok("AI corners are crossed in nearly every time (a few go short)", crosses >= 30, crosses);
    ok("attackers crowd the box for a corner, defenders mark them", runnersOk >= 34 && markersOk >= 34, [runnersOk, markersOk]);
    ok("corners go through setup, aim and taken", phases.has("setup") && phases.has("aim") && phases.has("taken"), [...phases]);
    ok("both sides win headers from corners, attackers head at goal", attWon >= 6 && defWon >= 6 && shots >= 4, [attWon, defWon, shots, claim]);
  }

  // fouls: a slide from behind that misses the ball is a foul, in the box it is a penalty
  {
    let fk = 0, pen = 0, fouls = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const sim = createSim3D(setupOf(60, 80), { rng: seeded(400 + i) });
      const m = sim.m;
      const c = m.teams[0].players[2], o = m.teams[1].players[9];
      clearPitch(m, [c, o]);
      const inBox = i % 2 === 0;
      // their striker runs at my goal (on the left), my defender slides in from behind
      o.x = inBox ? -42 : -20; o.y = 2; o.face = Math.PI; o.drib = Math.PI; o.vx = -6; o.vy = 0; o.think = 9; o.burst = 0.5;
      c.x = o.x + 1.1; c.y = 2; c.face = Math.PI; c.vx = -6; c.slideCd = 0; c.tackleCd = 0;
      m.ctrl = c; give(m, o);
      events(sim);
      sim.startSlide(c);
      for (let j = 0; j < 50 && m.phase === "play"; j++) sim.step({});
      n++;
      const ev = events(sim);
      if (ev.some(e => e.type === "foul")) {
        fouls++;
        if (m.restart && m.restart.type === "penalty") pen++;
        if (m.restart && m.restart.type === "freekick") fk++;
      }
    }
    ok("a missed slide from behind is often a foul", fouls >= 15, [fouls, n]);
    ok("a foul in the box is a penalty, outside it a free kick", pen >= 5 && fk >= 5 && pen + fk === fouls, [pen, fk, fouls]);
  }

  // penalties: the AI scores most, the keeper saves some, set up with only the taker and keeper in the box
  {
    let goals = 0, saves = 0, other = 0, boxOk = 0;
    for (let i = 0; i < 80; i++) {
      const sim = createSim3D(setupOf(80, 80), { auto: true, rng: seeded(1300 + i) });
      const m = sim.m;
      for (let j = 0; j < 120; j++) sim.step(null);
      events(sim);
      sim.restart("penalty", 0, 52.5 - 11, 0);
      let st = 0, out = "", kicked = false;
      while (st < 60 * 12 && !out) {
        const before = m.phase;
        sim.step(null); st++;
        if (before === "setpiece" && m.phase === "play") {
          kicked = true;
          // only the taker (and the keeper) inside the box at the kick
          const inside = m.players.filter(p => p !== m.teams[1].gk && Math.abs(p.x - 52.5) < 16.5 && Math.abs(p.y) < 20.16);
          if (inside.length <= 1) boxOk++;
        }
        for (const e of events(sim)) if (!out && (e.type === "goal" || e.type === "save" || e.type === "post" || e.type === "miss")) out = e.type;
        if (!out && kicked && m.phase === "restart") out = "out";
      }
      if (out === "goal") goals++; else if (out === "save") saves++; else other++;
    }
    ok("only the taker and the keeper are in the box when a penalty is taken", boxOk >= 76, boxOk);
    ok("penalties: most go in, the keeper saves some, a few miss", goals >= 44 && goals <= 70 && saves >= 6, [goals, saves, other]);
  }

  // free kicks: a wall at 9.15 m, some hit it, some go in, the ball bends
  {
    let wallOk = 0, wallHits = 0, goals = 0, curled = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const sim = createSim3D(setupOf(84, 78), { auto: true, rng: seeded(1700 + i) });
      const m = sim.m;
      for (let j = 0; j < 120; j++) sim.step(null);
      events(sim);
      sim.restart("freekick", 0, 52.5 - 20, i % 2 ? 6 : -4, { direct: true });
      const W = m.restart.wall;
      let st = 0, out = "", vy0 = null, sawAim = false;
      while (st < 60 * 10 && !out) {
        const before = m.phase;
        sim.step(null); st++;
        if (m.phase === "setpiece") sawAim = true;
        if (before === "setpiece" && m.phase === "play") {
          n++;
          const wallMen = m.teams[1].players.filter(p => !p.gk && Math.abs(hyp(p.x - W.x0, p.y - W.y0) - 9.15) < 0.8);
          if (wallMen.length >= W.n) wallOk++;
          vy0 = m.ball.vy;
          if (m.ball.spin) {
            for (let j = 0; j < 20; j++) sim.step(null);
            if (Math.abs(m.ball.vy - vy0) > 0.4 || m.ball.z === 0) curled++;
          }
        }
        for (const e of events(sim)) if (!out && (e.type === "goal" || e.type === "wall" || e.type === "save" || e.type === "post")) out = e.type;
      }
      if (out === "wall") wallHits++;
      if (out === "goal") goals++;
    }
    function hyp(a, c) { return Math.hypot(a, c); }
    ok("the wall stands 9.15 m out before a direct free kick is taken", wallOk >= n - 2 && n >= 45, [wallOk, n]);
    ok("free kicks from 20 m: some hit the wall, some go in", wallHits >= 3 && goals >= 3, [wallHits, goals]);
    ok("a struck free kick bends in the air", curled >= n * 0.6, [curled, n]);
  }

  // the person taking set pieces: aim with W A S D, hold E for power and let go
  {
    const sim = createSim3D(setupOf(82, 78), { rng: seeded(2100) });
    const m = sim.m;
    for (let j = 0; j < 150; j++) sim.step({});
    sim.restart("corner", 0, 52.5 - 0.6, 33.4);
    let st = 0;
    while (m.phase !== "setpiece" && st < 600) { sim.step({}); st++; }
    ok("my corner waits for me with an aim marker", m.phase === "setpiece" && m.aim && m.aim.kind === "corner" && sim.aim === m.aim && m.setPiece.phase === "aim", m.aim);
    const a0 = { x: m.aim.x, y: m.aim.y };
    for (let j = 0; j < 30; j++) sim.step({ mx: -1, my: 1 });
    ok("W A S D move the corner target", m.aim.x < a0.x - 3 && m.aim.y > a0.y + 3, [a0, m.aim]);
    const target = { x: m.aim.x, y: m.aim.y };
    for (let j = 0; j < 37; j++) sim.step({ shoot: true });
    ok("holding E charges the corner", m.aim.power > 0.6 && m.aim.power < 0.75, m.aim.power);
    sim.step({});
    ok("letting go whips the cross in toward the target", m.phase === "play" && m.ball.cross && m.ball.cross.team === 0 && hyp(m.ball.cross.x - target.x, m.ball.cross.y - target.y) < 6 && m.aim === null, [m.ball.cross, target]);
    function hyp(a, c) { return Math.hypot(a, c); }
    // C crosses at once, Q plays it short
    const simC = createSim3D(setupOf(82, 78), { rng: seeded(2101) });
    for (let j = 0; j < 150; j++) simC.step({});
    simC.restart("corner", 0, 52.5 - 0.6, -33.4);
    st = 0; while (simC.m.phase !== "setpiece" && st < 600) { simC.step({}); st++; }
    simC.step({ cross: true });
    ok("C sends my corner straight in", simC.m.phase === "play" && !!simC.m.ball.cross, null);
    const simQ = createSim3D(setupOf(82, 78), { rng: seeded(2102) });
    for (let j = 0; j < 150; j++) simQ.step({});
    simQ.restart("corner", 0, 52.5 - 0.6, -33.4);
    st = 0; while (simQ.m.phase !== "setpiece" && st < 600) { simQ.step({}); st++; }
    simQ.step({ pass: true });
    ok("Q plays my corner short to a team mate", simQ.m.phase === "play" && !simQ.m.ball.cross && simQ.m.ball.passTo && simQ.m.ball.passTo.team === 0, null);
    // my penalty: W or S picks the side
    const simP = createSim3D(setupOf(82, 78), { rng: seeded(2103) });
    for (let j = 0; j < 150; j++) simP.step({});
    simP.restart("penalty", 0, 52.5 - 11, 0);
    st = 0; while (simP.m.phase !== "setpiece" && st < 600) { simP.step({}); st++; }
    for (let j = 0; j < 30; j++) simP.step({ my: -1 });
    const aimY = simP.m.aim.y;
    for (let j = 0; j < 40; j++) simP.step({ shoot: true });
    simP.step({});
    ok("my penalty goes to the side I picked", aimY < -2 && simP.m.ball.shot && simP.m.ball.shot.pen && simP.m.ball.vy < 0, [aimY, simP.m.ball.vy]);
    // in goal for their penalty: W or S dives
    const simK = createSim3D(setupOf(82, 78), { rng: seeded(2104) });
    for (let j = 0; j < 150; j++) simK.step({});
    simK.restart("penalty", 1, -52.5 + 11, 0);
    st = 0; while (simK.m.phase !== "play" && st < 900) { simK.step({ my: 1 }); st++; }
    ok("in goal I dive the way I hold", simK.m.teams[0].gk.penDive === 1, simK.m.teams[0].gk.penDive);
    // my free kick bends with A or D
    const simF = createSim3D(setupOf(82, 78), { rng: seeded(2105) });
    for (let j = 0; j < 150; j++) simF.step({});
    simF.restart("freekick", 0, 52.5 - 22, 3, { direct: true });
    st = 0; while (simF.m.phase !== "setpiece" && st < 900) { simF.step({}); st++; }
    for (let j = 0; j < 40; j++) simF.step({ mx: 1 });
    const curve = simF.m.aim.curve;
    for (let j = 0; j < 38; j++) simF.step({ shoot: true });
    simF.step({});
    ok("my free kick takes the bend I set", curve > 0.9 && simF.m.ball.spin > 0.5 && simF.m.ball.dip && simF.m.ball.shot && simF.m.ball.shot.fk, [curve, simF.m.ball.spin]);
  }

  // open play: C crosses from out wide, runners attack the near and far post, E heads it
  {
    let crossOk = 0, switched = 0, myShots = 0, myOther = 0;
    for (let i = 0; i < 10; i++) {
      const sim = createSim3D(setupOf(84, 76), { rng: seeded(2200 + i) });
      const m = sim.m;
      for (let j = 0; j < 150; j++) sim.step({});
      const c = m.teams[0].players[10];
      clearPitch(m, [c]);
      // two of my forwards arriving, two of their centre backs at home
      for (const p of m.teams[0].players) if (p.line === "FW" && p !== c) { p.x = 36; p.y = (p.id % 2 ? 4 : -6); }
      m.teams[1].players.filter(p => p.role === "CB").forEach((p, n) => { p.x = 45; p.y = n ? 3 : -5; });
      c.x = 42; c.y = 26; c.face = 0; m.ctrl = c; give(m, c);
      for (let j = 0; j < 20; j++) sim.step({ mx: 1 });
      sim.step({ cross: true });
      if (m.ball.cross && m.ball.cross.team === 0 && m.ball.cross.x > 52.5 - 18 && Math.abs(m.ball.cross.y) < 14) crossOk++;
      let headed = null, ctrlChanged = false;
      for (let j = 0; j < 180 && !headed; j++) {
        if (m.ctrl !== c) ctrlChanged = true;
        sim.step({ shoot: true });
        for (const e of events(sim)) if (e.type === "header" && !headed) headed = e;
      }
      if (ctrlChanged) switched++;
      if (headed && headed.team === 0) { if (headed.kind === "shot") myShots++; else myOther++; }
    }
    ok("C crosses from out wide toward my runners in the box", crossOk >= 9, crossOk);
    ok("my control jumps to the runner under the cross", switched >= 9, switched);
    ok("holding E under my own cross heads it at goal", myShots >= 3 && myOther === 0, [myShots, myOther]);
  }

  // ---------- headless 3D match loop: full deep sim matches, every rule, measured rates ----------
  {
    const N = 24, tot = {}, kinds = new Set(), how = {};
    let goals = 0, steps = 0, prob = "", maxDead = 0, sawAir = false, getterOk = true, secs = [];
    for (let i = 0; i < N; i++) {
      const a = 68 + (i % 4) * 7, c = 90 - (i % 3) * 9;
      const sim = createSim3D(setupOf(a, c, i % 2 ? "away" : "home"), { auto: true, rng: seeded(5000 + i) });
      const m = sim.m;
      let st = 0, dead = 0;
      while (!m.done && st < 60 * 60 * 12) {
        sim.step(null); st++;
        for (const ev of m.events.splice(0)) if (ev.type === "goal") how[ev.how] = (how[ev.how] || 0) + 1;
        if (m.setPiece) kinds.add(m.setPiece.kind);
        if (sim.setPiece !== m.setPiece) getterOk = false;
        if (m.phase === "restart" || m.phase === "setpiece") { dead++; if (dead > maxDead) maxDead = dead; } else dead = 0;
        if (st % 15 === 0 && !prob) {
          const b = m.ball;
          if (!Number.isFinite(b.x + b.y + b.z + b.vx + b.vy + b.vz + b.spin)) prob = "ball is not a number";
          if (Math.abs(b.x) > 58 || Math.abs(b.y) > 38 || b.z < 0 || b.z > 40) prob = "ball left the world";
          for (const p of m.players) {
            if (!Number.isFinite(p.x + p.y + p.vx + p.vy + p.air)) prob = "player is not a number";
            if (p.air < 0 || p.air > 0.7) prob = "jump height out of range";
            if (p.air > 0) sawAir = true;
          }
        }
      }
      if (!m.done) prob = prob || "a match did not finish";
      steps += st; secs.push(st / 60);
      goals += m.score[0] + m.score[1];
      for (const [k, v] of Object.entries(m.stats)) tot[k] = (tot[k] || 0) + (Array.isArray(v) ? v[0] + v[1] : v);
    }
    const per = k => tot[k] / N;
    const rates = ["corners", "goalkicks", "fouls", "freekicks", "directFks", "penalties", "penGoals", "crosses", "headers", "headerShots", "headerGoals", "claims"].map(k => k + " " + per(k).toFixed(2)).join(", ");
    console.log("headless 3D loop, " + N + " AI matches, per match: goals " + (goals / N).toFixed(2) + ", shots " + per("shots").toFixed(1) + ", " + rates + "; goals by kind " + JSON.stringify(how) + "; longest dead ball " + (maxDead / 60).toFixed(1) + " s");
    ok("headless loop: every match finishes with no not a number anywhere", prob === "", prob);
    ok("headless loop: matches still take about 6 minutes", secs.every(s => s >= 360 && s <= 480), secs.map(s => Math.round(s)));
    ok("headless loop: no stalls, the longest dead ball is under 8 seconds", maxDead < 60 * 8, maxDead / 60);
    ok("headless loop: goals stay realistic", goals / N >= 2 && goals / N <= 8, goals / N);
    ok("headless loop: corners happen at a sensible rate", per("corners") >= 1 && per("corners") <= 6, per("corners"));
    ok("headless loop: goal kicks happen and none is ever taken with an opponent in the box", per("goalkicks") >= 1 && per("goalkicks") <= 7 && tot.gkBoxViolations === 0, [per("goalkicks"), tot.gkBoxViolations]);
    ok("headless loop: fouls are there but the game is not stop start", per("fouls") >= 0.8 && per("fouls") <= 5, per("fouls"));
    ok("headless loop: free kicks and penalties both come up", tot.directFks >= 2 && tot.penalties >= 1 && per("freekicks") <= 5, [tot.directFks, tot.penalties]);
    ok("headless loop: crosses from wide, a fight in the air, headed goals", per("crosses") >= 2 && per("crosses") <= 12 && per("headers") >= 5 && per("headers") <= 30 && tot.headerGoals >= 2, [per("crosses"), per("headers"), tot.headerGoals]);
    ok("headless loop: keepers come and claim some crosses", tot.claims >= 5, tot.claims);
    ok("headless loop: the view sees every set piece kind and players in the air", ["kickoff", "goalkick", "corner", "freekick"].every(k => kinds.has(k)) && sawAir && getterOk, [...kinds]);
  }

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
      else { hold = 0; inp.pass = steps % 300 === 0; inp.through = steps % 300 === 150; inp.skill = steps % 90 === 0; inp.cross = Math.abs(c.y) > 14 && c.x > 25 && steps % 40 === 0; }
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
        // on the ground, or lifted by exactly the sim's jump height when he goes up for a header
        if (Math.abs(f.g.position.x - p.x) > 1e-6 || Math.abs(f.g.position.z - p.y) > 1e-6 || (f.g.position.y !== 0 && Math.abs(f.g.position.y - (p.air || 0)) > 1e-6)) { problem = "figure is not where the sim says"; break; }
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
  let bodies = 0; view.scene.traverse(o => { if (o.isSkinnedMesh && o.castShadow) bodies++; });
  ok("every player casts a shadow (one skinned body each)", bodies === 22, bodies);
  // the players are people: one skinned body each, built from human parts on a human skeleton
  const PARTS = ["head", "face", "ears", "neck", "torso", "print", "shorts", "armR", "armL", "handR", "handL", "legR", "legL", "bootR", "bootL"];
  const BONES = ["body", "pelvis", "spine", "chest", "neck", "head", "shoulderR", "shoulderL", "elbowR", "elbowL", "handR", "handL", "hipR", "hipL", "kneeR", "kneeL", "ankleR", "ankleL"];
  const figs = [...view.figures.values()];
  ok("every player is one skinned body on an 18 bone human skeleton", figs.every(f => f.mesh && f.mesh.isSkinnedMesh && f.mesh.skeleton.bones.length === 18 && BONES.every(n => f.mesh.skeleton.bones.some(b => b.name === n))), null);
  ok("every body has a head, face, ears, neck, torso, shorts, two arms, two hands, two legs, two boots and the print", figs.every(f => PARTS.every(k => f.parts[k] > 0)), figs[0].parts);
  const bb = new THREE.Box3().setFromBufferAttribute(figs[3].mesh.geometry.attributes.position);
  // the head runs from the chin ring to the crown cap (the HEAD profile in match3d.mjs)
  const headH = 1.842 - 1.588;
  ok("human proportions: about 1.83 m tall in the model and about 7.3 heads", bb.max.y > 1.8 && bb.max.y < 1.95 && bb.min.y >= -0.01 && bb.max.y / headH > 6.8 && bb.max.y / headH < 7.8, [bb.max.y, bb.max.y / headH]);
  ok("players stand at a readable size for the TV camera, taller players taller", figs.every(f => f.scale > 1.35 && f.scale < 1.7) && new Set(figs.map(f => f.scale.toFixed(3))).size > 3, figs.map(f => f.scale.toFixed(2)).join(" "));
  const kMats = new Set(figs.map(f => f.mesh.material));
  ok("one shared material per team, not one per player", kMats.size === 2 && [0, 1].every(t => new Set(figs.filter(f => f.team === t).map(f => f.mesh.material)).size === 1) && [...kMats].every(mm => mm.vertexColors), kMats.size);
  const allMats = new Set(); view.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mm => allMats.add(mm)); });
  ok("the whole scene keeps its material count small", allMats.size < 60, allMats.size);
  ok("skin tones and hair styles vary across the players", new Set(figs.map(f => f.skin)).size >= 3 && new Set(figs.map(f => f.hairStyle)).size >= 3, [new Set(figs.map(f => f.skin)).size, [...new Set(figs.map(f => f.hairStyle))]]);
  ok("keepers wear their own kit and gloves", figs.filter(f => f.gk).length === 2 && figs.filter(f => f.gk).every(f => f.kit[0] !== FL.pickKits("Arsenal", "Wolves")[f.team][0]), null);
  ok("each body stays low poly", figs.every(f => f.tris < 2300), Math.max(...figs.map(f => f.tris)));
  const tris = (() => { let n = 0; view.scene.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; n += (g.index ? g.index.count : g.getAttribute("position").count) / 3 * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n); })();
  ok("the whole scene stays light on geometry (crowd is two instanced draws, players about 2k triangles each)", tris < 115000, tris);
  const seatsFull = view.crowd.count;
  view.setQuality(0);
  ok("the quality guard can drop shadows and halve the crowd", view.quality() === 0 && view.crowd.count < seatsFull, [view.quality(), view.crowd.count, seatsFull]);
  view.dispose();
  ok("dispose empties the figures and leaves a borrowed renderer alone", view.figures.size === 0 && !stubRenderer.gone, null);

  // ---------- motion: run cycle, idle, kick, slide, keeper dive, all from the sim fields ----------
  {
    const pv = createView3D(THREE, { FL, renderer: stubRenderer, width: 1280, height: 720, document: null });
    const ps = createSim3D({ home: "Arsenal", away: "Wolves", side: "home", homeXI: testXI(84, "H"), awayXI: testXI(78, "A") }, { rng: seeded(9) });
    const pm = ps.m;
    pm.phase = "play"; pm.auto = true;
    for (const p of pm.players) { p.x = 30; p.y = 25; p.vx = 0; p.vy = 0; p.face = 0; }
    pm.ball.owner = null; pm.ball.x = 45; pm.ball.y = 30; pm.ball.vx = 0; pm.ball.vy = 0;
    pv.draw(ps, 1 / 60);
    const fig = p => pv.figures.get(p.id);
    const bone = (f, n) => f.mesh.skeleton.bones.find(b => b.name === n);
    const jog = pm.teams[0].players[6], spr = pm.teams[0].players[7], still = pm.teams[0].players[5];
    jog.x = -6; jog.y = 0; spr.x = 0; spr.y = 0; still.x = 6; still.y = 0;
    const rec = { jogHip: [9, -9], jogKnee: 0, sprHip: [9, -9], sprKnee: 0, sprArm: [9, -9], stillHip: [9, -9], chest: [9, -9], jogLean: 0, sprLean: 0 };
    for (let i = 0; i < 120; i++) {
      jog.vx = 4.2; spr.vx = 8.4; still.vx = 0;
      pv.draw(ps, 1 / 60);
      if (i < 40) continue;
      const fj = fig(jog), fs = fig(spr), fz = fig(still);
      const hj = bone(fj, "hipR").rotation.z, hs = bone(fs, "hipR").rotation.z, hz = bone(fz, "hipR").rotation.z;
      rec.jogHip = [Math.min(rec.jogHip[0], hj), Math.max(rec.jogHip[1], hj)];
      rec.sprHip = [Math.min(rec.sprHip[0], hs), Math.max(rec.sprHip[1], hs)];
      rec.stillHip = [Math.min(rec.stillHip[0], hz), Math.max(rec.stillHip[1], hz)];
      const as = bone(fs, "shoulderL").rotation.z;
      rec.sprArm = [Math.min(rec.sprArm[0], as), Math.max(rec.sprArm[1], as)];
      rec.jogKnee = Math.max(rec.jogKnee, -bone(fj, "kneeR").rotation.z);
      rec.sprKnee = Math.max(rec.sprKnee, -bone(fs, "kneeR").rotation.z);
      const cs = bone(fz, "chest").scale.x;
      rec.chest = [Math.min(rec.chest[0], cs), Math.max(rec.chest[1], cs)];
      rec.jogLean = fj.body.rotation.z; rec.sprLean = fs.body.rotation.z;
    }
    const span = r => r[1] - r[0];
    ok("the run cycle swings the legs and arms over time", span(rec.jogHip) > 0.8 && span(rec.sprHip) > 1.2 && span(rec.sprArm) > 1.0 && rec.jogKnee > 0.9, rec);
    ok("a sprint looks different from a jog: longer stride, higher heel, more lean", span(rec.sprHip) > span(rec.jogHip) + 0.2 && rec.sprKnee > rec.jogKnee + 0.3 && rec.sprLean < rec.jogLean - 0.1, rec);
    ok("a player standing still breathes but his legs stay put", span(rec.stillHip) < 0.15 && span(rec.chest) > 0.005, rec);
    ok("the stride frequency follows the speed (no skating)", fig(spr).phase !== fig(jog).phase, null);
    // a kick: the kicking leg swings through, the other plants
    const kk = pm.teams[0].players[9];
    kk.x = 12; kk.y = 0; kk.face = 0; kk.vx = 0;
    pm.ball.x = 12.6; pm.ball.y = 0.1; pm.ball.vx = 26; pm.ball.vy = 0; pm.ball.vz = 1;
    let kickMax = 0, kickBack = 0;
    for (let i = 0; i < 24; i++) {
      kk.kickAnim = Math.max(0, 0.35 - i / 60);
      pv.draw(ps, 1 / 60);
      const f = fig(kk), h0 = bone(f, "hipR").rotation.z, h1 = bone(f, "hipL").rotation.z;
      kickMax = Math.max(kickMax, h0, h1); kickBack = Math.min(kickBack, h0, h1);
    }
    ok("a shot swings the kicking leg through the ball and high in the follow through", kickMax > 1.0 && kickBack < -0.05, [kickMax, kickBack]);
    // a slide: down on the grass, leaning back, one leg out
    const sl = pm.teams[0].players[3];
    sl.x = 18; sl.y = 0; sl.face = 0;
    for (let i = 0; i < 20; i++) { sl.slide = { t: i / 60, dur: 0.65 }; pv.draw(ps, 1 / 60); }
    const fsl = fig(sl);
    ok("a slide tackle pose: body down and back, the lead leg out along the grass", fsl.body.position.y < -0.3 && fsl.body.rotation.z > 0.8 && Math.max(bone(fsl, "hipR").rotation.z, bone(fsl, "hipL").rotation.z) > 0.3, [fsl.body.position.y, fsl.body.rotation.z]);
    sl.slide = null;
    // a keeper dive: to the side of the save, in the air, arms up past the head, then a landing
    const gk = pm.teams[1].players[0];
    gk.x = 24; gk.y = 0; gk.face = Math.PI; gk.vx = 0; gk.vy = 0;
    let rollMax = 0, liftMax = 0, armUp = 0;
    for (let i = 0; i < 30; i++) {
      gk.diving = true; gk.tx = gk.x; gk.ty = gk.y + 3; gk.vy = 4;
      pv.draw(ps, 1 / 60);
      const f = fig(gk);
      rollMax = Math.max(rollMax, Math.abs(f.body.rotation.x)); liftMax = Math.max(liftMax, f.lift); armUp = Math.max(armUp, bone(f, "shoulderR").rotation.z);
    }
    // with the keeper facing back down the pitch, diving toward +y is to his local minus z side
    const diveSide = Math.sign(fig(gk).body.rotation.x);
    ok("a keeper dive: stretched out sideways, off the ground, arms past the head", rollMax > 1.1 && liftMax > 0.3 && armUp > 2.3, [rollMax, liftMax, armUp]);
    ok("the keeper dives the way the save is", diveSide === -1, diveSide);
    gk.diving = false; gk.vy = 0;
    for (let i = 0; i < 10; i++) pv.draw(ps, 1 / 60);
    ok("after the dive he lands on his side before getting up", Math.abs(fig(gk).body.rotation.x) > 1.0 && fig(gk).diveAfter > 0, fig(gk).body.rotation.x);
    for (let i = 0; i < 90; i++) pv.draw(ps, 1 / 60);
    ok("and then he is back on his feet", Math.abs(fig(gk).body.rotation.x) < 0.2, fig(gk).body.rotation.x);
    // the same names give the same faces in every match (seeded per player)
    const pv2 = createView3D(THREE, { FL, renderer: stubRenderer, width: 1280, height: 720, document: null });
    const ps2 = createSim3D({ home: "Arsenal", away: "Wolves", side: "home", homeXI: testXI(84, "H"), awayXI: testXI(78, "A") }, { rng: seeded(10) });
    pv2.draw(ps2, 1 / 60);
    ok("skin and hair are seeded per player, so they stay the same", ps2.m.players.every(p => { const a = pv2.figures.get(p.id), b = pv.figures.get(p.id); return a.skin === b.skin && a.hairStyle === b.hairStyle; }), null);
    // no allocations piling up: a long run keeps the same objects
    const before = fig(spr).mesh.geometry;
    for (let i = 0; i < 300; i++) { spr.vx = 8; pv.draw(ps, 1 / 60); }
    ok("figures are built once and reused every frame", fig(spr).mesh.geometry === before && pv.figures.size === 22, null);
    pv.dispose(); pv2.dispose();
    ok("dispose frees the bodies", pv.figures.size === 0, null);
  }

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
  const chips = () => { const st = B.doc.getElementById("mxKeys"); return st ? [...st.querySelectorAll("kbd")].map(k => k.textContent) : null; };
  ok("Classic shows the same key strip with only its own keys", JSON.stringify(chips()) === JSON.stringify(["WASD", "E", "Q", "Shift"]) && B.doc.getElementById("mxKeys").classList.contains("classic"), chips());
  B.M.close();
  ok("closing the match removes the key strip", !B.doc.getElementById("mxKeys"), null);

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
  const strip = () => B.doc.getElementById("mxKeys");
  ok("3D shows the controls strip with exactly the asked keys", strip() && JSON.stringify([...strip().querySelectorAll("kbd")].map(k => k.textContent)) === JSON.stringify(["WASD", "E", "Q", "T", "X", "Space", "F", "Shift"]) && [...strip().querySelectorAll("b")].map(x => x.textContent).join(" ") === "Move Shoot Pass Through Slide Tackle Skill Sprint", strip() && strip().textContent);
  ok("the strip sits in the match wrap above the HUD and is styled from the site kit", strip().parentNode === B.wrap && !!B.doc.getElementById("mxKeysStyle") && B.doc.getElementById("mxKeysStyle").textContent.includes("top:26px;right:18px"), null);
  ok("the strip is at full strength while the match settles in", !strip().classList.contains("dim"), strip().className);
  B.pump(150);
  ok("after a few seconds of play the strip fades down", strip().classList.contains("dim"), strip().className);
  ok("when the 3D view owns the HUD the Classic canvas is left alone", B.calls.length === callsBefore, B.calls.length - callsBefore);
  for (const code of ["KeyT", "KeyX", "KeyF", "Space"]) { B.win.dispatchEvent(new B.win.KeyboardEvent("keydown", { code })); B.pump(2); B.win.dispatchEvent(new B.win.KeyboardEvent("keyup", { code })); }
  ok("T, X, F and Space reach the deep sim as through, slide, skill and tackle", stepInputs.some(i => i.through) && stepInputs.some(i => i.slide) && stepInputs.some(i => i.skill) && stepInputs.some(i => i.tackle), stepInputs.length);
  ok("the one shot keys fire once per press, not every frame", stepInputs.filter(i => i.through).length === 1 && stepInputs.filter(i => i.skill).length === 1, stepInputs.filter(i => i.through).length);
  const d0 = made[0].draws;
  B.win.dispatchEvent(new B.win.KeyboardEvent("keydown", { code: "Escape" }));
  B.pump(30);
  ok("Esc still pauses in 3D and the scene holds still", B.panel.textContent.includes("Paused") && made[0].draws > d0 && made[0].lastDt === 0, [made[0].draws, made[0].lastDt]);
  ok("on pause the strip comes back to full", !strip().classList.contains("dim") && !strip().classList.contains("off"), strip().className);
  ok("the pause card keeps a tidy key list with the cross and headers", B.panel.querySelector(".mkeys") && B.panel.textContent.includes("Cross from wide") && B.panel.querySelectorAll(".mkeys span").length === 3, null);
  B.doc.getElementById("mxRes").click();
  B.pump(10);
  ok("back in play the strip stays full for a moment", !strip().classList.contains("dim"), strip().className);
  B.pump(200);
  ok("then fades again", strip().classList.contains("dim"), strip().className);
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
  ok("the strip steps aside on the full time screen", B.doc.getElementById("mxKeys") && B.doc.getElementById("mxKeys").classList.contains("off"), null);
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
    ok("the old help overlay is gone from the 3D HUD", !hudEl.querySelector(".m3-help") && !hudEl.textContent.includes("WASD") && !hudEl.textContent.includes("ATTACK TO THE RIGHT"), null);
    const bugText = hudEl.querySelector(".m3-bug").textContent;
    const digits = [...hudEl.querySelectorAll(".m3-sc .m3-d")].map(d => d.textContent).join(" ");
    ok("the TV scorebug sits top left with both club codes, the score and a running clock", bugText.includes("HOM") && bugText.includes("AWA") && digits === "0 0" && /^\d\d:\d\d$/.test(hudEl.querySelector(".m3-clk").textContent) && hudEl.querySelector(".m3-tm").title === "Home FC", [bugText, digits]);
    ok("the player card names my player with his number and rating", hudEl.querySelector(".m3-cname").textContent === s.m.ctrl.label && hudEl.querySelector(".m3-cnum").textContent === String(s.m.ctrl.num) && hudEl.querySelector(".m3-cmeta").textContent.includes(s.m.ctrl.rating + " OVR"), hudEl.querySelector(".m3-card").textContent);
    const lastLine = () => { const l = hudEl.querySelectorAll(".m3-feed .m3-line"); return l.length ? l[l.length - 1].textContent : ""; };
    ok("the commentary feed slides in the latest line", lastLine().length > 5 && LINES.kickoff.includes(lastLine()), lastLine());
    // the match moments: a goal plays the band and the scorer card, rolls the digit; a corner shows its banner
    v.onEvent({ type: "goal", team: 0, name: "Player9", own: false, min: 12, scorer: s.m.teams[0].players[9].id });
    s.m.score[0] = 1;
    v.draw(s, 1 / 60);
    ok("a goal plays the goal moment with the scorer and rolls the score", hudEl.querySelector(".m3-goal").classList.contains("in") && hudEl.querySelector(".m3-gword").textContent === "GOAL" && hudEl.querySelector(".m3-gname").textContent.includes("Player9") && hudEl.querySelector(".m3-sc .m3-d.roll") !== null && hudEl.querySelector(".m3-bug").classList.contains("hot"), hudEl.querySelector(".m3-goal").className);
    v.onEvent({ type: "corner", team: 1 });
    v.draw(s, 1 / 60);
    ok("a corner shows the set piece banner under the scorebug", hudEl.querySelector(".m3-sp").classList.contains("on") && hudEl.querySelector(".m3-sp").textContent === "CORNER", hudEl.querySelector(".m3-sp").textContent);
    s.m.aim = { x: 40, y: 5, z: 4, power: 0.7 };
    s.m.setPiece = { kind: "corner", team: 0, x: 52.5, y: 34, phase: "aim" };
    const jumper = s.m.players[5]; jumper.air = 0.8; jumper.headerAnim = 0.3;
    for (let i = 0; i < 90; i++) v.draw(s, 1 / 60);
    ok("the view reads the set piece hooks: aim ring on the target, camera leans in on the corner", v.aimRing.visible && Math.abs(v.aimRing.position.x - 40) < 1e-6 && v.camera.position.x > 25, [v.aimRing.visible, v.camera.position.x]);
    ok("a header lifts the body off the grass while the figure stays on its spot", v.figures.get(jumper.id).body.position.y > 0.4 && v.figures.get(jumper.id).g.position.y === 0, v.figures.get(jumper.id).body.position.y);
    s.m.aim = null; s.m.setPiece = null; jumper.air = 0; jumper.headerAnim = 0;
    v.draw(s, 1 / 60);
    ok("clearing the hooks hides the aim marker", !v.aimRing.visible, null);
    ok("each team has one print sheet with every name and number, laid on the back and the chest", view3dText.includes("function teamSheet(") && view3dText.includes('patch(B, "print"') && v.figures.size === 22, null);
    ok("the figures carry skin, hair and boot variety", view3dText.includes("SKIN = [") && view3dText.includes("HAIR = [") && view3dText.includes("HAIR_STYLES") && view3dText.includes("BOOTS = ["), null);
    v.dispose();
    ok("dispose removes the DOM HUD", !doc.getElementById("m3dHud"), null);
  }

  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("CRASH", e && e.stack ? e.stack.split("\n").slice(0, 6).join(" | ") : e); process.exit(1); });
