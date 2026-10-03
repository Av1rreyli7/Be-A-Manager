// Static checks on index.html for the football overhaul
const fs = require("fs");
const path = require("path");
const here = f => path.join(__dirname, f);
const html = fs.readFileSync(here("index.html"), "utf8");
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

// sim: week by week or the whole season, no more sim to a chosen week
ok("sim to week UI is gone", !html.includes("simToWrap") && !html.includes("simToW") && !html.includes("simToGo") && !html.includes("ffBtn18") && !html.includes("ffBtn37") && !html.includes("/api/simto"), null);
ok("sim season button exists and is wired to the new route", html.includes('id="simSeasonBtn"') && html.includes('$("simSeasonBtn").onclick') && html.includes('api("/api/simseason", {})'), null);
ok("sim season asks for a second click instead of a popup", html.includes("Click again to sim every week to the end") && !/simseason[\s\S]{0,200}confirm\(/.test(html), null);
ok("host only visibility toggle for sim season", html.includes('$("simSeasonBtn").classList.toggle("hidden"'), null);
ok("the squad table shows form, morale and effective rating", html.includes("<th class=\"num\" title=\"Form") && html.includes(">Morale</th>") && html.includes(">Eff</th>") && html.includes("condChip(p.cond && p.cond.form, 3)"), null);
ok("the feed shows the club news first", html.includes("Your club this season") && html.includes("s.myClub.news"), null);
ok("every list shows one number, with an arrow only when effective differs from base", html.includes("function ovrFace(base, eff)") && html.includes('dir === "flat" ? base : eff') && (html.match(/ovrChip\(/g) || []).length >= 8 && !html.includes('class="ovb"') && html.includes("\\u25b2") && html.includes("\\u25bc"), (html.match(/ovrChip\(/g) || []).length);
ok("the lineup pitch shows shirts with the rating chip attached, the remove X and age and position under", html.includes('<span class="lushirt">${shirtSvg(kitOf(p), nums[p.id] || "", luShort(p.name))}') && html.includes('<span class="luX" onclick="luSlotClear(${i},event)"') && html.includes('<span class="luchip">${p.cond ? ovrChip(p, true) : ratFace(p.rating)}</span>') && html.includes('<span class="luage">${p.age}Y \\u00b7 ${posBadge(p)}</span>'), null);
ok("the tooltip holds the base and the event cause", html.includes("BASE ' + base") && html.includes("c.causes || []") && html.includes("Not played"), null);
ok("events pop up after a sim, one after another, and get marked seen on the server", html.includes('id="eventModal"') && html.includes("function queueEvents(s)") && html.includes("function showNextEvent()") && html.includes('api("/api/newsseen", { id: x.i })') && html.includes("EV.queue.shift()") && html.includes("more after this"), null);
ok("the popups are delivered from the state's unseen list and the News feed keeps the archive", html.includes("s.myClub.unseenNews") && html.includes("Your club this season"), null);
ok("on the results screen the event is only teased; the popup waits for the lobby", html.includes('id="mdTeaser"') && html.includes("function evTeaser(s)") && html.includes("evTeaser(s);") && html.includes("!evOnResults(s)") && html.includes("brewing at "), null);
ok("playing your match, Play matchweek, Sim season and Sim next week all wait behind the event gate", html.includes("function evGate(fn)") && html.includes("if (evGate(() => window.playMatch(kind))) return;") && html.includes('if (evGate(() => $("simBtn").onclick())) return;') && html.includes("if (evGate(() => {})) return;") && html.includes("evGate(sim.onclick)"), null);
ok("the popup shows what the event did (injury, form, morale, how long, who) and many at once become one summary", html.includes("function evChips(e)") && html.includes("OUT FOR ") && html.includes('id="evFx"') && html.includes("WHILE THE WEEKS FLEW BY") && html.includes("Got it, let's play"), null);
ok("the OVR chip carries a breakdown popover with form, morale and injury return", html.includes('class="ovtip"') && html.includes('line("Form", c.form)') && html.includes('line("Morale", c.morale)') && html.includes('line("Back from injury", c.ret)') && html.includes(".ovr:hover .ovtip,.ovr:focus .ovtip"), null);
ok("arrows animate in with the rows and pulse once when a value changes", html.includes("@keyframes ovrin") && html.includes("@keyframes ovrpulse") && html.includes("OVR_SEEN[key] !== eff") && html.includes("prefers-reduced-motion"), null);
ok("squad, lineup, market, academy, loans out and scout tips all use the chip", html.includes("<td class=\"num\">${ovrChip(p)}</td><td class=\"num\">${appsText(p)}</td>") && (html.match(/ovrChip\(p, true\)/g) || []).length === 3 && html.includes("<td class=\"num\">${ovrChip(p)}</td><td class=\"num\">${p.pot || \"?\"}</td>"), (html.match(/ovrChip\(p, true\)/g) || []).length);
ok("appearances show compactly in the squad table and stale players are flagged", html.includes(">Apps</th>") && html.includes("function appsText(p)") && html.includes("p.bn >= 3 ? \" stale\""), null);
ok("the match detail lists the subs who came on", html.includes("class=\"mdsubs\">SUBS: ") && html.includes("evd.subs"), null);
ok("the travel tab, planner and advisor are on the page", html.includes('data-t="travel"') && html.includes('id="tab-travel"') && html.includes('id="travelModal"') && html.includes("/api/travelfund") && html.includes("/api/travelbook") && html.includes("travelBulk(") && html.includes("smart"), null);

// ---- the RAT column: one effective number (never the modifier), arrow in a fixed slot, columns aligned ----
{
  // a helper is either one line (function x(a) { ... }) or a block that closes on its own line
  const grab = name => {
    const one = new RegExp("^function " + name + "\\([^)]*\\) \\{.*\\}$", "m").exec(html);
    if (one) return one[0];
    const m = new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}").exec(html); return m ? m[0] : "";
  };
  const src = ["const OVR_SEEN = {};", grab("rcol"), grab("rchip"), grab("ratFace"), grab("ovrFace"), grab("ovrChip")].join("\n");
  let chip = null;
  try { chip = new Function(src + "\nreturn { ovrChip, ovrFace, ratFace };")(); } catch (e) { chip = null; }
  ok("the rating helpers can be read out of the page", !!chip, null);
  if (chip) {
    const face = h => { const m = /class="ove"[^>]*>([^<]*)<\/span><span class="ova">([^<]*)<\/span>/.exec(h); return m ? { n: m[1], a: m[2] } : null; };
    const cond = (eff, extra) => Object.assign({ form: 0, morale: 0, ret: 0, traveller: 0, causes: [], bench: 0, eff }, extra || {});
    const up = face(chip.ovrChip({ id: 1, name: "A", rating: 91, cond: cond(93.9, { form: 2.9 }) }));
    const down = face(chip.ovrChip({ id: 2, name: "B", rating: 80, cond: cond(77.6, { form: -2.4 }) }));
    const flat = face(chip.ovrChip({ id: 3, name: "C", rating: 88, cond: cond(88.2) }));
    const bare = face(chip.ratFace(74));
    ok("a player up on his base shows his effective OVR with an up arrow, never the plus", !!up && up.n === "94" && up.a === "▲", up);
    ok("a player down on his base shows his effective OVR with a down arrow, never the minus", !!down && down.n === "78" && down.a === "▼", down);
    ok("a flat player shows his base and an empty arrow slot", !!flat && flat.n === "88" && flat.a === "", flat);
    ok("a rating with no condition data uses the same face and slot", !!bare && bare.n === "74" && bare.a === "", bare);
    // a whole market worth of players: the shown number is always a real rating, never a small delta like 02
    let bad = [];
    for (let r = 45; r <= 94; r++) for (const d of [-4.6, -2.2, -0.4, 0, 0.3, 1.6, 3.9]) {
      const f = face(chip.ovrChip({ id: r * 100 + Math.round(d * 10), name: "P", rating: r, cond: cond(r + d) }));
      const want = Math.round(r + d) === r ? String(r) : String(Math.round(r + d));
      if (!f || f.n !== want || f.n.length < 2 || /^0/.test(f.n)) bad.push([r, d, f && f.n]);
    }
    ok("every shown rating is the effective OVR, two digits, no leading zero", bad.length === 0, bad.slice(0, 5));
  }
  ok("the market RAT cell is the chip on the player's own rating and condition", html.includes('<td class="num rat">${ovrChip(p)}</td>') && /api\("\/api\/market\?q=/.test(html), null);
  ok("the arrow slot is always drawn so a column lines up", html.includes("'</span><span class=\"ova\">' + face.arrow + \"</span>\"") && html.includes(".ovr{display:inline-grid;grid-template-columns:auto 9px"), null);
  ok("the out on loan table has its number headers right aligned like the cells", html.includes('<th class="num">Age</th><th class="num">Rat</th><th>At</th>'), null);
  ok("free agents and nation squads use the same rating face", html.includes('<td class="num rat">${ratFace(p.rating)}</td>') && (html.match(/ratFace\(p\.rating\)/g) || []).length >= 4, (html.match(/ratFace\(p\.rating\)/g) || []).length);
}

// ---- lineup shirts ----
ok("shirts are vector, from the back, in the club kit, the keeper in his own colour", html.includes("function shirtSvg(kit, num, name, cls)") && html.includes("const SHIRT_PATH") && html.includes("function keeperKit(kit)") && html.includes("FLMatch.pickKits(name") && html.includes('id="shirtShade"'), null);
ok("shirt numbers follow the 3D match role rule and are unique inside the squad", html.includes("function shirtNumbers(squad)") && html.includes("GK: [1, 13, 25], CB: [4, 5, 6, 15, 16, 24]") && html.includes("ST: [9, 10, 18, 20]"), null);
{
  const grab = name => { const m = new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}").exec(html); return m ? m[0] : ""; };
  const pre = /const NUM_PREF = \{[\s\S]*?\};\nconst NUM_FALLBACK = [^\n]*\nlet SHIRT = [^\n]*/.exec(html);
  let nums = null;
  try { nums = new Function((pre ? pre[0] : "") + "\n" + grab("shirtNumbers") + "\nreturn shirtNumbers;")(); } catch (e) { nums = null; }
  ok("the shirt number rule can be read out of the page", !!nums, null);
  if (nums) {
    const squad = [
      { id: 1, pos: "GK", role: "GK", rating: 85 }, { id: 2, pos: "GK", role: "GK", rating: 70 }, { id: 3, pos: "FW", role: "ST", rating: 90 },
      { id: 4, pos: "FW", role: "ST", rating: 80 }, { id: 5, pos: "DF", role: "CB", rating: 84 }, { id: 6, pos: "MF", role: "CAM", rating: 88 },
      { id: 7, pos: "FW", role: "RW", rating: 86 }, { id: 8, pos: "DF", role: "RB", rating: 78 }
    ];
    for (let i = 9; i <= 32; i++) squad.push({ id: i, pos: ["DF", "MF", "FW"][i % 3], role: ["CB", "CM", "ST"][i % 3], rating: 60 + (i % 9) });
    const m = nums(squad);
    const vals = squad.map(p => m[p.id]);
    ok("every player in a 32 man squad gets a number and no two share one", vals.every(v => Number.isInteger(v) && v > 0) && new Set(vals).size === vals.length, vals);
    ok("the best keeper wears 1, the best striker 9, the playmaker 10", m[1] === 1 && m[3] === 9 && m[6] === 10 && m[2] === 13, [m[1], m[3], m[6], m[2]]);
    ok("numbers stay put when ratings move but the squad does not", JSON.stringify(nums(squad.map(p => Object.assign({}, p, { rating: p.rating + (p.id % 3) })))) === JSON.stringify(m), null);
  }
}
ok("bench and reserve rows carry a small shirt with the number", (html.match(/<span class="bp">\$\{miniShirt\(kitOf\(p\), nums\[p\.id\] \|\| ""\)\}<\/span>/g) || []).length === 2, null);
ok("drag and tap placement on the pitch is untouched", html.includes('data-slot="${i}" onclick="luSlotTap(${i})" ondragover="event.preventDefault()"') && html.includes('ondrop="luDrop(event,${i})"') && html.includes("window.luDrop = (ev, slotIdx)") && html.includes('ondragstart="luDrag(event,${p.id})"'), null);
ok("shirts lift on hover, cast a shadow and drop in one after another when the lineup opens", html.includes(".luslot.lufilled:hover .lushirt{transform:translateY(-3px)}") && html.includes("drop-shadow(0 5px 4px") && html.includes("function shirtsIn(all, only)"), null);

// ---- motion and the shared kit ----
ok("the page runs in the kit's pitch mode and loads GSAP and the motion kit before the game", html.includes('<html lang="en" data-kmode="pitch">') && html.indexOf('<script src="vendor/gsap.min.js"></script>') > 0 && html.indexOf('<script src="/kit-motion.js"></script>') > html.indexOf('<script src="vendor/gsap.min.js"></script>') && html.indexOf('<script src="/kit-motion.js"></script>') < html.indexOf('<script src="match.js"></script>'), null);
ok("the poll never replays an entrance: containers are only rewritten when their markup changed", html.includes("if (el._fxHtml === html) return false;") && html.includes("Date.now() >= FX.hot") && html.includes("const moved = before ? list.filter((r, i) => before[i] !== now[i]) : list;"), null);
ok("screens animate in when a tab opens, with a sliding indicator under the tab", html.includes("if (was !== b) enterScreen($(\"tab-\" + b.dataset.t));") && html.includes("KM.tabIndicator(bar, on)") && html.includes("function enterScreen(sec)"), null);
ok("big numbers count up, form arrows pulse when they move, popups pop and messages slide in", html.includes("function countText(el, text)") && html.includes("countText($(\"hBudget\")") && html.includes("KM.pulse(c, { scale: 1.4 })") && html.includes("KM.pop(card)") && html.includes("KM.slideIn(t, { x: 14 })"), null);
ok("HERE WE GO for your club gets the celebration, and it never takes a click", html.includes('id="hwg"') && html.includes("function hereWeGo(text, kick)") && html.includes("KM.celebrate(") && html.includes("KM.sparks(") && /#hwg\{[^}]*pointer-events:none/.test(html), null);
ok("a deal that goes through gets its own moment on the offer card", html.includes('data-oid="${o.id}"') && html.includes('card.classList.add("won")'), null);
ok("the confidence bar scales on the GPU instead of resizing", html.includes('cfl.style.transform = "scaleX("') && !html.includes('cfl.style.width ='), null);
ok("reduced motion: the kit settles everything at once and the page's own extras switch off", html.includes(".luslot.lufilled:hover .lushirt{transform:none}") && html.includes(".mdhero.goalflash::after{animation:none"), null);

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
ok("match.js exists", fs.existsSync(here("match.js")), null);
const engine = fs.readFileSync(here("match.js"), "utf8");
let engineParses = true, engineMsg = "";
try { new Function(engine); } catch (e) { engineParses = false; engineMsg = e.message; }
ok("match.js parses", engineParses, engineMsg);
ok("no em or en dashes in match.js", !engine.includes("\u2014") && !engine.includes("\u2013"), null);
const serverText = fs.readFileSync(here("server.js"), "utf8");
ok("no em or en dashes in server.js", !serverText.includes("\u2014") && !serverText.includes("\u2013"), null);
ok("server.js serves match.js", serverText.includes('app.get("/floodlights/match.js"'), null);
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
ok("the plain sim buttons have no confirm popup, they only wait for a new event to be seen", /\$\("simBtn"\)\.onclick = async \(\) => \{\s*\/\/[^\n]*\n\s*if \(evGate\(\(\) => \$\("simBtn"\)\.onclick\(\)\)\) return;\s*\$\("simBtn"\)\.disabled = true; try \{ await api\("\/api\/sim",\{\}\)/.test(html) && /sim\.onclick = \(\) => evGate\(sim\.onclick\) \|\| \(async \(\) => \{ sim\.disabled = true; try \{ await api\("\/api\/sim",\{\}\)/.test(html), null);
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
