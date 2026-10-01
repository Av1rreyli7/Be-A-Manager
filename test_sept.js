// Floodlights football battery. Run: node test_sept.js (server must NOT be running; this boots it)
const { spawn } = require("child_process");
const fs = require("fs");

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
async function api(path, body) {
  const url = "http://localhost:3000" + path;
  const opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
  const r = await fetch(url, opts);
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function readSave(wantCode) {
  await sleep(650);
  for (let i = 0; i < 60; i++) {
    try {
      const all = JSON.parse(fs.readFileSync("games.json"));
      if (!wantCode) return all;
      const found = Object.values(all).find(x => x.code === wantCode);
      if (found && found.clubs && found.players) return all;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error("save never showed game " + wantCode);
}
async function main() {
  try { fs.unlinkSync("games.json"); } catch (e) {}
  const server = spawn("node", ["server.js"], { stdio: "ignore" });
  process.on("exit", () => { try { server.kill(); } catch (e) {} });
  await sleep(1200);

  // ============ A) world data ============
  console.log("section A", Date.now());
  delete require.cache[require.resolve("./players")];
  const { buildDatabase } = require("./players");
  const db = buildDatabase();
  ok("database has 320 clubs after the league expansion", Object.keys(db.clubs).length === 320, Object.keys(db.clubs).length);
  const byL = {};
  for (const c of Object.values(db.clubs)) byL[c.league] = (byL[c.league] || 0) + 1;
  const wantSizes = { "Super Lig": 18, "Eredivisie": 18, "Primeira Liga": 18, "Belgian Pro League": 16, "Scottish Premiership": 12, "Saudi Pro League": 18, "MLS": 16, "Liga MX": 18, "Brasileirao": 20, "Argentina": 16, "Premier League": 20, "La Liga": 20, "Serie A": 20, "Bundesliga": 18, "Ligue 1": 18 };
  for (const [lg, n] of Object.entries(wantSizes)) ok(`${lg} has ${n} clubs`, byL[lg] === n, byL[lg]);
  const allP = Object.values(db.players);
  ok("player pool is big and alive", allP.length > 4800, allP.length);
  ok("no player value above the 400m cap at build", allP.every(p => p.value <= 400), Math.max(...allP.map(p => p.value)));
  const counts = {}; allP.forEach(p => counts[p.name] = (counts[p.name] || 0) + 1);
  const realDupes = new Set(["Danilo", "Pedro", "Ederson", "Alisson", "Andre Silva", "Paulinho", "Thiago Silva", "Tiago Silva", "Joao Carvalho"]);
  const badDupes = Object.entries(counts).filter(([n, c]) => c > 1 && !realDupes.has(n));
  ok("no generated name collisions", badDupes.length === 0, badDupes.slice(0, 5));
  for (const c of Object.values(db.clubs)) {
    if (c.squad.length < 12) { ok("club " + c.name + " squad too small", false, c.squad.length); break; }
  }
  ok("every club has at least 12 players", Object.values(db.clubs).every(c => c.squad.length >= 12), null);

  // ============ B) lobby, fixtures, euro fields ============
  console.log("section B", Date.now());
console.log("b1");
  let r = await api("/api/create", { name: "Host" });
  const code = r.j.code;
  ok("game created", r.status === 200 && !!code, r.j);
console.log("b2");
  await api("/api/join", { code, name: "Turk" });
  await api("/api/pick", { code, name: "Host", team: "Arsenal" });
  await api("/api/pick", { code, name: "Turk", team: "Galatasaray" });
console.log("b3");
  r = await api("/api/start", { code, name: "Host" });
  ok("season starts", r.status === 200, r.j);

console.log("b4");
  let saved = await readSave(code);
  let g = Object.values(saved).find(x => x.code === code);
  ok("Super Lig plays 34 rounds", g.leagueFixtures["Super Lig"].length === 34, g.leagueFixtures["Super Lig"].length);
  ok("Brasileirao plays 38 rounds, the real count", g.leagueFixtures["Brasileirao"].length === 38, g.leagueFixtures["Brasileirao"].length);
  ok("Scottish Premiership plays 22 rounds", g.leagueFixtures["Scottish Premiership"].length === 22, g.leagueFixtures["Scottish Premiership"].length);
  ok("Premier League still plays 38 rounds", g.leagueFixtures["Premier League"].length === 38, g.leagueFixtures["Premier League"].length);
  ok("Eredivisie plays 34 rounds", g.leagueFixtures["Eredivisie"].length === 34, g.leagueFixtures["Eredivisie"].length);

console.log("b5");
  const uclTeams = [...new Set([...g.cups.ucl.rounds[0].flatMap(m => [m.home, m.away]), ...g.cups.ucl.byes])].filter(Boolean);
  const uelTeams = [...new Set([...g.cups.uel.rounds[0].flatMap(m => [m.home, m.away]), ...g.cups.uel.byes])].filter(Boolean);
  const ueclTeams = [...new Set([...g.cups.uecl.rounds[0].flatMap(m => [m.home, m.away]), ...g.cups.uecl.byes])].filter(Boolean);
  ok("Champions League has 32 clubs", uclTeams.length === 32, uclTeams.length);
  ok("Champions League runs five rounds", g.cups.ucl.weeks.length === 5, g.cups.ucl.weeks);
  ok("Europa League has 16 clubs", uelTeams.length === 16, uelTeams.length);
  ok("Conference League has 16 clubs", ueclTeams.length === 16, ueclTeams.length);
  const clubLeague = n => (g.clubs[n] || {}).league;
  ok("a Turkish club is in the Champions League", uclTeams.some(t => clubLeague(t) === "Super Lig"), uclTeams.filter(t => clubLeague(t) === "Super Lig"));
  ok("England sends five to the Champions League", uclTeams.filter(t => clubLeague(t) === "Premier League").length === 5, uclTeams.filter(t => clubLeague(t) === "Premier League"));
  ok("Spain sends five to the Champions League", uclTeams.filter(t => clubLeague(t) === "La Liga").length === 5, uclTeams.filter(t => clubLeague(t) === "La Liga"));
  ok("France sends three to the Champions League", uclTeams.filter(t => clubLeague(t) === "Ligue 1").length === 3, uclTeams.filter(t => clubLeague(t) === "Ligue 1"));
  const overlap = uclTeams.filter(t => uelTeams.includes(t) || ueclTeams.includes(t)).concat(uelTeams.filter(t => ueclTeams.includes(t)));
  ok("no club is in two European cups at once", overlap.length === 0, overlap);

  // ============ C) contracts are gone ============
  console.log("section C", Date.now());
  r = await api(`/api/state?code=${code}&name=Host`);
  const myBefore = r.j.myClub.squad.filter(p => !p.academy).slice(0, 5).map(p => ({ id: p.id, y: p.contractYears }));
  r = await api("/api/renegotiate", { code, name: "Host", playerId: myBefore[0].id, wage: 5, years: 4, role: "Star" });
  ok("renegotiation is switched off with a clear message", r.status === 400 && (r.j.error || "").includes("never run out"), r.j);
  r = await api(`/api/market?code=${code}&name=Host`);
  ok("the free agent list is empty by design", (r.j.freeAgents || []).length === 0, r.j.freeAgents);
  r = await api("/api/signfree", { code, name: "Host", playerId: 1 });
  ok("signing free agents is switched off", r.status === 400 && (r.j.error || "").includes("Free agents are gone"), r.j);

  // release lands the player at another club instantly
  r = await api(`/api/state?code=${code}&name=Host`);
  const relBudBefore = r.j.myClub.budget;
  const victim = r.j.myClub.squad.filter(p => p.pos !== "GK" && !p.academy && !p.loanOwner).sort((a, b) => a.rating - b.rating)[0];
  r = await api("/api/release", { code, name: "Host", playerId: victim.id });
  ok("release succeeds", r.status === 200, r.j);
  r = await api(`/api/state?code=${code}&name=Host`);
  ok("released player left the squad", !r.j.myClub.squad.some(p => p.id === victim.id), victim.name);
  ok("release cost exactly 0.5m", Math.abs(relBudBefore - r.j.myClub.budget - 0.5) < 0.01, [relBudBefore, r.j.myClub.budget]);
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  const relP = g.players[victim.id];
  ok("released player signed for an AI club the same week", relP.club !== "" && relP.club !== "Arsenal" && g.clubs[relP.club] && g.clubs[relP.club].squad.includes(victim.id), relP.club);
  ok("release story says no free agents in this world", (g.feed || []).some(f => (f.text || "").includes("No free agents in this world")), null);
  r = await api("/api/release", { code, name: "Host", playerId: victim.id });
  ok("you cannot release a player who is no longer yours", r.status === 400, r.j);

  // ============ D) buying: counters never dead end ============
  console.log("section D", Date.now());
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  const lowT = Object.values(g.players).find(p => !p.academy && !p.loanOwner && !p.pendingDeal && p.club && p.club !== "Arsenal" && p.club !== "Galatasaray" && g.clubs[p.club] && g.clubs[p.club].squad.length > 17 && p.rating >= 76 && p.rating <= 81 && p.value >= 8 && p.value <= 60);
  ok("a mid tier lowball target exists", !!lowT, lowT && lowT.name);
  const lowFee = Math.max(0.5, Math.round(lowT.value * 0.25 * 10) / 10);
  r = await api("/api/offer", { code, name: "Host", playerId: lowT.id, fee: lowFee });
  ok("a lowball bid goes in", r.status === 200, r.j);
  let off = r.j.offer;
  ok("the lowball is countered, not killed", off.status === "countered" && off.counterFee > 0, off);
  ok("the counter note keeps the door open", (off.note || "").includes("door stays open"), off.note);
  r = await api("/api/respond", { code, name: "Host", offerId: off.id, action: "accept" });
  ok("accepting their price moves the deal on", r.status === 200, r.j);
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  off = g.offers.find(o => o.id === off.id);
  ok("meeting their price signs him outright, no wage talk", ["accepted", "failed"].includes(off.status), off.status);
  if (off.status === "accepted") {
    r = await api(`/api/state?code=${code}&name=Host`);
    ok("the signing is in the squad the same day", r.j.myClub.squad.some(p => p.id === lowT.id), lowT.name);
    const signed = r.j.myClub.squad.find(p => p.id === lowT.id);
    ok("he got a sensible default deal on arrival", signed && signed.wage > 0 && signed.squadRole, signed && [signed.wage, signed.squadRole]);
  }
  r = await api("/api/terms", { code, name: "Host", offerId: off.id, wage: 5, years: 3, role: "First team" });
  ok("the personal terms route is gone", r.status === 404, r.status);

  // ============ E) settled stars refuse to move ============
  console.log("section E", Date.now());
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  const settled = Object.values(g.players).find(p => p.age <= 23 && p.rating >= 87 && !p.listed && p.club && p.club !== "Arsenal" && p.club !== "Galatasaray" && g.clubs[p.club]);
  ok("a generational settled star exists in the world", !!settled, settled && settled.name);
  if (settled) {
    const myBudget = g.clubs["Arsenal"].budget;
    const saneFee = Math.max(1, Math.min(Math.round(myBudget * 0.9), Math.round(settled.value)));
    r = await api("/api/offer", { code, name: "Host", playerId: settled.id, fee: saneFee });
    const so = r.j.offer || {};
    ok("a sane bid for a settled star is refused", ["declined", "player_declined"].includes(so.status), so.status);
    ok("the refusal comes with a story", (so.note || "").length > 20, so.note);
  }

  // ============ F) any age loans ============
  console.log("section F", Date.now());
  r = await api(`/api/state?code=${code}&name=Host`);
  const oldie = r.j.myClub.squad.filter(p => !p.academy && !p.loanOwner && p.age >= 27 && p.pos !== "GK").sort((a, b) => a.rating - b.rating)[0];
  ok("an older squad player exists to loan", !!oldie, r.j.myClub.squad.length);
  r = await api("/api/loanout", { code, name: "Host", playerId: oldie.id });
  ok("loaning out a player past 23 works now", r.status === 200, r.j);
  r = await api(`/api/state?code=${code}&name=Host`);
  ok("he shows in the out on loan list", (r.j.myClub.loanedOut || []).some(p => p.id === oldie.id), r.j.myClub.loanedOut);
  r = await api("/api/recall", { code, name: "Host", playerId: oldie.id });
  ok("recalling him works", r.status === 200, r.j);

  // ============ G) selling: AI answers counters, loan asks arrive ============
  console.log("section G", Date.now());
  r = await api(`/api/state?code=${code}&name=Host`);
  for (const pl of r.j.myClub.squad.filter(p => !p.academy && !p.loanOwner && p.rating >= 78).slice(0, 3)) {
    await api("/api/list", { code, name: "Host", playerId: pl.id });
  }
  let inbound = null, loanAsk = null;
  for (let w = 0; w < 8; w++) {
    saved = await readSave(code);
    g = Object.values(saved).find(x => x.code === code);
    if (g.round === 4) { await api("/api/simto", { code, name: "Host", week: 19 }); }
    await api("/api/sim", { code, name: "Host" });
    saved = await readSave(code);
    g = Object.values(saved).find(x => x.code === code);
    inbound = inbound || g.offers.find(o => o.direction === "inbound" && o.sellerClub === "Arsenal" && !o.kind && o.status === "pending_seller");
    loanAsk = loanAsk || g.offers.find(o => o.direction === "inbound" && o.kind === "loan" && ["pending_seller", "countered", "accepted"].includes(o.status));
    if (inbound && loanAsk) break;
    if (g.round >= 22) break;
  }
  ok("an AI club bid on a human player", !!inbound, g.offers.filter(o => o.direction === "inbound").length);
  ok("an AI club asked a human for a loan", !!loanAsk, g.offers.filter(o => o.kind === "loan").length);
  if (inbound) {
    const crazy = Math.round(inbound.fee * 4 * 10) / 10;
    r = await api("/api/respond", { code, name: "Host", offerId: inbound.id, action: "counter", counterFee: crazy });
    ok("countering an inbound bid works", r.status === 200, r.j);
    await api("/api/sim", { code, name: "Host" });
    saved = await readSave(code);
    g = Object.values(saved).find(x => x.code === code);
    let after = g.offers.find(o => o.id === inbound.id);
    ok("the AI answered instead of walking away", after && after.status === "pending_seller", after && after.status);
    ok("the AI reply keeps a bid on the table", after && (after.note || "").match(/on the table|accept your price|final bid/), after && after.note);
    r = await api(`/api/state?code=${code}&name=Host`);
    const sellerSquad = r.j.myClub.squad.filter(p => !p.academy).length;
    if (after && after.status === "pending_seller" && sellerSquad > 16) {
      r = await api("/api/respond", { code, name: "Host", offerId: inbound.id, action: "accept" });
      const shut = r.status === 400 && ((r.j || {}).error || "").includes("window is shut");
      saved = await readSave(code);
      g = Object.values(saved).find(x => x.code === code);
      after = g.offers.find(o => o.id === inbound.id);
      ok("accepting the standing bid completes, fails cleanly, or waits for the window", shut ? after.status === "pending_seller" : ["accepted", "failed", "void"].includes(after.status), [r.status, after.status]);
    }
  }
  if (loanAsk && loanAsk.status === "pending_seller") {
    r = await api("/api/respond", { code, name: "Host", offerId: loanAsk.id, action: "accept" });
    const shutL = r.status === 400 && ((r.j || {}).error || "").includes("window is shut");
    ok("accepting a loan ask works or waits for the window", r.status === 200 || shutL, r.j);
    saved = await readSave(code);
    g = Object.values(saved).find(x => x.code === code);
    const lp = g.players[loanAsk.playerId];
    const done = g.offers.find(o => o.id === loanAsk.id);
    if (done.status === "accepted") {
      ok("the loaned player moved out with his future kept", lp.loanOwner === "Arsenal" && lp.club === loanAsk.fromClub, [lp.club, lp.loanOwner]);
    } else if (!shutL) {
      ok("a loan ask that could not complete failed cleanly", ["failed", "void"].includes(done.status), done.status);
    }
  }

  // ============ H) AI market is alive and loud ============
  console.log("section H", Date.now());
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  const dealLines = (g.feed || []).filter(f => /TRANSFER:|AGREED:|LOAN:/.test(f.text || "")).length;
  ok("the AI market is busy: at least 12 deal stories so far", dealLines >= 12, dealLines);
  ok("Romano is loud: at least 10 posts", (g.romano || []).length >= 10, (g.romano || []).length);
  const aiLoanCount = Object.values(g.players).filter(p => p.loanOwner && p.loanOwner !== "Arsenal" && p.loanOwner !== "Galatasaray").length;
  ok("AI to AI loans happened", aiLoanCount >= 1, aiLoanCount);

  // ============ I) sim to a chosen week ============
  console.log("section I", Date.now());
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  const target = Math.min(30, g.round + 4);
  r = await api("/api/simto", { code, name: "Turk", week: target });
  ok("only the host can sim ahead", r.status === 400 || r.status === 403, r.status);
  r = await api("/api/simto", { code, name: "Host", week: target });
  ok("sim to an arbitrary week works", r.status === 200, r.j);
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  ok("the round landed on the chosen week", g.round === target, [g.round, target]);
  r = await api("/api/simto", { code, name: "Host", week: 2 });
  ok("simming backwards is refused", r.status === 400, r.j);

  // ============ J) full season, contracts still frozen, injuries happened ============
  console.log("section J", Date.now());
  const beforeYears = {};
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  for (const [id, p] of Object.entries(g.players)) { if (p.contractYears !== undefined) { beforeYears[id] = p.contractYears; if (Object.keys(beforeYears).length >= 20) break; } }
  await api("/api/simto", { code, name: "Host", week: 38 });
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  ok("season reached the end", g.round >= 38 || g.seasonOver === true || g.round === 38, g.round);
  const hurtNow = Object.values(g.players).filter(p => p.inj > 0).length;
  ok("injuries happened over the season", hurtNow >= 1 || (g.feed || []).some(f => (f.text || "").startsWith("INJURY:")), hurtNow);
  ok("no injury length is broken", Object.values(g.players).every(p => !(p.inj > 8) && !(p.inj < 0)), null);
  ok("no out of contract stories all season", !(g.feed || []).some(f => (f.text || "").includes("OUT OF CONTRACT")), null);
  const uclWinner = (g.cups.ucl || {}).winner;
  const uelWinner = (g.cups.uel || {}).winner;
  const ueclWinner = (g.cups.uecl || {}).winner;
  ok("the Champions League produced a winner", !!uclWinner, uclWinner);
  ok("the Europa League produced a winner", !!uelWinner, uelWinner);

  r = await api("/api/nextseason", { code, name: "Host" });
  ok("next season starts", r.status === 200, r.j);
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  ok("season number bumped", g.season === 2, g.season);
  let unchanged = 0, checked = 0;
  for (const [id, y] of Object.entries(beforeYears)) {
    const p = g.players[id];
    if (!p || p.contractYears === undefined) continue;
    checked++;
    if (p.contractYears === y) unchanged++;
  }
  ok("contracts did not tick down over the summer", checked > 0 && unchanged === checked, [unchanged, checked]);
  const clubless = Object.values(g.players).filter(p => !p.academy && !p.retired && p.club === "" && p.rating > 62).length;
  ok("nobody is floating without a club", clubless === 0, clubless);

  // title holders parachute per the rules
  const ucl2 = [...new Set([...g.cups.ucl.rounds[0].flatMap(m => [m.home, m.away]), ...g.cups.ucl.byes])].filter(Boolean);
  const uel2 = [...new Set([...g.cups.uel.rounds[0].flatMap(m => [m.home, m.away]), ...g.cups.uel.byes])].filter(Boolean);
  ok("last season's Champions League winner is back in it", ucl2.includes(uclWinner), [uclWinner, ucl2.length]);
  ok("the Europa League winner went into the Champions League", ucl2.includes(uelWinner), [uelWinner]);
  if (ueclWinner) ok("the Conference winner moved up to Europa or higher", uel2.includes(ueclWinner) || ucl2.includes(ueclWinner), ueclWinner);
  ok("season two Champions League still has 32 clubs", ucl2.length === 32, ucl2.length);

  // ============ K) value cap holds after growth ============
  console.log("section K", Date.now());
  await api("/api/simto", { code, name: "Host", week: 38 });
  await api("/api/nextseason", { code, name: "Host" });
  saved = await readSave(code);
  g = Object.values(saved).find(x => x.code === code);
  const maxVal = Math.max(...Object.values(g.players).map(p => p.value || 0));
  ok("no player value ever passes 400m", maxVal <= 400, maxVal);
  ok("season three is alive", g.season === 3, g.season);

  // ============ L) basketball is completely gone ============
  r = await api("/api/create", { name: "Coach", sport: "basketball" });
  ok("asking for basketball just makes a football game", r.status === 200 && !!r.j.code, r.j);
  const bc = r.j.code;
  saved = await readSave(bc);
  const bg = Object.values(saved).find(x => x.code === bc);
  ok("that game is football", bg.sport !== "basketball", bg.sport);
  ok("that game has football clubs, not NBA teams", !!bg.clubs["Arsenal"] && !bg.clubs["Los Angeles Lakers"], Object.keys(bg.clubs).length);
  r = await api("/api/trade", { code: bc, name: "Coach" });
  ok("the trade route is gone", r.status === 404, r.status);
  r = await api("/api/draftpick", { code: bc, name: "Coach" });
  ok("the draft route is gone", r.status === 404, r.status);
  r = await api("/api/signfa", { code: bc, name: "Coach" });
  ok("the NBA free agency route is gone", r.status === 404, r.status);
  const srv = fs.readFileSync("server.js", "utf8");
  const bballRefs = (srv.match(/hoops|HOOPS|Hoops|bbSalary|bbWage|newHoopsGame/g) || []).length;
  ok("no basketball code left in the server", bballRefs === 0, bballRefs);
  const page = fs.readFileSync("index.html", "utf8");
  ok("no basketball code left in the page", !/basketball|renderHoops|sportBall|bbcourt|bball/.test(page), null);
  ok("hoops data file is deleted", !fs.existsSync("hoops_data.js"), null);

  // ============ M) playable matches: play your own fixture, the sim uses your score ============
  console.log("section M", Date.now());
  r = await fetch("http://localhost:3000/match.js");
  const engineText = await r.text();
  ok("the server serves match.js", r.status === 200 && engineText.includes("FLMatch"), r.status);
  r = await api("/api/create", { name: "Boss" });
  const pc = r.j.code;
  await api("/api/join", { code: pc, name: "Mate" });
  saved = await readSave(pc);
  let pg = Object.values(saved).find(x => x.code === pc);
  const fixOf = (gm, team, idx) => gm.leagueFixtures["Premier League"][idx].find(m => m.home === team || m.away === team);
  const wk4 = fixOf(pg, "Bournemouth", 3);
  const mateClub = wk4.home === "Bournemouth" ? wk4.away : wk4.home;
  await api("/api/pick", { code: pc, name: "Boss", team: "Bournemouth" });
  await api("/api/pick", { code: pc, name: "Mate", team: mateClub });
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
  ok("no kick off before the season starts", r.status === 400, r.j);
  r = await api("/api/start", { code: pc, name: "Boss" });
  ok("the play test season starts", r.status === 200, r.j);

  r = await api(`/api/state?code=${pc}&name=Boss`);
  const myFx = (r.j.playable || []).find(f => f.kind === "league");
  ok("my league fixture is offered as playable", !!myFx && (myFx.home === "Bournemouth" || myFx.away === "Bournemouth") && !myFx.blocked, r.j.playable);
  ok("playable fixture carries both team ratings", !!myFx && myFx.homeRating > 40 && myFx.awayRating > 40, myFx);
  ok("nothing is marked played yet", r.j.myPlay === null, r.j.myPlay);
  const otherFx = r.j.thisWeek.find(m => m.home !== "Bournemouth" && m.away !== "Bournemouth" && m.home !== mateClub && m.away !== mateClub);
  const mateFx = r.j.thisWeek.find(m => m.home === mateClub || m.away === mateClub);

  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 2, ag: 1 });
  ok("a result with no kick off is refused", r.status === 400 && (r.j.error || "").includes("Kick off"), r.j);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "ucl" });
  ok("kick off for a cup I am not in this week is refused", r.status === 400, r.j);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
  ok("kick off works for my own fixture", r.status === 200 && r.j.home === myFx.home && r.j.away === myFx.away, r.j);
  ok("kick off sends two full teams", (r.j.homeXI || []).length === 11 && (r.j.awayXI || []).length === 11, [(r.j.homeXI || []).length, (r.j.awayXI || []).length]);
  ok("each team has exactly one keeper", (r.j.homeXI || []).filter(p => p.pos === "GK").length === 1 && (r.j.awayXI || []).filter(p => p.pos === "GK").length === 1, null);
  ok("kick off tells me which side I am", r.j.side === (myFx.home === "Bournemouth" ? "home" : "away"), r.j.side);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
  ok("a second kick off in the same round is refused", r.status === 400, r.j);

  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: otherFx.home, away: otherFx.away, hg: 3, ag: 0 });
  ok("a result for a fixture that is not mine is refused", r.status === 400 && (r.j.error || "").includes("not your match"), r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: mateFx.home, away: mateFx.away, hg: 3, ag: 0 });
  ok("a result for another manager's fixture is refused", r.status === 400, r.j);
  r = await api("/api/playresult", { code: pc, name: "Mate", kind: "league", home: myFx.home, away: myFx.away, hg: 0, ag: 9 });
  ok("another manager cannot send a result for my fixture", r.status === 400, r.j);
  r = await api("/api/playresult", { code: pc, name: "Ghost", kind: "league", home: myFx.home, away: myFx.away, hg: 1, ag: 0 });
  ok("someone outside the game cannot send a result", r.status === 403, r.status);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 50, ag: 0 });
  ok("a silly score like 50 is refused", r.status === 400 && (r.j.error || "").includes("does not look right"), r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 13, ag: 0 });
  ok("13 goals is over the cap", r.status === 400, r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: -1, ag: 0 });
  ok("a negative score is refused", r.status === 400, r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 1.5, ag: 0 });
  ok("half a goal is refused", r.status === 400, r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: "3", ag: 0 });
  ok("a score sent as text is refused", r.status === 400, r.j);
  r = await api(`/api/state?code=${pc}&name=Boss`);
  ok("bad results did not use up my play", r.j.myPlay && r.j.myPlay.status === "started", r.j.myPlay);

  // 7-5 is a score the normal sim almost never makes, so a match on it proves the stored score was used
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 7, ag: 5 });
  ok("a valid result is accepted", r.status === 200 && r.j.ok === true, r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 1, ag: 0 });
  ok("a second result in the same round is refused", r.status === 400 && (r.j.error || "").includes("already played"), r.j);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
  ok("a second play in the same round is refused", r.status === 400 && (r.j.error || "").includes("already played"), r.j);
  r = await api(`/api/state?code=${pc}&name=Boss`);
  ok("my stored result shows in my state", r.j.myPlay && r.j.myPlay.status === "done" && r.j.myPlay.hg === 7 && r.j.myPlay.ag === 5, r.j.myPlay);
  ok("the fixture itself stays unplayed until the host sims", r.j.thisWeek.find(m => m.home === myFx.home && m.away === myFx.away).hg === null, null);
  r = await api(`/api/state?code=${pc}&name=Mate`);
  ok("other managers can see that I played", (r.j.users.find(u => u.name === "Boss") || {}).play === "done", r.j.users);
  ok("other managers do not get my stored score", r.j.myPlay === null, r.j.myPlay);

  // Mate is in the middle of a match when the host sims: the host is never held up or warned
  r = await api("/api/playstart", { code: pc, name: "Mate", kind: "league", home: mateFx.home, away: mateFx.away });
  ok("another manager kicks off their own match", r.status === 200, r.j);
  r = await api("/api/sim", { code: pc, name: "Boss" });
  ok("the host sims the played week", r.status === 200, r.j);
  ok("the host sims freely with no warning while a manager is mid match", JSON.stringify(r.j) === JSON.stringify({ ok: true }), r.j);
  r = await api(`/api/state?code=${pc}&name=Mate`);
  const mateSimmed = r.j.lastWeek.find(m => m.home === mateFx.home && m.away === mateFx.away);
  ok("the mid match manager's fixture was decided by the sim", !!mateSimmed && mateSimmed.hg !== null && !mateSimmed.played, mateSimmed);
  ok("the page can see the round moved past the fixture being played", r.j.round === 1 && r.j.myPlay === null, [r.j.round, r.j.myPlay]);
  r = await api("/api/playresult", { code: pc, name: "Mate", kind: "league", home: mateFx.home, away: mateFx.away, hg: mateSimmed.hg === 11 ? 10 : 11, ag: 0 });
  ok("the mid match manager's late score is refused", r.status === 400 && (r.j.error || "").includes("The host has simmed this week, your match was decided by the sim"), r.j);
  r = await api(`/api/state?code=${pc}&name=Mate`);
  const mateAfter = r.j.lastWeek.find(m => m.home === mateFx.home && m.away === mateFx.away);
  ok("the simmed score stands for the mid match manager", mateAfter.hg === mateSimmed.hg && mateAfter.ag === mateSimmed.ag && !mateAfter.played, [mateSimmed, mateAfter]);
  r = await api(`/api/state?code=${pc}&name=Boss`);
  const playedRow = r.j.lastWeek.find(m => m.home === myFx.home && m.away === myFx.away);
  ok("the simmed week shows exactly my submitted score", !!playedRow && playedRow.hg === 7 && playedRow.ag === 5, playedRow);
  ok("the result is tagged as played by me", !!playedRow && playedRow.played === "Boss", playedRow);
  const evRow = (r.j.lastEvents || {})[myFx.home + "|" + myFx.away];
  const goalEv = evRow ? evRow.ev.filter(e => !e.red) : [];
  ok("the sim picked a scorer for every played goal", goalEv.length === 12 && goalEv.filter(e => e.c === myFx.home).length === 7 && goalEv.filter(e => e.c === myFx.away).length === 5, goalEv.length);
  const bRow = r.j.table.find(t => t.team === "Bournemouth");
  const wantGf = myFx.home === "Bournemouth" ? 7 : 5;
  ok("the league table counts the played score", bRow && bRow.p === 1 && bRow.gf === wantGf && bRow.ga === 12 - wantGf, bRow);
  ok("every other fixture that week simmed normally", r.j.lastWeek.length === 10 && r.j.lastWeek.every(m => m.hg !== null && m.ag !== null) && r.j.lastWeek.filter(m => m.played).length === 1, r.j.lastWeek.length);
  ok("the played score is cleared after the week", r.j.myPlay === null && r.j.users.every(u => !u.play), r.j.myPlay);
  ok("the feed says the match was played live", r.j.feed.some(f => (f.text || "").startsWith("PLAYED LIVE:")), null);
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: myFx.home, away: myFx.away, hg: 2, ag: 2 });
  ok("a result for a week that is already simmed is refused", r.status === 400, r.j);
  await api("/api/unlock", { code: pc, name: "Boss" });

  // quitting mid match: kick off, never send a result, the week sims as usual
  r = await api(`/api/state?code=${pc}&name=Boss`);
  const fx2 = (r.j.playable || []).find(f => f.kind === "league");
  ok("next week my new fixture is playable again", !!fx2 && !(fx2.home === myFx.home && fx2.away === myFx.away), fx2);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
  ok("a new round gives me a new play", r.status === 200, r.j);
  await api("/api/sim", { code: pc, name: "Boss" });
  r = await api(`/api/state?code=${pc}&name=Boss`);
  const quitRow = r.j.lastWeek.find(m => m.home === fx2.home && m.away === fx2.away);
  ok("a match I left gets simmed like normal", !!quitRow && quitRow.hg !== null && !quitRow.played, quitRow);

  // the host simmed while I was mid match: my late score is thrown away and the simmed score stands
  const tableBefore = JSON.stringify(r.j.table);
  const lateH = quitRow.hg === 9 ? 8 : 9, lateA = quitRow.ag === 9 ? 8 : 9;
  r = await api("/api/playresult", { code: pc, name: "Boss", kind: "league", home: fx2.home, away: fx2.away, hg: lateH, ag: lateA });
  ok("a played result sent after the round moved on is refused", r.status === 400, r.j);
  ok("the refusal says the host has simmed this week", (r.j.error || "").includes("The host has simmed this week, your match was decided by the sim"), r.j);
  r = await api("/api/playresult", { code: pc, name: "Boss", home: fx2.home, away: fx2.away, hg: lateH, ag: lateA });
  ok("the late result is refused without a kind too", r.status === 400, r.j);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league", home: fx2.home, away: fx2.away });
  ok("a stale page cannot kick off the old fixture after the sim", r.status === 400 && (r.j.error || "").includes("The host has simmed this week"), r.j);
  r = await api(`/api/state?code=${pc}&name=Boss`);
  const stillRow = r.j.lastWeek.find(m => m.home === fx2.home && m.away === fx2.away);
  ok("the simmed score stands after the late result", !!stillRow && stillRow.hg === quitRow.hg && stillRow.ag === quitRow.ag && !stillRow.played, [quitRow, stillRow]);
  ok("the league table did not move", JSON.stringify(r.j.table) === tableBefore, null);
  ok("the refused stale kick off did not use up my play for the new week", r.j.myPlay === null, r.j.myPlay);
  ok("the simmed score is in my fixture list for the page to show", (r.j.myFixtures || []).some(m => m.week === 2 && m.home === fx2.home && m.away === fx2.away && m.hg === quitRow.hg && m.ag === quitRow.ag), null);
  saved = await readSave(pc);
  pg = Object.values(saved).find(x => x.code === pc);
  const savedRow = fixOf(pg, "Bournemouth", 1);
  ok("the saved game keeps the simmed score too", savedRow.hg === quitRow.hg && savedRow.ag === quitRow.ag && !savedRow.played, savedRow);
  ok("no late score is left waiting to leak into a later week", Object.keys(pg.plays || {}).length === 0, pg.plays);
  r = await api("/api/unlock", { code: pc, name: "Boss" });
  r = await api(`/api/state?code=${pc}&name=Boss`);
  ok("the season moved on two weeks", r.j.round === 2, r.j.round);

  // cup tie in the same week as a league game: one play per round, and the cup uses my score
  const cupFx = (r.j.playable || []).find(f => f.kind === "efl");
  ok("my EFL Cup tie is playable in its week", !!cupFx && !cupFx.blocked, r.j.playable);
  ok("my league game is offered that week too", (r.j.playable || []).some(f => f.kind === "league"), r.j.playable);
  if (cupFx) {
    r = await api("/api/playstart", { code: pc, name: "Boss", kind: "efl" });
    ok("kick off works for my cup tie", r.status === 200 && r.j.kind === "efl", r.j);
    r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
    ok("only one play per round, the league game is refused after the cup kick off", r.status === 400, r.j);
    const iAmHome = cupFx.home === "Bournemouth";
    r = await api("/api/playresult", { code: pc, name: "Boss", kind: "efl", home: cupFx.home, away: cupFx.away, hg: iAmHome ? 8 : 6, ag: iAmHome ? 6 : 8 });
    ok("a valid cup result is accepted", r.status === 200, r.j);
    await api("/api/sim", { code: pc, name: "Boss" });
    saved = await readSave(pc);
    pg = Object.values(saved).find(x => x.code === pc);
    const tie = pg.cups.efl.rounds[0].find(m => m.home === cupFx.home && m.away === cupFx.away);
    ok("the cup tie shows exactly my submitted score", !!tie && tie.hg === (iAmHome ? 8 : 6) && tie.ag === (iAmHome ? 6 : 8), tie);
    ok("I go through after winning the played cup tie", !!tie && tie.winner === "Bournemouth" && !tie.pens, tie);
    const lg3 = fixOf(pg, "Bournemouth", 2);
    ok("my league game that week simmed normally", lg3.hg !== null && !lg3.played, lg3);
    ok("stored plays are wiped after the week", Object.keys(pg.plays || {}).length === 0, pg.plays);
    r = await api("/api/playresult", { code: pc, name: "Boss", kind: "efl", home: cupFx.home, away: cupFx.away, hg: 0, ag: 0 });
    ok("a late cup result after the sim is refused with the host has simmed message", r.status === 400 && (r.j.error || "").includes("The host has simmed this week"), r.j);
    saved = await readSave(pc);
    pg = Object.values(saved).find(x => x.code === pc);
    const tie2 = pg.cups.efl.rounds[0].find(m => m.home === cupFx.home && m.away === cupFx.away);
    ok("the cup score stands after the late result", tie2.hg === tie.hg && tie2.ag === tie.ag && tie2.winner === "Bournemouth", tie2);
  }

  // manager against manager is never playable
  r = await api(`/api/state?code=${pc}&name=Boss`);
  ok("the season is on week four", r.j.round === 3, r.j.round);
  const h2h = (r.j.playable || []).find(f => f.kind === "league");
  ok("a fixture against another manager is marked as sim only", !!h2h && !!h2h.blocked && (h2h.home === mateClub || h2h.away === mateClub), h2h);
  r = await api("/api/playstart", { code: pc, name: "Boss", kind: "league" });
  ok("kick off against another manager is refused", r.status === 400 && (r.j.error || "").includes("another manager"), r.j);
  r = await api("/api/sim", { code: pc, name: "Boss" });
  ok("the week still sims fine after all that", r.status === 200, r.j);

  console.log(passed + " passed, " + failed + " failed");
  server.kill();
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.log("CRASH", e); process.exit(1); });
