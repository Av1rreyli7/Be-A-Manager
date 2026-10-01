// Static checks on index.html for the football overhaul
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) passed++;
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 200)); }
}

// contracts are gone from the squad table
ok("no Contract column in the squad table", !html.includes("<th>Contract</th>"), null);
ok("no Terms button in squad rows", !html.includes("openTerms(${p.id})"), null);
ok("no expiring contract tag left anywhere", !html.includes("EXPIRING"), null);
ok("no sport picker left in the lobby", !html.includes("sportBall") && !html.includes("Pick your sport"), null);
ok("no basketball rendering left", !html.includes("renderHoops") && !html.includes("bbcourt"), null);

// loans at any age
ok("loan out button has no age condition", html.includes(`<button class="small ghost" onclick="loanOut(\${p.id})">Loan out</button>`) && !html.includes("p.age <= 23 ? `<button"), null);

// sim to chosen week
ok("sim to week wrapper exists", html.includes('id="simToWrap"'), null);
ok("week input exists with 1 to 38 bounds", html.includes('id="simToW"') && html.includes('min="1"') && html.includes('max="38"'), null);
ok("sim to week button exists", html.includes('id="simToGo"'), null);
ok("sim to week button is wired", html.includes('$("simToGo").onclick'), null);
ok("bad week input gets an alert", html.includes("Pick a week between 1 and 38"), null);
ok("host only visibility toggle for sim to week", html.includes('$("simToWrap").classList.toggle("hidden"'), null);
ok("winter and season end buttons still there", html.includes('id="ffBtn18"') && html.includes('id="ffBtn37"'), null);

// offers: countered inbound keeps the old bid alive, loan asks tagged
ok("seller can take the standing bid after countering", html.includes("Take their ${money(o.fee)}"), null);
ok("seller can counter again", html.includes("Counter again"), null);
ok("loan asks carry a LOAN ASK tag", html.includes("LOAN ASK"), null);

// personal terms stage is gone
ok("no offer terms button left", !html.includes("Offer terms") && !html.includes("sendTerms"), null);
ok("no wage input left in offers", !html.includes('placeholder="Wage m/season"'), null);

// release wording says AI clubs only
ok("release popup says only AI clubs get him", html.includes("joins an AI club for free") && html.includes("Human managers can never pick up released players"), null);
ok("no old free agent release wording", !html.includes("free agent for anyone to sign"), null);

// scripts still parse
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
ok("two script blocks found", blocks.length === 2, blocks.length);
for (let i = 0; i < blocks.length; i++) {
  let good = true, msg = "";
  try { new Function(blocks[i][1]); } catch (e) { good = false; msg = e.message; }
  ok("script block " + i + " parses", good, msg);
}

// no banned dash characters anywhere in the page
const emDash = html.includes("\u2014");
const enDash = html.includes("\u2013");
ok("no em dashes in the page", !emDash, null);
ok("no en dashes in the page", !enDash, null);

// playable match: button, canvas and wiring
ok("Play this match button exists", html.includes(">Play this match</button>"), null);
ok("Play this match button is wired", html.includes("onclick=\"playMatch('${kind}')\"") && html.includes("window.playMatch"), null);
ok("match canvas exists", html.includes('<canvas id="matchCanvas">'), null);
ok("match overlay and panel exist", html.includes('id="matchWrap"') && html.includes('id="matchPanel"'), null);
ok("match overlay starts hidden", html.includes('<div id="matchWrap" class="hidden">'), null);
ok("match.js is loaded by the page", html.includes('<script src="match.js"></script>'), null);
ok("the page posts kick off and the final score", html.includes('"/api/playstart"') && html.includes('"/api/playresult"'), null);
ok("the page stops redrawing while a match is open", html.includes("FLMatch.isOpen()"), null);
ok("other managers see who has played", html.includes('id="playStatus"'), null);

// the engine file itself
ok("match.js exists", fs.existsSync("match.js"), null);
const engine = fs.readFileSync("match.js", "utf8");
let engineParses = true, engineMsg = "";
try { new Function(engine); } catch (e) { engineParses = false; engineMsg = e.message; }
ok("match.js parses", engineParses, engineMsg);
ok("no em or en dashes in match.js", !engine.includes("\u2014") && !engine.includes("\u2013"), null);
const serverText = fs.readFileSync("server.js", "utf8");
ok("no em or en dashes in server.js", !serverText.includes("\u2014") && !serverText.includes("\u2013"), null);
ok("server.js serves match.js", serverText.includes('app.get("/match.js"'), null);
ok("engine uses requestAnimationFrame", engine.includes("requestAnimationFrame"), null);
for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "Escape"]) ok("engine listens for " + key, engine.includes('"' + key + '"'), null);

// headless playtest of the game loop, no browser needed
const FL = require("./match.js");
ok("engine exports the sim", typeof FL.createSim === "function" && typeof FL.open === "function", Object.keys(FL));
ok("match length is 6 minutes of real time", FL.MATCH_SECONDS === 360 && Math.abs(FL.STEP - 1 / 60) < 1e-9, [FL.MATCH_SECONDS, FL.STEP]);
ok("engine caps a side at 12 goals", FL.MAX_GOALS === 12, FL.MAX_GOALS);
function testXI(base, tag) {
  const rows = [["GK", "GK"], ["DF", "LB"], ["DF", "CB"], ["DF", "CB"], ["DF", "RB"], ["MF", "CDM"], ["MF", "CM"], ["MF", "CAM"], ["FW", "LW"], ["FW", "ST"], ["FW", "RW"]];
  return rows.map((r, i) => ({ n: tag + " Player" + i, pos: r[0], role: r[1], r: base + (i % 3) - 1 }));
}
function healthy(sim) {
  const m = sim.m, b = m.ball;
  if (!Number.isFinite(b.x + b.y + b.z + b.vx + b.vy + b.vz)) return "ball is not a number";
  if (Math.abs(b.x) > 58 || Math.abs(b.y) > 38) return "ball left the stadium";
  for (const p of m.players) {
    if (!Number.isFinite(p.x + p.y + p.vx + p.vy)) return "player is not a number";
    if (Math.abs(p.x) > 55 || Math.abs(p.y) > 36.5) return "player left the pitch";
    if (p.stamina < 0 || p.stamina > 1) return "stamina out of range";
  }
  if (m.score[0] > 12 || m.score[1] > 12 || m.score[0] < 0 || m.score[1] < 0) return "score out of range";
  return "";
}
function autoMatch(mine, theirs, side) {
  const sim = FL.createSim({ home: "Home FC", away: "Away FC", side, homeXI: testXI(side === "home" ? mine : theirs, "H"), awayXI: testXI(side === "home" ? theirs : mine, "A") }, { auto: true });
  let steps = 0, problem = "", lastMin = 0, minuteBackwards = false, sawHalf = false, said = 0;
  while (!sim.m.done && steps < 60 * 60 * 12) {
    sim.step(null);
    steps++;
    const mn = sim.minute();
    if (mn < lastMin) minuteBackwards = true;
    lastMin = mn;
    for (const ev of sim.m.events.splice(0)) { if (ev.type === "half") sawHalf = true; if (ev.type === "say") said++; }
    if (steps % 30 === 0 && !problem) problem = healthy(sim);
  }
  return { sim, steps, problem, lastMin, minuteBackwards, sawHalf, said };
}
const one = autoMatch(80, 80, "home");
ok("a full AI match reaches full time", one.sim.m.done && one.sim.m.phase === "full", one.steps);
ok("the match stays healthy all the way", one.problem === "", one.problem);
ok("the clock runs 0 to 90 and never goes back", one.lastMin === 90 && !one.minuteBackwards, one.lastMin);
ok("there is a half time", one.sawHalf && one.sim.m.half === 2, null);
ok("a match takes about 6 minutes of real time", one.steps / 60 >= 360 && one.steps / 60 <= 480, one.steps / 60);
ok("commentary lines pop up", one.said >= 3, one.said);
ok("both keepers and all 22 players are on the pitch", one.sim.m.players.length === 22 && one.sim.m.players.filter(p => p.gk).length === 2, one.sim.m.players.length);
const res1 = one.sim.result();
ok("the result comes back as home and away goals", Number.isInteger(res1.home) && Number.isInteger(res1.away) && res1.home === one.sim.m.score[0] && res1.away === one.sim.m.score[1], res1);
const awaySim = FL.createSim({ home: "Home FC", away: "Away FC", side: "away", homeXI: testXI(80, "H"), awayXI: testXI(80, "A") }, { auto: true });
awaySim.m.score[0] = 3; awaySim.m.score[1] = 1;
ok("when I am the away side my goals are the away goals", awaySim.result().home === 1 && awaySim.result().away === 3, awaySim.result());
ok("my team is team 0 and attacks to the right", awaySim.m.teams[0].name === "Away FC" && awaySim.m.teams[0].dir === 1, awaySim.m.teams[0].name);
const thin = FL.createSim({ home: "A", away: "B", side: "home", homeXI: testXI(75, "H").slice(1, 8), awayXI: [] }, { auto: true });
ok("a short or empty lineup is padded to 11 with a keeper", thin.m.teams.every(t => t.players.length === 11 && t.players.filter(p => p.gk).length === 1), thin.m.teams.map(t => t.players.length));

// difficulty follows the squad ratings: over a batch the stronger side must come out on top
let strongGoals = 0, weakGoals = 0, shotsAll = 0, batchProblem = "";
for (let i = 0; i < 10; i++) {
  const g = autoMatch(88, 78, i % 2 ? "home" : "away");
  strongGoals += g.sim.m.score[0]; weakGoals += g.sim.m.score[1];
  shotsAll += g.sim.m.stats.shots[0] + g.sim.m.stats.shots[1];
  if (g.problem || !g.sim.m.done) batchProblem = g.problem || "did not finish";
}
ok("ten more AI matches all finish clean", batchProblem === "", batchProblem);
ok("the stronger squad outscores the weaker one", strongGoals > weakGoals, [strongGoals, weakGoals]);
ok("matches have shots and goals in them", shotsAll >= 30 && strongGoals + weakGoals >= 5, [shotsAll, strongGoals + weakGoals]);
const easy = FL.createSim({ home: "A", away: "B", side: "home", homeXI: testXI(88, "H"), awayXI: testXI(76, "A") }, {});
const hard = FL.createSim({ home: "A", away: "B", side: "home", homeXI: testXI(76, "H"), awayXI: testXI(88, "A") }, {});
ok("a weaker opponent gives an easier setting", easy.m.edge < -0.5 && easy.m.teams[1].pressN === 1 && easy.m.teams[1].tackleAdj < 0, easy.m.edge);
ok("a stronger opponent gives a harder setting", hard.m.edge > 0.5 && hard.m.teams[1].pressN === 2 && hard.m.teams[1].tackleAdj > 0, hard.m.edge);
ok("better rated players are faster", hard.m.teams[1].players[5].sp > hard.m.teams[0].players[5].sp, null);

// a scripted person on the keyboard: run at goal, sprint, pass now and then, charge and release shots
const human = FL.createSim({ home: "Home FC", away: "Away FC", side: "home", homeXI: testXI(84, "H"), awayXI: testXI(74, "A") }, {});
let hSteps = 0, hProblem = "", ctrlBad = false, sawCharge = false, sawTired = false, hold = 0;
while (!human.m.done && hSteps < 60 * 60 * 12) {
  const hm = human.m, c = hm.ctrl, hb = hm.ball;
  const has = c && hb.owner === c;
  const inp = { mx: 0, my: 0, sprint: true, shoot: false, pass: false };
  if (c) {
    const txx = has ? 52.5 : hb.x, tyy = has ? 0 : hb.y;
    inp.mx = Math.sign(Math.round((txx - c.x) / 2));
    inp.my = Math.sign(Math.round((tyy - c.y) / 2));
    if (has && 52.5 - c.x < 22 && Math.abs(c.y) < 16) { hold++; inp.shoot = hold < 36; if (hold >= 36) hold = 0; }
    else { hold = 0; inp.pass = hSteps % 240 === 0; }
  }
  human.step(inp);
  hSteps++;
  human.m.events.length = 0;
  if (hm.charging) sawCharge = true;
  if (hm.tired) sawTired = true;
  if (hm.ctrl && (hm.ctrl.team !== 0 || hm.ctrl.gk)) ctrlBad = true;
  if (!hm.ctrl) ctrlBad = true;
  if (hSteps % 30 === 0 && !hProblem) hProblem = healthy(human);
}
ok("a keyboard driven match reaches full time", human.m.done, hSteps);
ok("the keyboard driven match stays healthy", hProblem === "", hProblem);
ok("I always control one of my own outfield players", !ctrlBad, null);
ok("holding E charges a shot and letting go shoots", sawCharge && human.m.stats.shots[0] >= 1, human.m.stats.shots);
ok("sprinting all match empties the stamina bar", sawTired, null);
const frozen = human.m.score.join("-") + "|" + human.m.t;
for (let i = 0; i < 300; i++) human.step({ mx: 1, my: 0, sprint: true, shoot: true, pass: true });
ok("nothing moves after full time", human.m.score.join("-") + "|" + human.m.t === frozen, frozen);

// ---- the host sims while a match is open ----
ok("the page gives the engine the simmed score check", html.includes("simmed: () => simmedResult(STATE, f, round, season)"), null);
ok("the page lets the engine ask for a fresh state", html.includes("recheck: () => tick()"), null);
ok("state polling keeps running while a match is open", html.includes("pollTimer = setInterval(tick, 3000)") && /STATE = await api\("\/api\/state"\);[\s\S]{0,200}FLMatch\.isOpen\(\)\)\) render\(\)/.test(html), null);
ok("the old will not count banner is gone", !engine.includes("WILL NOT COUNT") && !engine.includes("stillValid") && !html.includes("stillValid"), null);
ok("the engine has the host has simmed message", engine.includes("The host has simmed this week, your match was decided by the sim."), null);
ok("the plain sim buttons have no confirm popup", /\$\("simBtn"\)\.onclick = async \(\) => \{ \$\("simBtn"\)\.disabled = true; try \{ await api\("\/api\/sim",\{\}\)/.test(html) && /sim\.onclick = async \(\) => \{ sim\.disabled = true; try \{ await api\("\/api\/sim",\{\}\)/.test(html), null);
ok("kick off tells the server which fixture the page is showing", html.includes('api("/api/playstart", { kind, home: f.home, away: f.away })'), null);

// the page helper that finds the simmed score once the round has moved on
const srFn = /function simmedResult\(s, f, round, season\) \{[\s\S]*?\n\}\n/.exec(html);
ok("simmedResult helper found in the page", !!srFn, null);
const simmedResult = srFn ? new Function(srFn[0] + "return simmedResult;")() : () => undefined;
const lgF = { kind: "league", home: "A", away: "B" };
const st = (round, extra) => Object.assign({ round, season: 1, myFixtures: [{ week: 1, home: "A", away: "B", hg: 2, ag: 1 }, { week: 2, home: "C", away: "A", hg: null, ag: null }], cups: [] }, extra || {});
ok("no simmed score while the round has not moved", simmedResult(st(0), lgF, 0, 1) === null, null);
ok("no simmed score before the first state arrives", simmedResult(null, lgF, 0, 1) === null, null);
const sr1 = simmedResult(st(1), lgF, 0, 1);
ok("the simmed league score is found once the round moves on", !!sr1 && sr1.hg === 2 && sr1.ag === 1 && sr1.home === "A" && sr1.away === "B", sr1);
const sr2 = simmedResult(st(5), lgF, 0, 1);
ok("the simmed score is still found after a fast forward of many weeks", !!sr2 && sr2.hg === 2 && sr2.ag === 1, sr2);
const sr3 = simmedResult(st(0, { season: 2 }), lgF, 0, 1);
ok("a new season still counts as moved on, just with no score to show", !!sr3 && sr3.hg === null, sr3);
const cupState = st(3, { cups: [{ key: "efl", rounds: [{ week: 3, matches: [{ home: "A", away: "D", hg: 1, ag: 1, pens: true, winner: "D" }] }] }] });
const sr4 = simmedResult(cupState, { kind: "efl", home: "A", away: "D" }, 2, 1);
ok("the simmed cup score is found with the penalties note", !!sr4 && sr4.hg === 1 && sr4.ag === 1 && sr4.note.includes("D went through on penalties"), sr4);

// the real controller in a fake browser: canvas drawing is stubbed, everything else is the shipped code
async function controllerChecks() {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!DOCTYPE html><body><div id="matchWrap" class="hidden"><canvas id="matchCanvas"></canvas><div id="matchPanel" class="hidden"></div></div></body>', { runScripts: "outside-only" });
  const win = dom.window, doc = win.document;
  const sink = new Proxy(function () {}, {
    get: (t, k) => (k === "measureText" ? () => ({ width: 50 }) : k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => undefined),
    set: () => true
  });
  win.HTMLCanvasElement.prototype.getContext = () => sink;
  let cb = null, now = 1000;
  win.requestAnimationFrame = f => { cb = f; return 1; };
  win.cancelAnimationFrame = () => { cb = null; };
  win.eval(engine);
  const M = win.FLMatch;
  const pump = (n, stop) => { for (let i = 0; i < n && cb; i++) { const f = cb; cb = null; now += 16.667; f(now); if (stop && stop()) break; } };
  const settle = () => new Promise(r => setTimeout(r, 5));
  const panel = doc.getElementById("matchPanel"), wrap = doc.getElementById("matchWrap");
  const setup = { home: "Home FC", away: "Away FC", side: "home", homeXI: testXI(80, "H"), awayXI: testXI(80, "A") };
  const info = { kind: "league", label: "League, week 1", home: "Home FC", away: "Away FC", side: "home", homeRating: 80, awayRating: 80 };
  const mk = over => {
    const c = { simVal: null, finishCalls: [], closed: 0, rechecks: 0 };
    c.cfg = Object.assign({
      info, kickoff: async () => setup,
      finish: async (hg, ag) => { c.finishCalls.push([hg, ag]); return "Saved for the test."; },
      simmed: () => c.simVal, recheck: async () => { c.rechecks++; }, closed: () => { c.closed++; }
    }, over || {});
    return c;
  };
  const SIM_LINE = "The host has simmed this week, your match was decided by the sim.";

  // 1) mid match: the host sims, the match stops on the spot
  let c = mk();
  ok("the match opens", M.open(c.cfg) === true && M.isOpen() && !wrap.classList.contains("hidden"), null);
  ok("the kick off screen shows first", panel.textContent.includes("Kick off") && !panel.classList.contains("hidden"), null);
  doc.getElementById("mxGo").click();
  await settle();
  pump(300);
  ok("the match is running with no panel in the way", panel.classList.contains("hidden") && c.finishCalls.length === 0, panel.textContent.slice(0, 60));
  c.simVal = { home: "Home FC", away: "Away FC", hg: 3, ag: 1, note: "" };
  pump(40);
  ok("the match ends within a second of the round moving on", !panel.classList.contains("hidden") && panel.textContent.includes(SIM_LINE), panel.textContent.slice(0, 120));
  ok("the simmed final score is on the screen", panel.textContent.includes("Simmed final score") && panel.textContent.replace(/\s+/g, " ").includes("Home FC 3 - 1 Away FC"), panel.textContent);
  ok("the message covers the whole screen", panel.classList.contains("msolid"), panel.className);
  ok("there is a back to the game button", !!doc.getElementById("mxDone") && doc.getElementById("mxDone").textContent === "Back to the game", null);
  ok("no pause, quit or retry button is left on that screen", !doc.getElementById("mxRes") && !doc.getElementById("mxQuit") && !doc.getElementById("mxRetry"), null);
  const shown = panel.innerHTML;
  win.dispatchEvent(new win.KeyboardEvent("keydown", { code: "Escape" }));
  win.dispatchEvent(new win.KeyboardEvent("keydown", { code: "KeyE" }));
  pump(60 * 400);
  ok("the stopped match never reaches full time and sends nothing", c.finishCalls.length === 0 && panel.innerHTML === shown, c.finishCalls);
  doc.getElementById("mxDone").click();
  ok("the button goes back to the game", !M.isOpen() && c.closed === 1 && wrap.classList.contains("hidden") && panel.classList.contains("hidden") && !panel.classList.contains("msolid"), null);

  // 2) paused when the host sims
  c = mk();
  M.open(c.cfg);
  doc.getElementById("mxGo").click();
  await settle();
  pump(120);
  win.dispatchEvent(new win.KeyboardEvent("keydown", { code: "Escape" }));
  ok("Esc pauses the match", panel.textContent.includes("Paused"), panel.textContent.slice(0, 40));
  c.simVal = { home: "Home FC", away: "Away FC", hg: 0, ag: 0, note: "" };
  pump(40);
  ok("a paused match also ends when the host sims", panel.textContent.includes(SIM_LINE) && panel.textContent.replace(/\s+/g, " ").includes("Home FC 0 - 0 Away FC"), panel.textContent.slice(0, 120));
  doc.getElementById("mxDone").click();

  // 3) still on the kick off screen when the host sims
  let kicks = 0;
  c = mk({ kickoff: async () => { kicks++; return setup; } });
  M.open(c.cfg);
  pump(10);
  c.simVal = { home: "Home FC", away: "Away FC", hg: null, ag: null, note: "" };
  pump(40);
  ok("the kick off screen is replaced when the host sims", panel.textContent.includes(SIM_LINE) && !doc.getElementById("mxGo") && kicks === 0, panel.textContent.slice(0, 120));
  ok("with no score to show it points to the Matches tab", panel.textContent.includes("Matches tab") && !panel.textContent.includes("null"), panel.textContent);
  doc.getElementById("mxDone").click();

  // 4) the normal flow: a match finished before the host sims still sends its score
  c = mk();
  M.open(c.cfg);
  doc.getElementById("mxGo").click();
  await settle();
  pump(60 * 60 * 12, () => c.finishCalls.length > 0);
  await settle();
  ok("a finished match sends its score exactly once", c.finishCalls.length === 1 && Number.isInteger(c.finishCalls[0][0]) && Number.isInteger(c.finishCalls[0][1]), c.finishCalls);
  ok("the full time screen says it is saved", panel.textContent.includes("Full time") && panel.textContent.includes("Saved for the test."), panel.textContent.slice(0, 160));
  c.simVal = { home: "Home FC", away: "Away FC", hg: 5, ag: 5, note: "" };
  pump(120);
  ok("a saved result is not replaced by the host has simmed screen", panel.textContent.includes("Saved for the test.") && !panel.textContent.includes(SIM_LINE) && c.finishCalls.length === 1, panel.textContent.slice(0, 160));
  doc.getElementById("mxDone").click();
  ok("the normal flow closes cleanly", !M.isOpen() && c.closed === 1, null);

  // 5) the host sims in the last seconds: the save is turned down and the same clean screen shows
  c = mk();
  c.cfg.finish = async () => { c.finishCalls.push("sent"); throw new Error("The host has simmed this week, your match was decided by the sim."); };
  c.cfg.recheck = async () => { c.rechecks++; c.simVal = { home: "Home FC", away: "Away FC", hg: 2, ag: 2, note: "" }; };
  M.open(c.cfg);
  doc.getElementById("mxGo").click();
  await settle();
  pump(60 * 60 * 12, () => c.finishCalls.length > 0);
  await settle();
  await settle();
  ok("a save turned down by a late sim asks for a fresh state", c.rechecks === 1 && c.finishCalls.length === 1, [c.rechecks, c.finishCalls.length]);
  ok("and then shows the host has simmed screen with the simmed score", panel.textContent.includes(SIM_LINE) && panel.textContent.replace(/\s+/g, " ").includes("Home FC 2 - 2 Away FC") && !doc.getElementById("mxRetry"), panel.textContent.slice(0, 160));
  doc.getElementById("mxDone").click();

  // 6) a save that fails for some other reason still offers a retry
  c = mk();
  c.cfg.finish = async () => { c.finishCalls.push("sent"); throw new Error("Server error"); };
  M.open(c.cfg);
  doc.getElementById("mxGo").click();
  await settle();
  pump(60 * 60 * 12, () => c.finishCalls.length > 0);
  await settle();
  await settle();
  ok("any other save problem still shows the error and a retry", panel.textContent.includes("Server error") && !!doc.getElementById("mxRetry") && !panel.textContent.includes(SIM_LINE), panel.textContent.slice(0, 160));
  doc.getElementById("mxDone").click();
  ok("everything is closed at the end", !M.isOpen(), null);
}

controllerChecks().catch(e => { failed++; console.log("FAIL: controller checks crashed", e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e); }).then(() => {
  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
});
