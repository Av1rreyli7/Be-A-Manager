const express = require("express");
const fs = require("fs");
const path = require("path");
const { buildDatabase, marketValue } = require("./players");
const { NATIONS, LEAGUES, DOMESTIC_CUPS, ACADEMY_NAMES } = require("./world_pack");
const C = require("./condition");
const { EVENTS } = require("./events_data");
const { TRAVEL } = require("./travel_data");

// Floodlights is a router so the combined site server can mount it next to Next.js.
// The game page lives at /floodlights/ and the API stays at /api/...
// Run this file by itself (node floodlights/server.js) and it boots a small standalone server.
const app = express.Router();
// JSON bodies are only read for Floodlights' own API paths (the set is filled at the foot of this
// file). Everything else is left untouched so Next.js can read the body of its own routes.
const jsonBody = express.json();
const ownApi = new Set();
app.use((req, res, next) => (ownApi.has(req.path) ? jsonBody(req, res, next) : next()));
app.get("/floodlights", (req, res, next) => {
  // the page loads its scripts with relative paths, so it needs the trailing slash
  if (req.originalUrl.split("?")[0].endsWith("/")) return next();
  res.redirect(308, "/floodlights/");
});
app.get("/floodlights/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
// the playable match engine, loaded by index.html
app.get("/floodlights/match.js", (req, res) => {
  res.sendFile(path.join(__dirname, "match.js"));
});
// the 3D look for the playable match, loaded only when a manager picks 3D
app.get("/floodlights/match3d.mjs", (req, res) => {
  res.type("text/javascript");
  res.sendFile(path.join(__dirname, "match3d.mjs"));
});
// the deep sim behind the 3D look, fetched together with the view
app.get("/floodlights/match_sim3d.mjs", (req, res) => {
  res.type("text/javascript");
  res.sendFile(path.join(__dirname, "match_sim3d.mjs"));
});
// three.js for the 3D match, straight from the installed package
const THREE_BUILD = path.dirname(require.resolve("three"));
for (const f of ["three.module.js", "three.core.js"]) {
  app.get("/floodlights/vendor/" + f, (req, res) => {
    res.type("text/javascript");
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(path.join(THREE_BUILD, f));
  });
}
// the shared fonts (Inter and Chakra Petch), the same files the landing page uses
app.use("/floodlights/fonts", express.static(path.join(__dirname, "fonts"), { maxAge: "7d" }));

const SAVE_FILE = path.join(__dirname, "games.json");
let games = {};
try { games = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8")); } catch (e) { games = {}; }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(SAVE_FILE, JSON.stringify(games), () => {});
  }, 500);
}

const BIG_CLUBS = ["Man City", "Liverpool", "Arsenal", "Chelsea", "Man United", "Tottenham", "Newcastle",
  "Real Madrid", "Barcelona", "Atletico Madrid", "Bayern Munich", "Borussia Dortmund", "PSG",
  "Juventus", "Inter Milan", "AC Milan", "Napoli", "Al-Hilal", "Al-Nassr", "Al-Ittihad"];
const TACTICS = ["attacking", "balanced", "defensive"];
const PLAYABLE = Object.keys(LEAGUES).filter(l => LEAGUES[l].playable);
const TOTAL_ROUNDS = 38;

// UEFA access list, 2026-27 rules. England and Spain hold the two European
// Performance Spots so they send five each. France sends three, the Netherlands
// two, and the champions of Portugal, Belgium, Turkey and Scotland all go
// straight into the Champions League. Title holders of the Champions League and
// Europa League parachute into the next Champions League if their league
// position missed it, and the Conference League winner does the same for the
// Europa League.
const UCL_SLOTS = [
  ["Premier League", 5], ["La Liga", 5], ["Serie A", 4], ["Bundesliga", 4],
  ["Ligue 1", 3], ["Eredivisie", 2], ["Primeira Liga", 1], ["Belgian Pro League", 1],
  ["Super Lig", 1], ["Scottish Premiership", 1]
];
const UEL_SLOTS = [
  ["Premier League", 2], ["La Liga", 2], ["Serie A", 2], ["Bundesliga", 2],
  ["Ligue 1", 2], ["Eredivisie", 1], ["Primeira Liga", 1], ["Belgian Pro League", 1],
  ["Super Lig", 1], ["Scottish Premiership", 1]
];
const UECL_SLOTS = [
  ["Premier League", 2], ["La Liga", 2], ["Serie A", 2], ["Bundesliga", 2],
  ["Ligue 1", 1], ["Eredivisie", 1], ["Primeira Liga", 1], ["Belgian Pro League", 1],
  ["Super Lig", 1], ["Scottish Premiership", 1]
];
const EURO_OVERFLOW = [
  ["Primeira Liga", 1], ["Super Lig", 1], ["Eredivisie", 2], ["Belgian Pro League", 1],
  ["Ligue 1", 3], ["Serie A", 4], ["Bundesliga", 4], ["Scottish Premiership", 1],
  ["Premier League", 5], ["La Liga", 5], ["Ligue 1", 4], ["Serie A", 5],
  ["Bundesliga", 5], ["Premier League", 6], ["La Liga", 6], ["Eredivisie", 3],
  ["Primeira Liga", 2], ["Super Lig", 2], ["Belgian Pro League", 2], ["Scottish Premiership", 2]
];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_"); }

function clubStrength(game, teamName) {
  const xi = bestXI(game, teamName);
  return xi.reduce((s, p) => s + p.rating, 0) / (xi.length || 1);
}

// ---------- cups ----------
function pairUp(teams) {
  return teams.reduce((acc, t, i) => {
    if (i % 2 === 0) acc.push({ home: t, away: null, hg: null, ag: null, pens: false, winner: null });
    else acc[acc.length - 1].away = t;
    return acc;
  }, []);
}

function nameForMatches(matchCount) {
  return matchCount >= 16 ? "Round of 32" : matchCount === 8 ? "Round of 16" : matchCount === 4 ? "Quarter-finals" : matchCount === 2 ? "Semi-finals" : matchCount === 1 ? "Final" : "First round";
}

// Any entrant count works: extra teams get first round byes down to a power of two bracket.
function makeCup(key, title, weeks, teams, prizes, scope) {
  const t = shuffle([...teams]);
  let pow = 1;
  while (pow * 2 <= t.length) pow *= 2;
  const tieTeams = (t.length - pow) * 2;
  const inRound1 = tieTeams > 0 ? t.slice(0, tieTeams) : t;
  const byes = tieTeams > 0 ? t.slice(tieTeams) : [];
  const round1 = pairUp(inRound1);
  return {
    key, title, weeks, scope: scope || "club",
    prizeWin: prizes.win, prizeTrophy: prizes.trophy,
    roundIdx: 0, rounds: [round1],
    roundNames: [tieTeams > 0 ? "First round" : nameForMatches(round1.length)],
    byes, winner: null
  };
}

function leagueClubs(game, league) {
  return Object.values(game.clubs).filter(c => c.league === league).map(c => c.name);
}

function rankedByStrength(game, league) {
  return leagueClubs(game, league).sort((a, b) => clubStrength(game, b) - clubStrength(game, a));
}

// Uses last season's tables when they exist, squad strength in season one.
function buildEuroFields(game) {
  const order = {};
  const cursor = {};
  const euroLeagues = Object.keys(LEAGUES).filter(l => LEAGUES[l].euro);
  for (const l of euroLeagues) {
    order[l] = (game.lastTables && game.lastTables[l]) ? game.lastTables[l] : rankedByStrength(game, l);
    cursor[l] = 0;
  }
  const taken = new Set();
  const grab = (league, n, into) => {
    let added = 0;
    while (added < n && cursor[league] < (order[league] || []).length) {
      const team = order[league][cursor[league]++];
      if (taken.has(team)) continue;
      taken.add(team); into.push(team); added++;
    }
  };
  const ucl = [], uel = [], uecl = [];
  // title holders parachute in first, following the real rules
  const lastSeason = (game.history || [])[Math.max(0, (game.history || []).length - 1)];
  const holders = [];
  if (lastSeason && lastSeason.cupWinners) {
    const uclWin = (lastSeason.cupWinners.ucl || {}).winner;
    const uelWin = (lastSeason.cupWinners.uel || {}).winner;
    const ueclWin = (lastSeason.cupWinners.uecl || {}).winner;
    for (const w of [uclWin, uelWin]) {
      if (w && game.clubs[w] && LEAGUES[game.clubs[w].league] && LEAGUES[game.clubs[w].league].euro && !taken.has(w)) {
        taken.add(w); ucl.push(w); holders.push(w);
      }
    }
    if (ueclWin && game.clubs[ueclWin] && LEAGUES[game.clubs[ueclWin].league] && LEAGUES[game.clubs[ueclWin].league].euro && !taken.has(ueclWin)) {
      taken.add(ueclWin); uel.push(ueclWin); holders.push(ueclWin);
    }
  }
  for (const [league, n] of UCL_SLOTS) grab(league, n, ucl);
  let oi = 0;
  while (ucl.length < 32 && oi < EURO_OVERFLOW.length) { grab(EURO_OVERFLOW[oi][0], EURO_OVERFLOW[oi][1], ucl); oi++; }
  while (ucl.length < 32) { for (const l of euroLeagues) { if (ucl.length >= 32) break; grab(l, 1, ucl); } }
  for (const [league, n] of UEL_SLOTS) grab(league, n, uel);
  oi = 0;
  while (uel.length < 16 && oi < EURO_OVERFLOW.length) { grab(EURO_OVERFLOW[oi][0], 1, uel); oi++; }
  for (const [league, n] of UECL_SLOTS) grab(league, n, uecl);
  oi = 0;
  while (uecl.length < 16 && oi < EURO_OVERFLOW.length) { grab(EURO_OVERFLOW[oi][0], 1, uecl); oi++; }
  return { ucl: ucl.slice(0, 32), uel: uel.slice(0, 16), uecl: uecl.slice(0, 16), holders };
}

function makeAllCups(game) {
  const cups = {};
  cups.efl = makeCup("efl", "EFL Cup", [3, 9, 15, 21, 26], [...leagueClubs(game, "Premier League"), ...shuffle(leagueClubs(game, "Championship")).slice(0, 12)], { win: 1, trophy: 10 });
  cups.fa = makeCup("fa", "FA Cup", [5, 12, 18, 25, 32], [...leagueClubs(game, "Premier League"), ...shuffle(leagueClubs(game, "Championship")).slice(0, 12)], { win: 2, trophy: 20 });
  for (const league of PLAYABLE) {
    if (league === "Premier League") continue;
    const meta = LEAGUES[league];
    const entrants = [...leagueClubs(game, league), ...(meta.second ? leagueClubs(game, meta.second) : [])];
    const big = entrants.length > 16;
    cups["cup_" + slug(league)] = makeCup(
      "cup_" + slug(league), DOMESTIC_CUPS[league] || (league + " Cup"),
      big ? [4, 11, 17, 24, 33] : [6, 13, 20, 28],
      entrants, big ? { win: 2, trophy: 15 } : { win: 1, trophy: 8 }
    );
  }
  const euro = buildEuroFields(game);
  cups.ucl = makeCup("ucl", "Champions League", [6, 12, 18, 24, 31], euro.ucl, { win: 6, trophy: 50 });
  cups.uel = makeCup("uel", "Europa League", [7, 15, 23, 30], euro.uel, { win: 3, trophy: 25 });
  cups.uecl = makeCup("uecl", "Conference League", [6, 14, 22, 29], euro.uecl, { win: 2, trophy: 12 });
  if (euro.holders.length) log(game, "EUROPEAN NIGHTS: " + euro.holders.join(" and ") + " parachute into Europe as title holders under UEFA rules. 32 clubs enter the Champions League, the Turkish champions among them.");
  const brTop = (game.lastTables && game.lastTables["Brasileirao"]) ? game.lastTables["Brasileirao"].slice(0, 4) : rankedByStrength(game, "Brasileirao").slice(0, 4);
  const arTop = (game.lastTables && game.lastTables["Argentina"]) ? game.lastTables["Argentina"].slice(0, 4) : rankedByStrength(game, "Argentina").slice(0, 4);
  cups.libertadores = makeCup("libertadores", "Copa Libertadores", [10, 19, 29], [...brTop, ...arTop], { win: 2, trophy: 15 });
  if (game.nations && Object.keys(game.nations).length >= 4) {
    const worldCup = game.season % 4 === 0;
    cups.intl = makeCup("intl", worldCup ? "World Cup" : "International Cup", [11, 18, 26, 34], Object.keys(game.nations), { win: 0, trophy: 0 }, "intl");
    if (worldCup) log(game, `SEASON ${game.season} IS A WORLD CUP SEASON! Every nation is in. The final falls on week 34.`);
  }
  return cups;
}

function humanInvolved(game, teams) {
  return teams.some(t => humanOf(game, t) || (game.nations && game.nations[t] && game.nations[t].manager));
}

function sideManager(game, team) {
  const hu = humanOf(game, team);
  if (hu) return hu.name;
  const n = (game.nations || {})[team];
  return n && n.manager ? n.manager : null;
}

// a tie went to pens with a real manager involved: park it and let them shoot
function startShootout(game, cup, m) {
  game.shootouts = game.shootouts || {};
  const key = cup.key + "|" + m.home + "|" + m.away;
  game.shootouts[key] = {
    key, cupKey: cup.key, cupTitle: cup.title, home: m.home, away: m.away,
    hScore: 0, aScore: 0, kickNum: 0, phase: "shoot",
    kicker: "home", pendingShot: null, kicks: [], done: false,
    hMgr: sideManager(game, m.home), aMgr: sideManager(game, m.away)
  };
  m.pensPending = true;
  log(game, `${cup.title}: ${m.home} ${m.hg}-${m.ag} ${m.away} after normal time. PENALTIES! The managers walk to the technical area.`);
  romano(game, `\u26a0\ufe0f ${m.home} v ${m.away} in the ${cup.title} is going to PENALTIES. Nobody breathe.`);
}

function shootoutWinnerDecided(so) {
  // best of five: decided when one side cannot catch the other, then sudden death pairs
  const hTaken = Math.ceil(so.kickNum / 2);
  const aTaken = Math.floor(so.kickNum / 2);
  if (so.kickNum <= 10) {
    if (so.hScore > so.aScore + (5 - aTaken)) return so.home;
    if (so.aScore > so.hScore + (5 - hTaken)) return so.away;
    if (so.kickNum === 10 && so.hScore !== so.aScore) return so.hScore > so.aScore ? so.home : so.away;
  } else if (so.kickNum % 2 === 0 && so.hScore !== so.aScore) {
    return so.hScore > so.aScore ? so.home : so.away;
  }
  return null;
}

function finishShootout(game, so, winner) {
  so.done = true;
  so.winner = winner;
  const cup = (game.cups || {})[so.cupKey];
  if (cup) {
    for (const round of cup.rounds) {
      const m = round.find(x => x.home === so.home && x.away === so.away && x.pensPending);
      if (m) { m.pensPending = false; m.pens = true; m.winner = winner; break; }
    }
  }
  log(game, `${so.cupTitle}: ${winner} win the shootout ${so.hScore}-${so.aScore} against ${winner === so.home ? so.away : so.home}!`);
  romano(game, `\ud83e\udde4 Drama over: ${winner} hold their nerve and win on penalties ${so.hScore}-${so.aScore}. Heartbreak for ${winner === so.home ? so.away : so.home}.`);
  advanceReadyCups(game);
}

// one kick: shooter direction against keeper direction, ratings nudge the odds
function resolveKick(game, so, shotDir, diveDir) {
  const team = so.kicker === "home" ? so.home : so.away;
  const other = so.kicker === "home" ? so.away : so.home;
  const xi = game.nations && game.nations[team] ? nationXI(game, team) : chosenXI(game, team);
  const kickerIdx = Math.floor(so.kickNum / 2) % Math.max(1, xi.length);
  const taker = [...xi].sort((a, b) => b.rating - a.rating)[kickerIdx] || xi[0];
  const oxi = game.nations && game.nations[other] ? nationXI(game, other) : chosenXI(game, other);
  const gk = oxi.find(p => p.pos === "GK");
  let goal;
  if (Math.random() < 0.04) goal = false;
  else if (diveDir === shotDir) {
    let saveP = 0.62 + ((gk ? gk.rating : 75) - (taker ? taker.rating : 75)) * 0.004;
    saveP = Math.max(0.35, Math.min(0.85, saveP));
    goal = Math.random() >= saveP;
  } else goal = Math.random() < 0.94;
  so.kickNum++;
  if (goal) { if (so.kicker === "home") so.hScore++; else so.aScore++; }
  so.kicks.push({ team, taker: taker ? taker.name : team, dir: shotDir, dive: diveDir, goal });
  so.kicker = so.kicker === "home" ? "away" : "home";
  so.phase = "shoot";
  so.pendingShot = null;
  const winner = shootoutWinnerDecided(so);
  if (winner) finishShootout(game, so, winner);
}

function aiDir() { return ["left", "center", "right"][Math.floor(Math.random() * 3)]; }

// AI takes over any part of the shootout no human owns; runs until a human must act
function autoAdvanceShootout(game, so) {
  let guard = 0;
  while (!so.done && guard++ < 60) {
    const kickTeam = so.kicker === "home" ? so.home : so.away;
    const saveTeam = so.kicker === "home" ? so.away : so.home;
    const kickMgr = so.kicker === "home" ? so.hMgr : so.aMgr;
    const saveMgr = so.kicker === "home" ? so.aMgr : so.hMgr;
    if (so.phase === "shoot") {
      if (kickMgr) return;
      so.pendingShot = aiDir();
      so.phase = "save";
    } else {
      if (saveMgr) return;
      resolveKick(game, so, so.pendingShot, aiDir());
    }
  }
  if (!so.done && guard >= 60) {
    const winner = so.hScore >= so.aScore ? so.home : so.away;
    finishShootout(game, so, winner);
  }
}

// any shootout still hanging when the next matchweek sims gets settled the old way
function settleStaleShootouts(game) {
  for (const so of Object.values(game.shootouts || {})) {
    if (so.done) continue;
    const A = strengths(game, so.home), B = strengths(game, so.away);
    const pA = (A.att + A.def) / (A.att + A.def + B.att + B.def);
    while (!shootoutWinnerDecided(so) && so.kickNum < 40) {
      const goal = Math.random() < (so.kicker === "home" ? 0.5 + (pA - 0.5) * 0.4 : 0.5 - (pA - 0.5) * 0.4) + 0.26;
      so.kickNum++;
      if (goal) { if (so.kicker === "home") so.hScore++; else so.aScore++; }
      so.kicks.push({ team: so.kicker === "home" ? so.home : so.away, taker: "", dir: "", dive: "", goal });
      so.kicker = so.kicker === "home" ? "away" : "home";
    }
    finishShootout(game, so, shootoutWinnerDecided(so) || (Math.random() < pA ? so.home : so.away));
  }
  game.shootouts = {};
}

// cups advance once every tie in the current round has a winner
function advanceReadyCups(game) {
  if (!game.cups) return;
  for (const cup of Object.values(game.cups)) {
    if (cup.winner) continue;
    const matches = cup.rounds[cup.roundIdx];
    if (!matches || !matches.length) continue;
    if (matches.some(m => m.hg === null || !m.winner)) continue;
    const winners = matches.map(m => m.winner);
    const pool = [...winners, ...(cup.byes || [])];
    cup.byes = [];
    if (pool.length === 1) {
      cup.winner = pool[0];
      const wc = game.clubs[cup.winner];
      if (wc) {
        wc.budget = Math.round((wc.budget + 5) * 10) / 10;
        log(game, `${cup.title}: ${cup.winner} lift the trophy and bank £5m!`);
      } else {
        log(game, `${cup.title}: ${cup.winner} lift the trophy!`);
      }
    } else {
      cup.roundIdx++;
      cup.rounds.push(pairUp(shuffle(pool)));
      cup.roundNames = cup.roundNames || [];
      cup.roundNames.push(nameForMatches(pool.length / 2));
    }
  }
}

function simCupsForWeek(game) {
  if (!game.cups) return;
  settleStaleShootouts(game);
  for (const cup of Object.values(game.cups)) {
    if (cup.winner) continue;
    if (cup.weeks[cup.roundIdx] !== game.round) continue;
    const matches = cup.rounds[cup.roundIdx];
    for (const m of matches) {
      const xis = simMatch(game, m, cup.key, game.round - 1);
      // the league week already moved the round on, so a played cup tie was stored one round back
      usePlayedScore(game, m, cup.key, game.round - 1);
      afterResult(game, m, xis, cup.key);
      if (humanInvolved(game, [m.home, m.away]) || matches.length === 1) cupEvents(game, m);
      if (m.hg === m.ag) {
        // level after ninety: human managers take the penalties themselves,
        // AI only ties resolve with the exact same odds as before
        if (sideManager(game, m.home) || sideManager(game, m.away)) {
          const cupRef = cup;
          startShootout(game, cupRef, m);
          const so = game.shootouts[cupRef.key + "|" + m.home + "|" + m.away];
          autoAdvanceShootout(game, so);
          continue;
        }
        m.pens = true;
        const A = strengths(game, m.home), B = strengths(game, m.away);
        const pA = (A.att + A.def) / (A.att + A.def + B.att + B.def);
        m.winner = Math.random() < pA ? m.home : m.away;
      } else {
        m.winner = m.hg > m.ag ? m.home : m.away;
      }
    }
    const rn = (cup.roundNames && cup.roundNames[cup.roundIdx]) || nameForMatches(matches.length);
    const involved = matches.some(m => humanInvolved(game, [m.home, m.away]));
    if (involved || matches.length === 1) {
      log(game, `${cup.title.toUpperCase()} ${rn.toUpperCase()}: ` + matches.map(m => `${m.home} ${m.hg}-${m.ag}${m.pensPending ? " (pens in progress)" : m.pens ? " (pens: " + m.winner + ")" : ""} ${m.away}`).join(" | "));
    }
  }
  advanceReadyCups(game);
}

function code4() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return games[c] ? code4() : c;
}

function poisson(lambda) {
  let l = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > l);
  return k - 1;
}

// ---------- fixtures: double round robin, works for any even team count ----------
function makeFixtures(teamNames) {
  const teams = [...teamNames];
  const n = teams.length;
  const rounds = [];
  const arr = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    const a = [teams[0], ...arr];
    for (let i = 0; i < n / 2; i++) {
      const home = a[i], away = a[n - 1 - i];
      if (r % 2 === 0) round.push({ home, away });
      else round.push({ home: away, away: home });
    }
    rounds.push(round);
    arr.push(arr.shift());
  }
  const second = rounds.map(r => r.map(m => ({ home: m.away, away: m.home })));
  return [...rounds, ...second].map(r => r.map(m => ({ ...m, hg: null, ag: null })));
}

// ---------- team strength ----------
function avail(p) { return p && !(p.inj > 0) && !(p.ban > 0); }

// detailed positions: GK, RB CB LB, CDM CM CAM, RW ST LW
const ROLE_POOL = {
  GK: ["GK"],
  DF: ["RB", "CB", "CB", "CB", "LB"],
  MF: ["CDM", "CM", "CM", "CAM"],
  FW: ["RW", "ST", "ST", "LW"]
};
// real players get the position they actually play in real life
const ROLE_GROUP = { GK: "GK", RB: "DF", CB: "DF", LB: "DF", CDM: "MF", CM: "MF", CAM: "MF", RW: "FW", ST: "FW", LW: "FW" };
const RIVALRIES = [
  ["Man United", "Man City"], ["Man United", "Liverpool"], ["Liverpool", "Everton"],
  ["Arsenal", "Tottenham"], ["Chelsea", "Tottenham"], ["Chelsea", "Arsenal"],
  ["Newcastle", "Sunderland"], ["Aston Villa", "Birmingham"], ["West Ham", "Tottenham"],
  ["Leeds United", "Man United"],
  ["Real Madrid", "Barcelona"], ["Real Madrid", "Atletico Madrid"], ["Barcelona", "Espanyol"],
  ["Sevilla", "Real Betis"],
  ["Inter Milan", "AC Milan"], ["Roma", "Lazio"], ["Juventus", "Inter Milan"], ["Juventus", "Torino"],
  ["Bayern Munich", "Borussia Dortmund"], ["Borussia Dortmund", "Schalke"], ["Hamburg", "Werder Bremen"],
  ["PSG", "Marseille"], ["Lyon", "Saint-Etienne"],
  ["Benfica", "Porto"], ["Benfica", "Sporting CP"], ["Porto", "Sporting CP"],
  ["Celtic", "Rangers"], ["Ajax", "Feyenoord"], ["Ajax", "PSV"],
  ["Boca Juniors", "River Plate"],
  ["Galatasaray", "Fenerbahce"], ["Galatasaray", "Besiktas"], ["Fenerbahce", "Besiktas"],
  ["Al-Hilal", "Al-Nassr"]
];
const RIVAL_SET = new Set(RIVALRIES.map(([a, b]) => a + "|" + b).concat(RIVALRIES.map(([a, b]) => b + "|" + a)));
function isDerby(home, away) { return RIVAL_SET.has(home + "|" + away); }

const PRODIGIES = new Set(["JJ Gabriel"]);

const ROLE_RANK = { "Prospect": 0, "Rotation": 1, "First team": 2, "Star": 3 };
const SQUAD_ROLES = ["Prospect", "Rotation", "First team", "Star"];
function defaultWage(p) { return Math.max(0.1, Math.round(p.value * 0.04 * 10) / 10); }
function defaultRole(p) {
  if (p.rating >= 86) return "Star";
  if (p.rating >= 78) return "First team";
  return p.age <= 20 ? "Prospect" : "Rotation";
}
function giveDefaultContract(p) {
  p.contractYears = (p.age <= 23 ? 3 : p.age <= 29 ? 2 : 1) + Math.floor(Math.random() * 2);
  p.wage = defaultWage(p);
  p.squadRole = defaultRole(p);
}
function signedThisWeek(game, user) {
  return !!(user.signings && user.signings.week === game.round && user.signings.count >= 1);
}
function markSigning(game, user) {
  user.signings = { week: game.round, count: 1 };
}

function completeSigning(game, offer, p) {
  const buyer = game.users[offer.buyerUser];
  if (buyer && signedThisWeek(game, buyer)) {
    offer.status = "failed";
    offer.note = `You already completed a signing this week. One signing per week, come back for ${p.name} after the matchweek.`;
    return;
  }
  const r = doTransfer(game, offer);
  if (r.ok) {
    if (buyer) markSigning(game, buyer);
    giveDefaultContract(p);
    offer.status = "accepted";
    offer.note = `Fee agreed and the deal is done. ${p.name} is a ${offer.toClub} player. No wage talk, he just wanted the move.`;
    romano(game, `🚨✅ HERE WE GO! ${p.name} to ${offer.toClub}, confirmed! ${fmtFee(offer.fee)} to ${offer.sellerClub}. Deal completed the same day, no personal terms drama.`);
  } else {
    offer.status = "failed";
    offer.note = r.msg;
  }
}

const ROLE_LABELS = {
  GK: "Goalkeeper", RB: "Right Back", CB: "Centre Back", LB: "Left Back",
  CDM: "Defensive Midfielder", CM: "Central Midfielder", CAM: "Attacking Midfielder",
  RW: "Right Winger", ST: "Striker", LW: "Left Winger",
  DF: "Defender", MF: "Midfielder", FW: "Forward"
};

const REAL_LOANS = {
  "Andre Onana": "Man United",
  "Omar Marmoush": "Man City",
  "Alejandro Garnacho": "Chelsea",
  "Ronald Araujo": "Barcelona",
  "Jack Grealish": "Man City",
  "Evann Guessand": "Crystal Palace",
  "Robert Sanchez": "Chelsea",
  "Mamadou Sarr": "Chelsea",
  "Axel Disasi": "Chelsea",
  "Benoit Badiashile": "Chelsea",
  "Ethan Nwaneri": "Arsenal",
  "Mykhailo Mudryk": "Chelsea"
};
const REAL_ROLES = {
  "JJ Gabriel": "ST",
  "Gabriel Jesus": "ST", "Carlos Espi": "ST", "Ismael Saibari": "CAM", "Nathaniel Brown": "LB",
  "Denzel Dumfries": "RB", "Marc Guehi": "CB", "Tosin Adarabioyo": "CB", "Joel Veltman": "RB",
  "Conor Gallagher": "CM", "Ademola Lookman": "LW", "Oscar Bobb": "RW", "Ainsley Maitland-Niles": "CM",
  "Erling Haaland": "ST", "Kylian Mbappe": "ST", "Harry Kane": "ST", "Ousmane Dembele": "ST", "Alexander Isak": "ST",
  "Viktor Gyokeres": "ST", "Victor Osimhen": "ST", "Julian Alvarez": "ST", "Lautaro Martinez": "ST", "Robert Lewandowski": "ST",
  "Dusan Vlahovic": "ST", "Hugo Ekitike": "ST", "Benjamin Sesko": "ST", "Ollie Watkins": "ST", "Jean-Philippe Mateta": "ST",
  "Randal Kolo Muani": "ST", "Goncalo Ramos": "ST", "Vangelis Pavlidis": "ST", "Serhou Guirassy": "ST", "Rasmus Hojlund": "ST",
  "Romelu Lukaku": "ST", "Darwin Nunez": "ST", "Ivan Toney": "ST", "Jonathan David": "ST", "Moise Kean": "ST",
  "Mateo Retegui": "ST", "Lois Openda": "ST", "Alexander Sorloth": "ST", "Dominic Solanke": "ST", "Jorgen Strand Larsen": "ST",
  "Nick Woltemade": "ST", "Samu Aghehowa": "ST", "Marcus Thuram": "ST", "Patrik Schick": "ST", "Yoane Wissa": "ST",
  "Igor Thiago": "ST", "Evanilson": "ST", "Joao Pedro": "ST", "Cristiano Ronaldo": "ST", "Karim Benzema": "ST",
  "Antoine Griezmann": "ST", "Kai Havertz": "ST", "Ferran Torres": "ST", "Georges Mikautadze": "ST", "Oyarzabal": "ST",
  "Matheus Cunha": "ST", "Charles De Ketelaere": "ST", "Christopher Nkunku": "ST", "Joao Felix": "ST", "Gabriel Jesus": "ST",
  "Georginio Rutter": "ST", "Loïs Openda": "ST", "Omar Marmoush": "ST", "Jonathan Burkardt": "ST", "Tolu Arokodare": "ST",
  "Lamine Yamal": "RW", "Bukayo Saka": "RW", "Mohamed Salah": "RW", "Michael Olise": "RW", "Rodrygo": "RW",
  "Cole Palmer": "RW", "Desire Doue": "RW", "Lionel Messi": "RW", "Takefusa Kubo": "RW", "Jarrod Bowen": "RW",
  "Noni Madueke": "RW", "Pedro Neto": "RW", "Estevao": "RW", "Amad Diallo": "RW", "Mohammed Kudus": "RW",
  "Antony": "RW", "Moussa Diaby": "RW", "Bryan Mbeumo": "RW", "Savinho": "RW", "Anthony Elanga": "RW",
  "Brahim Diaz": "RW", "Giuliano Simeone": "RW", "Paulo Dybala": "RW", "Christian Pulisic": "RW", "Leroy Sane": "RW",
  "David Neres": "RW", "Matias Soule": "RW", "Francisco Conceicao": "RW", "Riccardo Orsolini": "RW", "Ismaila Sarr": "RW",
  "Brennan Johnson": "RW", "Yankuba Minteh": "RW", "Franco Mastantuono": "RW", "Inaki Williams": "RW", "Mason Greenwood": "RW",
  "Maghnes Akliouche": "RW", "Dango Ouattara": "RW", "Raheem Sterling": "RW",
  "Vinicius Junior": "LW", "Raphinha": "LW", "Khvicha Kvaratskhelia": "LW", "Nico Williams": "LW", "Rafael Leao": "LW",
  "Luis Diaz": "LW", "Bradley Barcola": "LW", "Cody Gakpo": "LW", "Gabriel Martinelli": "LW", "Eberechi Eze": "LW",
  "Jeremy Doku": "LW", "Kaoru Mitoma": "LW", "Anthony Gordon": "LW", "Son Heung-min": "LW", "Ademola Lookman": "LW",
  "Alejandro Garnacho": "LW", "Jack Grealish": "LW", "Marcus Rashford": "LW", "Kenan Yildiz": "LW", "Kingsley Coman": "LW",
  "Karim Adeyemi": "LW", "Noa Lang": "LW", "Igor Paixao": "LW", "Jamie Gittens": "LW", "Harvey Barnes": "LW",
  "Iliman Ndiaye": "LW", "Malick Fofana": "LW", "Leandro Trossard": "LW", "Antoine Semenyo": "LW", "Nicolas Gonzalez": "LW",
  "Kevin Schade": "LW", "Neymar": "LW", "Justin Kluivert": "LW", "Donyell Malen": "LW",
  "Rodri": "CDM", "Declan Rice": "CDM", "Martin Zubimendi": "CDM", "Moises Caicedo": "CDM", "Aurelien Tchouameni": "CDM",
  "Ryan Gravenberch": "CDM", "Joshua Kimmich": "CDM", "Hakan Calhanoglu": "CDM", "Casemiro": "CDM", "Joao Palhinha": "CDM",
  "Boubacar Kamara": "CDM", "Stanislav Lobotka": "CDM", "Amadou Onana": "CDM", "Carlos Baleba": "CDM", "Romeo Lavia": "CDM",
  "Adam Wharton": "CDM", "Ruben Neves": "CDM", "Morten Hjulmand": "CDM", "Alan Varela": "CDM", "Denis Zakaria": "CDM",
  "Pierre-Emile Hojbjerg": "CDM", "N'Golo Kante": "CDM", "Marc Casado": "CDM", "Manuel Locatelli": "CDM", "Samuele Ricci": "CDM",
  "Wilfred Ndidi": "CDM", "Angelo Stiller": "CDM", "Aleksandar Pavlovic": "CDM", "Wataru Endo": "CDM",
  "Pedri": "CM", "Vitinha": "CM", "Federico Valverde": "CM", "Alexis Mac Allister": "CM", "Nicolo Barella": "CM",
  "Enzo Fernandez": "CM", "Bruno Guimaraes": "CM", "Sandro Tonali": "CM", "Joao Neves": "CM", "Frenkie de Jong": "CM",
  "Eduardo Camavinga": "CM", "Fabian Ruiz": "CM", "Youri Tielemans": "CM", "Mikel Merino": "CM", "John McGinn": "CM",
  "Tijjani Reijnders": "CM", "Scott McTominay": "CM", "Bernardo Silva": "CM", "Luka Modric": "CM", "Rodrigo Bentancur": "CM",
  "Pape Matar Sarr": "CM", "Mateo Kovacic": "CM", "Kobbie Mainoo": "CM", "Curtis Jones": "CM", "Adrien Rabiot": "CM",
  "Khephren Thuram": "CM", "Elliot Anderson": "CM", "Joelinton": "CM", "Manu Kone": "CM", "Exequiel Palacios": "CM",
  "Frank Anguissa": "CM", "Granit Xhaka": "CM", "Joao Gomes": "CM", "Warren Zaire-Emery": "CM", "Rodrigo De Paul": "CM",
  "Javi Guerra": "CM", "Davide Frattesi": "CM", "Youssouf Fofana": "CM", "Aleix Garcia": "CM", "Conor Gallagher": "CM",
  "Ederson": "CM", "Orkun Kokcu": "CM", "Joey Veerman": "CM", "Gavi": "CM", "Pablo Barrios": "CM", "Hugo Larsson": "CM",
  "Nico Gonzalez": "CM", "Teun Koopmeiners": "CM", "Pedro Goncalves": "CAM",
  "Jude Bellingham": "CAM", "Florian Wirtz": "CAM", "Martin Odegaard": "CAM", "Bruno Fernandes": "CAM", "Kevin De Bruyne": "CAM",
  "Phil Foden": "CAM", "Dominik Szoboszlai": "CAM", "Dani Olmo": "CAM", "James Maddison": "CAM", "Rayan Cherki": "CAM",
  "Arda Guler": "CAM", "Nico Paz": "CAM", "Xavi Simons": "CAM", "Thiago Almada": "CAM", "Lucas Paqueta": "CAM",
  "Fermin Lopez": "CAM", "Oihan Sancet": "CAM", "Alex Baena": "CAM", "Mikkel Damsgaard": "CAM", "Giovani Lo Celso": "CAM",
  "Emiliano Buendia": "CAM", "Kang-in Lee": "CAM",
  "Achraf Hakimi": "RB", "Trent Alexander-Arnold": "RB", "Jules Kounde": "RB", "Reece James": "RB", "Jeremie Frimpong": "RB",
  "Pedro Porro": "RB", "Denzel Dumfries": "RB", "Jurrien Timber": "RB", "Ben White": "RB", "Matty Cash": "RB",
  "Tino Livramento": "RB", "Noussair Mazraoui": "RB", "Daniel Munoz": "RB", "Joao Cancelo": "RB", "Nahuel Molina": "RB",
  "Diogo Dalot": "RB", "Malo Gusto": "RB", "Giovanni Di Lorenzo": "RB", "Konrad Laimer": "RB", "Benjamin White": "RB",
  "Matheus Nunes": "RB", "Amar Dedic": "RB", "Sacha Boey": "RB", "Vanderson": "RB",
  "Nuno Mendes": "LB", "Marc Cucurella": "LB", "Federico Dimarco": "LB", "Alphonso Davies": "LB", "Theo Hernandez": "LB",
  "Alejandro Grimaldo": "LB", "Alejandro Balde": "LB", "Antonee Robinson": "LB", "Milos Kerkez": "LB", "Rayan Ait-Nouri": "LB",
  "Alvaro Carreras": "LB", "David Raum": "LB", "Pervis Estupinan": "LB", "Destiny Udogie": "LB", "Andrea Cambiaso": "LB",
  "Riccardo Calafiori": "LB", "Jorrel Hato": "LB", "Lucas Digne": "LB", "Rico Henry": "LB", "Adrien Truffert": "LB",
  "William Saliba": "CB", "Gabriel Magalhaes": "CB", "Virgil van Dijk": "CB", "Alessandro Bastoni": "CB", "Ruben Dias": "CB",
  "Marc Guehi": "CB", "Ibrahima Konate": "CB", "Josko Gvardiol": "CB", "Cristian Romero": "CB", "Pau Cubarsi": "CB",
  "Gleison Bremer": "CB", "Willian Pacho": "CB", "Matthijs de Ligt": "CB", "Micky van de Ven": "CB", "Dean Huijsen": "CB",
  "Eder Militao": "CB", "Dayot Upamecano": "CB", "Marquinhos": "CB", "Ezri Konsa": "CB", "Pau Torres": "CB",
  "Levi Colwill": "CB", "Jarrad Branthwaite": "CB", "Lisandro Martinez": "CB", "Sven Botman": "CB", "Murillo": "CB",
  "Ronald Araujo": "CB", "Robin Le Normand": "CB", "Jonathan Tah": "CB", "Nico Schlotterbeck": "CB", "John Stones": "CB",
  "Leny Yoro": "CB", "Nikola Milenkovic": "CB", "Antonio Rudiger": "CB", "Benjamin Pavard": "CB", "Manuel Akanji": "CB",
  "Alessandro Buongiorno": "CB", "Marcos Senesi": "CB", "Jan Paul van Hecke": "CB", "Maxence Lacroix": "CB", "Nathan Ake": "CB",
  "Jose Maria Gimenez": "CB", "David Hancko": "CB", "Dani Vivian": "CB", "Fikayo Tomori": "CB", "Minjae Kim": "CB",
  "Edmond Tapsoba": "CB", "Illia Zabarnyi": "CB", "Antonio Silva": "CB", "Goncalo Inacio": "CB", "Nathan Collins": "CB",
  "Trevoh Chalobah": "CB", "Joachim Andersen": "CB", "Malick Thiaw": "CB", "Federico Gatti": "CB", "Strahinja Pavlovic": "CB",
  "Leonardo Balerdi": "CB", "Castello Lukeba": "CB", "Evan Ndicka": "CB", "Ousmane Diomande": "CB", "Benjamin Pavard OM": "CB",
  "Ethan Pinnock": "CB", "Sepp van den Berg": "CB", "Tyrone Mings": "CB", "Tosin Adarabioyo": "CB", "Ko Itakura": "CB",
  "Yan Diomande": "LW", "Jeremy Jacquet": "CB", "Victor Munoz": "RW", "Geovany Quenda": "RW", "Ayyoub Bouaddi": "CM",
  "Bazoumana Toure": "RW", "Marco Palestra": "RB", "Valentin Barco": "LB", "Emmanuel Emegha": "ST", "Gonzalo Garcia": "ST",
  "Johan Manzambi": "CM", "Aladji Bamba": "CM", "Sean Steur": "CM", "Kerim Alajbegovic": "LW", "Aleksandar Stankovic": "CDM",
  "Costinha": "RB", "Mohamed-Ali Cho": "RW", "Merlin Rohl": "CM", "Tyrique George": "LW", "Anan Khalaili": "RB",
  "Oscar Mingueza": "RB", "Nico Elvedi": "CB", "Tarik Muharemovic": "CB", "Anel Ahmedhodzic": "CB", "Gustavo Hamer": "CM",
  "Caleb Yirenkyi": "CM", "Aurele Amenda": "CB", "Alvaro Rodriguez": "ST", "Andrey Santos": "CM", "El Hadji Malick Diouf": "LB",
  "Mateus Fernandes": "CM", "Jonathan Rowe": "LW", "Diego Moreira": "LW", "Santiago Castro": "ST", "Mario Gila": "CB",
  "Jhon Lucumi": "CB", "Miguel Gutierrez": "LB", "Guela Doue": "RB", "Xaver Schlager": "CDM", "Maxime Esteve": "CB",
  "Hayden Hackney": "CM", "Beto": "ST", "Moise Kean": "ST", "Daizen Maeda": "LW", "Sasa Lukic": "CM",
  "Arne Engels": "CM", "Manor Solomon": "LW", "Piero Hincapie": "CB", "Christos Tzolis": "LW", "Emiliano Buendia": "CAM"
};
function ensureRoles(game) {
  for (const p of Object.values(game.players || {})) {
    const want = REAL_ROLES[p.name];
    if (want && ROLE_GROUP[want] === p.pos) { p.role = want; continue; }
    if (!p.role || (p.role === p.pos && p.pos !== "GK")) {
      const pool = ROLE_POOL[p.pos] || ["CM"];
      p.role = pool[Math.floor(Math.random() * pool.length)];
    }
  }
}

function bestXI(game, teamName) {
  const ids = game.clubs[teamName].squad;
  const squad = ids.map(id => game.players[id]).filter(avail);
  const gks = squad.filter(p => p.pos === "GK").sort((a, b) => b.rating - a.rating);
  const out = squad.filter(p => p.pos !== "GK").sort((a, b) => b.rating - a.rating);
  const xi = [];
  if (gks[0]) xi.push(gks[0]);
  xi.push(...out.slice(0, 11 - xi.length));
  return xi;
}

// Use the manager's saved lineup if it is still valid, otherwise auto pick the best XI.
function chosenXI(game, teamName) {
  const club = game.clubs[teamName];
  const lu = club.lineup;
  if (lu && Array.isArray(lu.xi) && lu.xi.length === 11) {
    const squad = new Set(club.squad);
    if (lu.xi.every(id => squad.has(id) && avail(game.players[id]))) {
      const xi = lu.xi.map(id => game.players[id]);
      if (xi.filter(p => p.pos === "GK").length === 1) return xi;
    }
  }
  return bestXI(game, teamName);
}

function nationXI(game, nationName) {
  const nation = game.nations[nationName];
  return nation.playerIds.map(id => game.players[id]).filter(avail)
    .sort((a, b) => b.rating - a.rating).slice(0, 11);
}

// ---------- condition, travel and events ----------
// Every match uses effective OVRs: base rating plus form, morale, home or away with the player's own offset,
// the travel modifier for the away side and the injury return penalty. The maths lives in condition.js.
function geo(name) {
  const r = TRAVEL[name];
  return r ? { city: r[0], country: r[1], lat: r[2], lon: r[3], airport: r[4] + " (" + r[5] + ")", code: r[5], hotels: [r[6], r[7], r[8]] } : null;
}
function tripKm(a, b) {
  const A = geo(a), B = geo(b);
  return A && B ? C.haversine(A, B) : 500;
}
function tripId(kind, week) { return String(kind) + String(week); }
function clubTravel(club) {
  if (!club.travel) club.travel = { fund: 0, setup: false, policy: "standard", trips: {} };
  if (!club.travel.trips) club.travel.trips = {};
  return club.travel;
}
// a human club with no booking for an away trip gets its default policy, then the cheapest option, never a block
function autoBook(game, club, id, km, oppName, week) {
  const tv = clubTravel(club);
  let bk = C.policyBooking(km, tv.policy || "standard");
  let price = C.tripPrice(km, bk);
  let note = null;
  if (price > tv.fund + 1e-9) {
    bk = C.policyBooking(km, "cheap");
    price = C.tripPrice(km, bk);
    note = price > tv.fund + 1e-9
      ? "TRAVEL: the travel fund is dry, so the trip to " + oppName + " goes on the cheapest option and the club picks up the bill."
      : "TRAVEL: the fund could not stretch to the usual " + (tv.policy || "standard") + " trip to " + oppName + ", so the squad goes cheap.";
  }
  tv.fund = C.r3(Math.max(0, tv.fund - price));
  tv.trips[id] = bk;
  if (note) { C.addNews(club, week, note); log(game, note.replace("TRAVEL: the", "TRAVEL (" + club.name + "): the")); }
  return bk;
}
// the away side's travel modifier for one match
function travelMod(game, m, kind, week) {
  const away = game.clubs[m.away];
  if (!away || !game.clubs[m.home]) return 0;
  const km = tripKm(m.home, m.away);
  if (humanOf(game, m.away)) {
    const tv = clubTravel(away);
    const id = tripId(kind, week);
    const bk = tv.trips[id] || autoBook(game, away, id, km, m.home, week);
    return C.tripModifier(km, bk);
  }
  return C.aiTravelModifier(away.baseBudget !== undefined ? away.baseBudget : away.budget, km);
}
function effCtx(game, teamName, ctx) {
  const club = game.clubs[teamName];
  if (!club) return { neutral: true };
  return {
    home: !!ctx.home,
    analyst: !!(club.staff || {}).analyst,
    travel: ctx.home ? 0 : travelMod(game, ctx.m, ctx.kind, ctx.week),
    club,
    round: game.round
  };
}
function effOf(game, p, teamName, ctx) {
  return C.effOvr(p, ctx ? effCtx(game, teamName, ctx) : { neutral: true, club: game.clubs[teamName] || null, round: game.round });
}

// the bench a club can bring on: fit senior players who are not starting
function benchFor(game, teamName, xi) {
  const club = game.clubs[teamName];
  if (!club) return [];
  const starting = new Set(xi.map(p => p.id));
  return club.squad.map(id => game.players[id]).filter(p => p && !p.academy && avail(p) && !starting.has(p.id));
}
// ctx: { home: bool, m: match, kind: "L" or a cup key, week: round index } or nothing for a neutral read.
// A simmed match uses the starting eleven plus up to five subs, everyone weighed by the minutes he plays.
function strengths(game, teamName, ctx) {
  const isNation = game.nations && game.nations[teamName];
  const xi = isNation ? nationXI(game, teamName) : chosenXI(game, teamName);
  if (xi.length < 8) return { att: 55, def: 55, xi, parts: xi.map(p => ({ p, min: 90, start: true })), subs: [] };
  const ec = isNation || !ctx ? { neutral: true, club: isNation ? null : (game.clubs[teamName] || null), round: game.round } : effCtx(game, teamName, ctx);
  const eff = p => C.effOvr(p, ec);
  const subs = ctx && !isNation ? C.pickSubs(xi, benchFor(game, teamName, xi), Math.random, eff) : [];
  const parts = C.participants(xi, subs);
  const avg = arr => { let w = 0, t = 0; for (const e of arr) { w += e.min; t += eff(e.p) * e.min; } return w ? t / w : 0; };
  const attackers = parts.filter(e => e.p.pos === "FW" || e.p.pos === "MF");
  const defenders = parts.filter(e => e.p.pos === "DF" || e.p.pos === "GK");
  const overall = avg(parts);
  const att = attackers.length ? avg(attackers) : overall;
  const def = defenders.length ? avg(defenders) : overall;
  return { att: att * 0.7 + overall * 0.3, def: def * 0.7 + overall * 0.3, xi, parts, subs };
}
// once the final score is known: everyone who played moves with the result by his minutes, appearances
// are counted, and the players left on the bench start to sink in morale (league matches only)
function afterResult(game, m, xis, kind) {
  if (!xis || m.hg === null || m.hg === undefined) return;
  for (const side of ["home", "away"]) {
    const parts = xis[side] || [];
    const gf = side === "home" ? m.hg : m.ag, ga = side === "home" ? m.ag : m.hg;
    C.applyResult(parts, gf, ga);
    const played = new Set();
    for (const e of parts) { if (e.p) { C.recordAppearance(e.p, e.start, e.min); played.add(e.p.id); } }
    const club = game.clubs[m[side]];
    if (!club || (kind && kind !== "L")) continue;
    for (const id of club.squad) {
      const p = game.players[id];
      if (!p || p.academy || !avail(p)) continue;
      const e = parts.find(x => x.p && x.p.id === id);
      C.playingTime(p, e ? e.min : 0);
    }
  }
}
// the weekly pass over every player and club: drift, injury returns, academy growth, unexpected events
function weeklyCondition(game) {
  const week = game.round + 1;
  for (const p of Object.values(game.players)) {
    C.drift(p);
    C.healInjuryReturn(p);
  }
  for (const [name, club] of Object.entries(game.clubs)) {
    const human = humanOf(game, name);
    if (!(LEAGUES[club.league] || {}).playable && !human) continue;
    C.pruneFx(club, game.round);
    // the youth coach makes the academy kids grow every week, not just at the summer intake
    if (human && club.academy) {
      const chance = (club.staff || {}).youth ? 0.3 : 0.08;
      for (const id of club.academy) {
        const kid = game.players[id];
        if (kid && kid.rating < kid.pot && Math.random() < chance) { kid.rating++; kid.value = marketValue(kid.rating, kid.age, kid.pos); }
      }
    }
    const count = C.rollEventCount();
    if (!count) continue;
    const seniors = club.squad.map(id => game.players[id]).filter(p => p && !p.academy);
    for (let i = 0; i < count; i++) {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      const res = C.applyEvent(ev, club, seniors, game.round, Math.random);
      if (!res) continue;
      // the per club feed is only kept for clubs a person manages, AI clubs just take the effect
      if (human) { C.addNews(club, week, res.text); log(game, "EVENT (" + name + "): " + res.text); }
    }
  }
}

function simMatch(game, m, kind, week) {
  const A = strengths(game, m.home, { home: true, m, kind: kind || "L", week: week === undefined ? game.round : week });
  const B = strengths(game, m.away, { home: false, m, kind: kind || "L", week: week === undefined ? game.round : week });
  if (isDerby(m.home, m.away)) {
    const mAtt = (A.att + B.att) / 2, mDef = (A.def + B.def) / 2;
    A.att = A.att * 0.75 + mAtt * 0.25; B.att = B.att * 0.75 + mAtt * 0.25;
    A.def = A.def * 0.75 + mDef * 0.25; B.def = B.def * 0.75 + mDef * 0.25;
  }
  const tA = (game.clubs[m.home] || {}).tactic || "balanced";
  const tB = (game.clubs[m.away] || {}).tactic || "balanced";
  let lh = 1.42 * Math.exp((A.att - B.def) / 10);
  let la = 1.12 * Math.exp((B.att - A.def) / 10);
  if (tA === "attacking") { lh *= 1.18; la *= 1.12; }
  if (tA === "defensive") { lh *= 0.85; la *= 0.78; }
  if (tB === "attacking") { la *= 1.18; lh *= 1.12; }
  if (tB === "defensive") { la *= 0.85; lh *= 0.78; }
  if (isDerby(m.home, m.away)) { lh *= 1.06; la *= 1.06; }
  m.hg = poisson(Math.min(lh, 4.2));
  m.ag = poisson(Math.min(la, 4.2));
  return { home: A.parts, away: B.parts, subs: { home: A.subs, away: B.subs } };
}

function tableFor(game, league) {
  const fixtures = (game.leagueFixtures || {})[league];
  if (!fixtures) return [];
  const rows = {};
  for (const t of leagueClubs(game, league)) rows[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  for (const round of fixtures) for (const m of round) {
    if (m.hg === null) continue;
    const h = rows[m.home], a = rows[m.away];
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += m.hg; h.ga += m.ag; a.gf += m.ag; a.ga += m.hg;
    if (m.hg > m.ag) { h.w++; h.pts += 3; a.l++; }
    else if (m.hg < m.ag) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}

function log(game, text) {
  game.feed.unshift({ t: Date.now(), text });
  game.feed = game.feed.slice(0, 150);
}

function romano(game, text) {
  game.romano = game.romano || [];
  game.romano.unshift({ t: Date.now(), text });
  game.romano = game.romano.slice(0, 80);
}
function fmtFee(fee) { return "\u00a3" + Math.round(fee) + "m"; }

// ---------- youth academy ----------
function pick1(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function addAcademyIntake(game, clubName, n) {
  const club = game.clubs[clubName];
  const region = (LEAGUES[club.league] || {}).region || "england";
  const pool = ACADEMY_NAMES[region] || ACADEMY_NAMES.england;
  for (let i = 0; i < n; i++) {
    const name = pick1(pool.first) + " " + pick1(pool.last);
    const r = Math.random();
    const pos = r < 0.1 ? "GK" : r < 0.4 ? "DF" : r < 0.75 ? "MF" : "FW";
    const age = 15 + Math.floor(Math.random() * 3);
    const youth = (club.staff || {}).youth ? 2 : 0;
    const rating = 54 + youth + Math.floor(Math.random() * 13);
    const pot = Math.min(94, rating + 8 + youth + Math.floor(Math.random() * 13));
    const id = game.playerSeq++;
    game.players[id] = { id, name, pos, age, rating, pot, academy: true, value: marketValue(rating, age, pos), club: clubName, league: club.league };
    club.academy.push(id);
  }
}

function spawnAcademy(game, clubName) {
  const club = game.clubs[clubName];
  if (!club || club.academy) return;
  if (!game.playerSeq) game.playerSeq = Math.max(...Object.keys(game.players).map(Number)) + 1;
  club.academy = [];
  addAcademyIntake(game, clubName, 4);
  ensureRoles(game);
}

function refreshAcademies(game) {
  for (const user of Object.values(game.users)) {
    if (!user.team) continue;
    const club = game.clubs[user.team];
    if (!club.academy) { spawnAcademy(game, user.team); continue; }
    // extra growth toward potential on top of normal ageing
    for (const id of club.academy) {
      const p = game.players[id];
      if (!p) continue;
      if (p.rating < p.pot) p.rating = Math.min(p.pot, p.rating + 1 + Math.floor(Math.random() * 3));
      p.value = marketValue(p.rating, p.age, p.pos);
    }
    // kids who turn 20 without promotion are released
    const released = club.academy.filter(id => game.players[id] && game.players[id].age >= 20);
    for (const id of released) {
      log(game, `${game.players[id].name} (${user.team} academy) was released without making the first team.`);
      delete game.players[id];
    }
    club.academy = club.academy.filter(id => game.players[id]);
    addAcademyIntake(game, user.team, 2);
    // cap at 6, drop the weakest
    while (club.academy.length > 6) {
      club.academy.sort((a, b) => game.players[b].rating - game.players[a].rating);
      const cut = club.academy.pop();
      delete game.players[cut];
    }
  }
}

// ---------- game creation ----------
function newGameMarkBudgets(clubs) {
  for (const c of Object.values(clubs)) c.baseBudget = c.budget;
  return clubs;
}
function newGame(hostName) {
  const { players, clubs } = buildDatabase();
  const playerMap = {};
  players.forEach(p => playerMap[p.id] = p);
  for (const p of players) {
    const owner = REAL_LOANS[p.name];
    if (owner && clubs[owner] && p.club !== owner) p.loanOwner = owner;
  }
  for (const c of Object.values(clubs)) c.tactic = "balanced";
  newGameMarkBudgets(clubs);
  const premTeams = Object.values(clubs).filter(c => c.prem).map(c => c.name);
  const game = {
    code: code4(),
    host: hostName,
    users: { [hostName]: { name: hostName, team: null, nation: null } },
    players: playerMap,
    clubs,
    premTeams,
    started: false,
    season: 1,
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    playerSeq: players.length + 1,
    lock: { active: false, week: 0 },
    plays: {},
    offers: [],
    offerSeq: 1,
    stats: {},
    romano: [],
    feed: [],
    created: Date.now()
  };
  // fixtures for every league that has clubs, playable or AI second division
  game.leagueFixtures = {};
  for (const league of Object.keys(LEAGUES)) {
    const names = leagueClubs(game, league);
    if (names.length >= 4 && names.length % 2 === 0) game.leagueFixtures[league] = makeFixtures(names);
  }
  // national teams resolved from real players in the database
  const nameIdx = {};
  players.forEach(p => { if (!(p.name in nameIdx)) nameIdx[p.name] = p.id; });
  game.nations = {};
  for (const [nation, list] of Object.entries(NATIONS)) {
    const ids = list.map(n => nameIdx[n]).filter(id => id !== undefined);
    if (ids.length >= 10) game.nations[nation] = { name: nation, playerIds: ids, manager: null };
  }
  game.cups = makeAllCups(game);
  spawnWonderkids(game);
  log(game, "Game created. Waiting in the lobby.");
  games[game.code] = game;
  save();
  ensureRoles(game);
  return game;
}

// ---------- offers and negotiation ----------
function humanOf(game, clubName) {
  return Object.values(game.users).find(u => u.team === clubName) || null;
}

function askingPrice(game, player, sellingClub) {
  let mult = 1.2;
  if (player.rating >= 88) mult = 1.6;
  else if (player.rating >= 84) mult = 1.45;
  else if (player.rating >= 80) mult = 1.3;
  if (player.age <= 22) mult += 0.15;
  const squadSize = game.clubs[sellingClub].squad.length;
  if (squadSize <= 14) mult += 0.25;
  return Math.round(player.value * mult * 10) / 10;
}

function stripFromLineup(club, id) {
  if (!club.lineup) return;
  club.lineup.xi = (club.lineup.xi || []).filter(x => x !== id);
  club.lineup.subs = (club.lineup.subs || []).filter(x => x !== id);
}

function voidOtherOffers(game, playerId, keepId) {
  for (const o of game.offers || []) {
    if (o.playerId !== playerId || o.id === keepId) continue;
    if (["pending_seller", "countered"].includes(o.status)) {
      o.status = "void";
      o.note = "The player was sold in another deal, so this offer is dead.";
    }
  }
}

function doTransfer(game, offer) {
  const p = game.players[offer.playerId];
  if (p.club !== offer.sellerClub) return { ok: false, msg: "The player already left that club. Deal is off." };
  const buyer = game.clubs[offer.toClub];
  const seller = game.clubs[p.club];
  if (seller.squad.length <= 13) return { ok: false, msg: "The selling club can't go below 13 players." };
  if (buyer.budget < offer.fee) return { ok: false, msg: "Not enough budget to complete the deal." };
  if (buyer.squad.length >= 30) return { ok: false, msg: "Squad is full (30 max)." };
  const sw = offer.swapId ? game.players[offer.swapId] : null;
  if (offer.swapId) {
    if (!sw || sw.club !== offer.toClub) return { ok: false, msg: "The swap player is no longer at your club. Deal is off." };
    if (sw.loanOwner) return { ok: false, msg: "You can't include a loan player in a swap." };
    if (buyer.squad.length <= 14) return { ok: false, msg: "Your squad is too thin to give a player away in the swap." };
    if (seller.squad.length >= 30) return { ok: false, msg: "The selling club has no squad room for the swap player." };
  }
  buyer.budget = Math.round((buyer.budget - offer.fee) * 10) / 10;
  seller.budget = Math.round((seller.budget + offer.fee) * 10) / 10;
  seller.squad = seller.squad.filter(id => id !== p.id);
  stripFromLineup(seller, p.id);
  buyer.squad.push(p.id);
  const from = p.club;
  p.club = offer.toClub;
  p.league = buyer.league;
  p.listed = false;
  if (sw) {
    buyer.squad = buyer.squad.filter(id => id !== sw.id);
    stripFromLineup(buyer, sw.id);
    seller.squad.push(sw.id);
    sw.club = from;
    sw.league = seller.league;
    sw.listed = false;
    voidOtherOffers(game, sw.id, offer.id);
  }
  voidOtherOffers(game, p.id, offer.id);
  if (p.pendingDeal) {
    if (p.pendingDeal.toClub !== offer.toClub) romano(game, `💥 ${p.pendingDeal.toClub} thought they had ${p.name} agreed. ${offer.toClub} just took him instead. Brutal window.`);
    delete p.pendingDeal;
  }
  if (!humanOf(game, offer.toClub)) giveDefaultContract(p);
  if (sw && !humanOf(game, offer.sellerClub)) giveDefaultContract(sw);
  C.bumpMorale(p, C.T.SIGN_MORALE);
  if (sw) C.bumpMorale(sw, C.T.SIGN_MORALE * 0.5);
  log(game, `TRANSFER: ${p.name} joins ${offer.toClub} from ${from} for £${offer.fee}m${sw ? ` plus ${sw.name} going the other way` : ""}.`);
  romano(game, `🚨✅ HERE WE GO! ${p.name} to ${offer.toClub}, done deal! ${fmtFee(offer.fee)}${sw ? " plus " + sw.name + " in a swap" : " package"} agreed with ${from}. Medical booked, contract signed.`);
  return { ok: true };
}

function resolveAiSellerOffer(game, offer) {
  const p = game.players[offer.playerId];
  if (p.club !== offer.sellerClub) { offer.status = "void"; offer.note = "The player already left that club."; return; }
  const baseAsk = p.listed ? p.value : askingPrice(game, p, p.club);
  // swap bids to AI clubs are accept or reject: the swap player counts at 85
  // percent of his value, and there is no haggling on a part exchange
  if (offer.swapId) {
    const sw = game.players[offer.swapId];
    if (!sw || sw.club !== offer.toClub) { offer.status = "void"; offer.note = "The swap player is no longer at your club."; return; }
    const credit = Math.round(sw.value * 0.85 * 10) / 10;
    const total = Math.round((offer.fee + credit) * 10) / 10;
    if (total >= baseAsk - 0.05) {
      const buyerBig = BIG_CLUBS.includes(offer.toClub);
      if (p.rating >= 85 && p.age > 22 && !buyerBig && Math.random() < 0.45) {
        offer.status = "player_declined";
        offer.note = `${p.club} liked the package but ${p.name} turned down the move. Bigger clubs are circling.`;
        romano(game, `❌ BREAKING: ${p.name} to ${offer.toClub} is OFF! The clubs agreed a cash plus player deal but the player said no to the project.`);
        return;
      }
      if (humanOf(game, offer.toClub) && offer.buyerUser) { completeSigning(game, offer, p); return; }
      const res = doTransfer(game, offer);
      offer.status = res.ok ? "accepted" : "failed";
      offer.note = res.ok ? `Deal done: £${offer.fee}m plus ${sw.name}. They valued the package at £${total}m against an ask of £${Math.round(baseAsk * 10) / 10}m.` : res.msg;
      if (res.ok) romano(game, `🚨✅ Part exchange completed! ${p.name} to ${offer.toClub}, with ${sw.name} plus ${fmtFee(offer.fee)} going the other way. Both clubs happy with the maths.`);
    } else {
      offer.status = "declined";
      offer.note = `${p.club} rejected the package. They rate ${sw.name} at £${credit}m in a trade, so your offer is worth £${total}m against an ask of £${Math.round(baseAsk * 10) / 10}m. Add cash or a better player, part exchanges are take it or leave it.`;
      romano(game, `❌ ${p.club} have said no to a cash plus player approach from ${offer.toClub} for ${p.name}. The package fell short of their valuation.`);
    }
    return;
  }
  // Settled stars are not for sale at sane money, and mostly not at silly money either.
  if (isSettled(game, p) && !(offer.fee >= p.value * 1.9 && BIG_CLUBS.includes(offer.toClub))) {
    offer.status = "declined";
    const line = SETTLED_LINES[Math.floor(Math.random() * SETTLED_LINES.length)];
    offer.note = `${p.club} shut this down. ${p.name} ` + line;
    romano(game, `❌ ${offer.toClub} tried for ${p.name} and got nowhere. ${p.name} ` + line);
    return;
  }
  if (isSettled(game, p) && Math.random() < 0.6) {
    offer.status = "player_declined";
    offer.note = `${p.club} wobbled at the money but ${p.name} said no himself. He is happy where he is.`;
    romano(game, `❌ BREAKING: ${p.name} has personally rejected ${offer.toClub}. The fee was massive, the answer was still no.`);
    return;
  }
  // AI clubs haggle: they start at the asking price but can be talked down to a
  // floor a fair way below it. Listed players go even cheaper.
  // a chief scout knows the market: the selling club reads the bid about ten percent higher and settles lower
  const hasScout = !!(humanOf(game, offer.toClub) && ((game.clubs[offer.toClub] || {}).staff || {}).scout);
  const edge = hasScout ? 1.1 : 1;
  const floor = Math.round(Math.max(0.5, (p.listed ? p.value * 0.8 : Math.min(p.value, baseAsk * 0.8)) * (hasScout ? 0.92 : 1)) * 10) / 10;
  if (offer.demand === undefined) offer.demand = baseAsk;
  if (offer.fee * edge >= offer.demand - 0.05) {
    const buyerBig = BIG_CLUBS.includes(offer.toClub);
    if (p.rating >= 85 && p.age > 22 && !buyerBig && Math.random() < (hasScout ? 0.3 : 0.45)) {
      offer.status = "player_declined";
      offer.note = `${p.club} accepted £${offer.fee}m but ${p.name} turned down the move. Bigger clubs are circling.`;
      romano(game, `❌ BREAKING: ${p.name} to ${offer.toClub} is OFF! Clubs had a full agreement at ${fmtFee(offer.fee)} but the player said no to the project. He is waiting for a bigger club.`);
      return;
    }
    if (humanOf(game, offer.toClub) && offer.buyerUser) { completeSigning(game, offer, p); return; }
    const res = doTransfer(game, offer);
    offer.status = res.ok ? "accepted" : "failed";
    offer.note = res.ok ? `Deal completed at £${offer.fee}m.` : res.msg;
  } else if (offer.fee * edge >= baseAsk * 0.4) {
    let newDemand = Math.round(((offer.demand + offer.fee * edge) / 2) * 10) / 10;
    if (newDemand < floor) newDemand = floor;
    if (newDemand <= offer.fee) {
      offer.demand = offer.fee;
      resolveAiSellerOffer(game, offer);
      return;
    }
    offer.demand = newDemand;
    offer.status = "countered";
    offer.counterFee = newDemand;
    romano(game, `🔴 ${offer.toClub} are pushing to sign ${p.name}. ${p.club} have rejected the latest proposal, they now want around ${fmtFee(newDemand)}. Negotiations ongoing.`);
    offer.note = newDemand <= floor + 0.05
      ? `${p.club} came down to £${newDemand}m. That is their final price, they will not go lower.`
      : `${p.club} rejected £${offer.fee}m but came down to £${newDemand}m. Keep haggling and they might drop a little more.`;
  } else {
    offer.status = "countered";
    offer.counterFee = Math.round(baseAsk * 10) / 10;
    offer.note = `${p.club} rejected £${offer.fee}m out of hand, but the door stays open at £${offer.counterFee}m. Accept their price or come back closer to it.`;
    romano(game, `❌ ${p.club} have turned down a low approach from ${offer.toClub} for ${p.name}. Their price is ${fmtFee(offer.counterFee)}, talks alive but cold.`);
  }
}

// ---------- transfer windows ----------
function windowOpen(game) {
  const r = game.round;
  return r <= 3 || (r >= 19 && r <= 22);
}
function deadlineDay(game) {
  const r = game.round;
  return r === 3 || r === 22;
}
function windowInfo(game) {
  const r = game.round;
  if (r === 3) return { open: true, deadline: true, label: "DEADLINE DAY. The window slams shut after this week" };
  if (r === 22) return { open: true, deadline: true, label: "DEADLINE DAY. The window slams shut after this week" };
  if (r <= 3) return { open: true, deadline: false, label: "Summer window open, shuts after week 4" };
  if (r >= 19 && r <= 22) return { open: true, deadline: false, label: "January window open, shuts after week 22" };
  if (r < 19) return { open: false, deadline: false, label: "Window shut, January window opens after week 19" };
  return { open: false, deadline: false, label: "Window shut for the season, reopens in the summer" };
}

// AI clubs scout their own needs and buy from each other, so the world
// stays strong even when humans strip a league of its stars.
function aiWeakestSpot(game, club) {
  const squad = club.squad.map(id => game.players[id]).filter(p => p && !p.academy);
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) byPos[p.pos] && byPos[p.pos].push(p);
  for (const [pos, min] of [["GK", 2], ["DF", 5], ["MF", 5], ["FW", 3]]) {
    if (byPos[pos].length < min) return { pos, floor: 0 };
  }
  // one objective: win. find the weakest STARTER and replace him with better
  const xi = bestXI(game, club.name);
  if (xi.length) {
    const weakest = [...xi].sort((a, b) => a.rating - b.rating)[0];
    return { pos: weakest.pos, floor: weakest.rating };
  }
  let worstPos = "MF", worstRating = 100;
  for (const pos of ["GK", "DF", "MF", "FW"]) {
    const best = byPos[pos].sort((a, b) => b.rating - a.rating).slice(0, pos === "GK" ? 1 : 3);
    const avg = best.reduce((t, p) => t + p.rating, 0) / (best.length || 1);
    if (avg < worstRating) { worstRating = avg; worstPos = pos; }
  }
  return { pos: worstPos, floor: worstRating };
}

// A settled star does not want to move: world class players at giant clubs,
// generational kids loving life where they are, and champions fresh off a title.
function isSettled(game, p) {
  if (!p || p.listed || p.club === "" || !game.clubs[p.club]) return false;
  const big = BIG_CLUBS.includes(p.club);
  if (p.rating >= 88 && big) return true;
  if (p.age <= 23 && p.rating >= 87) return true;
  const champs = game.lastTables && game.lastTables[game.clubs[p.club].league];
  if (champs && champs[0] === p.club && p.rating >= 86) return true;
  return false;
}
const SETTLED_LINES = [
  "is having the time of his life there. His camp did not even take the call.",
  "just signed the biggest deal of his career and is going nowhere.",
  "is the face of that club. They would sooner sell the stadium.",
  "laughed off the approach. He is settled, adored and winning.",
  "wants to build a dynasty where he is. Talks lasted four minutes."
];
function aiToAiTransfers(game) {
  if (!windowOpen(game)) return;
  const aiClubs = Object.values(game.clubs).filter(c =>
    !humanOf(game, c.name) && (game.leagueFixtures || {})[c.league]);
  // a club with a live bid on a human manager's player keeps its money ready
  const committed = new Set((game.offers || [])
    .filter(o => ["pending_seller", "countered"].includes(o.status) && o.direction === "inbound")
    .map(o => o.fromClub));
  for (const pl of Object.values(game.players)) if (pl.pendingDeal) committed.add(pl.pendingDeal.toClub);
  const buyers = shuffle(aiClubs.filter(c => c.budget >= 5 && c.squad.length < 29 && !committed.has(c.name)));
  // richer clubs shop more often, everyone shops sometimes
  const frenzy = deadlineDay(game);
  const active = buyers.filter(c => Math.random() < (0.38 + Math.min(0.4, c.budget / 350)) * (frenzy ? 1.7 : 1));
  let done = 0, posts = 0;
  const dealCap = frenzy ? 28 : 16;
  const humanLeagues = new Set(Object.values(game.users).filter(u => u.team && game.clubs[u.team]).map(u => game.clubs[u.team].league));
  for (const buyer of active) {
    if (done >= dealCap) break;
    const need = aiWeakestSpot(game, buyer);
    const wantKid = buyer.budget > (buyer.baseBudget || buyer.budget) * 0.6 && Math.random() < 0.3;
    const pool = Object.values(game.players).filter(p =>
      p.club !== buyer.name && !p.academy && !p.loanOwner && !p.pendingDeal &&
      !humanOf(game, p.club) && game.clubs[p.club] &&
      (game.leagueFixtures || {})[p.league] &&
      game.clubs[p.club].squad.length > 16 &&
      !isSettled(game, p) &&
      (wantKid ? (p.age <= 21 && p.rating >= 76) : (p.pos === need.pos && p.rating >= need.floor + 3)) &&
      p.value <= buyer.budget * 0.9 && p.value >= 2);
    if (!pool.length) continue;
    pool.sort((a, b) => b.rating - a.rating);
    const reach = buyer.budget >= 120 ? 3 : 6;
    const target = pool[Math.floor(Math.random() * Math.min(reach, pool.length))];
    const seller = game.clubs[target.club];
    // clubs fight to keep their best player unless the money is silly
    const isCrown = seller.squad.map(id => game.players[id]).filter(Boolean)
      .sort((a, b) => b.rating - a.rating)[0];
    let fee = Math.round(target.value * (0.95 + Math.random() * 0.25) * 10) / 10;
    if (isCrown && isCrown.id === target.id) {
      if (Math.random() < 0.65) continue;
      fee = Math.round(target.value * 1.3 * 10) / 10;
    }
    if (fee > buyer.budget) continue;
    if (!frenzy) {
      target.pendingDeal = { toClub: buyer.name, fee, agreed: game.round };
      done++;
      const loudA = target.rating >= 82 || humanLeagues.has(buyer.league) || humanLeagues.has(seller.name && seller.league);
      if (loudA && posts < 7) {
        posts++;
        log(game, `AGREED: ${buyer.name} and ${target.club} have a £${fee}m deal for ${target.name}. Completing next week, unless someone hijacks it.`);
        if (target.rating >= 84) romano(game, `🔴 Deal AGREED: ${target.name} to ${buyer.name}, ${fmtFee(fee)}. Paperwork this week, announcement next. Other clubs still lurking.`);
      }
      continue;
    }
    buyer.budget = Math.round((buyer.budget - fee) * 10) / 10;
    seller.budget = Math.round((seller.budget + fee) * 10) / 10;
    seller.squad = seller.squad.filter(id => id !== target.id);
    stripFromLineup(seller, target.id);
    buyer.squad.push(target.id);
    const from = target.club;
    target.club = buyer.name;
    target.league = buyer.league;
    target.listed = false;
    giveDefaultContract(target);
    voidOtherOffers(game, target.id, -1);
    game.aiDeals = (game.aiDeals || 0) + 1;
    done++;
    const loud = target.rating >= 85 || humanLeagues.has(buyer.league) || humanLeagues.has(seller.league);
    if (loud && posts < 3) {
      posts++;
      log(game, `TRANSFER: ${target.name} joins ${buyer.name} from ${from} for £${fee}m.`);
      if (target.rating >= 86) romano(game, `🚨✅ HERE WE GO! ${target.name} to ${buyer.name}, done deal! ${fmtFee(fee)} to ${from}. The AI clubs are spending big this window.`);
    }
  }
}

function completePendingDeals(game) {
  const humanLeagues = new Set(Object.values(game.users).filter(u => u.team && game.clubs[u.team]).map(u => game.clubs[u.team].league));
  let posts = 0;
  for (const p of Object.values(game.players)) {
    if (!p.pendingDeal || p.pendingDeal.agreed >= game.round) continue;
    const deal = p.pendingDeal;
    const buyer = game.clubs[deal.toClub];
    const seller = game.clubs[p.club];
    delete p.pendingDeal;
    if (!buyer || !seller || humanOf(game, p.club)) continue;
    if (buyer.budget < deal.fee || buyer.squad.length >= 30 || seller.squad.length <= 13) {
      log(game, `COLLAPSED: the ${p.name} deal to ${deal.toClub} has fallen through at the last minute.`);
      continue;
    }
    buyer.budget = Math.round((buyer.budget - deal.fee) * 10) / 10;
    seller.budget = Math.round((seller.budget + deal.fee) * 10) / 10;
    seller.squad = seller.squad.filter(id => id !== p.id);
    stripFromLineup(seller, p.id);
    buyer.squad.push(p.id);
    const from = p.club;
    p.club = deal.toClub;
    p.league = buyer.league;
    p.listed = false;
    giveDefaultContract(p);
    voidOtherOffers(game, p.id, -1);
    game.aiDeals = (game.aiDeals || 0) + 1;
    const loud = p.rating >= 85 || humanLeagues.has(buyer.league) || humanLeagues.has(seller.league);
    if (loud && posts < 3) {
      posts++;
      log(game, `TRANSFER: ${p.name} joins ${deal.toClub} from ${from} for £${deal.fee}m.`);
      if (p.rating >= 86) romano(game, `🚨✅ HERE WE GO, confirmed: ${p.name} to ${deal.toClub}, ${fmtFee(deal.fee)}. Announced as agreed last week. Nobody hijacked it.`);
    }
  }
}

function activeRivalOffers(game, playerId, notClub) {
  return (game.offers || []).filter(o =>
    o.playerId === playerId && ["pending_seller", "countered"].includes(o.status) && o.toClub && o.toClub !== notClub);
}

function hijackPrice(game, p, viewClub) {
  if (p.pendingDeal) return Math.round(Math.max(p.pendingDeal.fee * 1.2, p.pendingDeal.fee + 2) * 10) / 10;
  const rivals = activeRivalOffers(game, p.id, viewClub);
  if (!rivals.length) return null;
  const best = Math.max(...rivals.map(o => Math.max(o.fee || 0, o.counterFee || 0, o.demand || 0)));
  const ask = game.clubs[p.club] ? askingPrice(game, p, p.club) : best;
  return Math.round(Math.max(best * 1.15, ask) * 10) / 10;
}

function aiFreeAgentSignings(game) {
  const free = shuffle(Object.values(game.players).filter(p => p.club === "" && p.rating >= 64));
  if (!free.length) return;
  let done = 0;
  for (const p of free) {
    if (done >= 2) break;
    if (Math.random() > 0.3) continue;
    const fits = shuffle(Object.values(game.clubs).filter(c =>
      !humanOf(game, c.name) && (game.leagueFixtures || {})[c.league] &&
      c.squad.length < 26 && aiWeakestSpot(game, c).pos === p.pos));
    if (!fits.length) continue;
    const club = fits[0];
    p.club = club.name;
    p.league = club.league;
    p.loanOwner = null;
    delete p.pendingDeal;
    giveDefaultContract(p);
    club.squad.push(p.id);
    done++;
    log(game, `FREE TRANSFER: ${p.name} finds a new home at ${club.name} on a free.`);
    if (p.rating >= 80) romano(game, `\u270d\ufe0f Free agent no more: ${p.name} signs for ${club.name}. Smart business, zero fee.`);
  }
}

function aiLoans(game) {
  if (!windowOpen(game)) return;
  const frenzy = deadlineDay(game);
  const aiClubs = Object.values(game.clubs).filter(c =>
    !humanOf(game, c.name) && (game.leagueFixtures || {})[c.league]);
  const borrowers = shuffle(aiClubs.filter(c => c.squad.length < 28))
    .sort((a, b) => ((a.budget < 12 ? 0 : 1) - (b.budget < 12 ? 0 : 1)));
  const humanLeagues = new Set(Object.values(game.users).filter(u => u.team && game.clubs[u.team]).map(u => game.clubs[u.team].league));
  let done = 0, posts = 0;
  const cap = frenzy ? 6 : 3;
  for (const club of borrowers) {
    if (done >= cap) break;
    const needy = club.budget < 12;
    if (Math.random() > (needy ? (frenzy ? 0.9 : 0.7) : (frenzy ? 0.55 : 0.3))) continue;
    const loansIn = club.squad.map(id => game.players[id]).filter(x => x && x.loanOwner && x.loanOwner !== club.name).length;
    if (loansIn >= 3) continue;
    const need = aiWeakestSpot(game, club);
    const pool = Object.values(game.players).filter(p =>
      p.club !== club.name && !p.academy && !p.loanOwner && !p.listed &&
      !humanOf(game, p.club) && game.clubs[p.club] &&
      (game.leagueFixtures || {})[p.league] &&
      game.clubs[p.club].squad.length > 16 &&
      p.pos === need.pos && (p.age <= 24 || (p.age <= 30 && Math.random() < 0.35)) && p.rating >= 70 && p.rating <= 83 &&
      Math.max(0.5, Math.round(p.value * 0.1 * 10) / 10) <= club.budget);
    if (!pool.length) continue;
    const p = pool[Math.floor(Math.random() * pool.length)];
    const owner = game.clubs[p.club];
    if (p.pos === "GK" && owner.squad.map(id => game.players[id]).filter(x => x && x.pos === "GK").length < 3) continue;
    const fee = Math.max(0.5, Math.round(p.value * 0.1 * 10) / 10);
    if (club.budget < fee) continue;
    club.budget = Math.round((club.budget - fee) * 10) / 10;
    owner.budget = Math.round((owner.budget + fee) * 10) / 10;
    owner.squad = owner.squad.filter(id => id !== p.id);
    stripFromLineup(owner, p.id);
    club.squad.push(p.id);
    p.loanOwner = owner.name;
    p.loanFee = fee;
    p.club = club.name;
    p.league = club.league;
    voidOtherOffers(game, p.id, -1);
    game.aiLoanDeals = (game.aiLoanDeals || 0) + 1;
    done++;
    if (posts < 3) {
      posts++;
      log(game, `LOAN: ${p.name} joins ${club.name} on loan from ${owner.name} until the end of the season.`);
    }
    if ((p.rating >= 80 || humanLeagues.has(club.league) || humanLeagues.has(owner.league)) && posts <= 3) {
      romano(game, `\ud83d\udfe1 Loan deal done: ${p.name} moves to ${club.name} on loan, ${owner.name} keep his future in their hands.`);
    }
  }
}

// When a human counters an incoming bid, the AI buyer comes back next week:
// meets the price, improves once, or holds its last bid on the table. It never ghosts.
function aiAnswerCounters(game) {
  for (const offer of game.offers || []) {
    if (offer.status !== "countered" || offer.direction !== "inbound") continue;
    const p = game.players[offer.playerId];
    const buyer = game.clubs[offer.fromClub];
    if (!p || !buyer || p.club !== offer.sellerClub) { offer.status = "void"; offer.note = "The player moved on."; continue; }
    const ceiling = Math.min(buyer.budget, Math.round(p.value * (offer.kind === "loan" ? 0.15 : 1.35) * 10) / 10);
    const want = offer.counterFee;
    if (want <= ceiling) {
      offer.fee = want;
      offer.status = "pending_seller";
      offer.note = `${offer.fromClub} accept your price. £${want}m is on the table, press accept to complete it.`;
      log(game, `${offer.fromClub} have met ${offer.sellerClub}'s asking price for ${p.name}: £${want}m.`);
      romano(game, `🟢 ${offer.fromClub} have agreed to ${offer.sellerClub}'s price for ${p.name}. ${fmtFee(want)}. Just needs the green light.`);
    } else if (!offer.finalPush && buyer.budget > offer.fee) {
      const improved = Math.min(ceiling, Math.round(((offer.fee + want) / 2) * 10) / 10);
      if (improved > offer.fee) {
        offer.fee = improved;
        offer.finalPush = true;
        offer.status = "pending_seller";
        offer.note = `${offer.fromClub} came up to £${improved}m. They call it their final bid, and it stays on the table.`;
        log(game, `${offer.fromClub} improve their bid for ${p.name} to £${improved}m.`);
      } else {
        offer.status = "pending_seller";
        offer.finalPush = true;
        offer.note = `${offer.fromClub} will not go past £${offer.fee}m, but the bid stays live. Accept it whenever you like this window.`;
      }
    } else {
      offer.status = "pending_seller";
      offer.note = `${offer.fromClub} are holding at £${offer.fee}m. The bid stays on the table, accept it whenever you like this window.`;
    }
  }
}
function aiLoanRequestsToHumans(game) {
  if (!windowOpen(game)) return;
  for (const user of Object.values(game.users)) {
    if (!user.team) continue;
    const club = game.clubs[user.team];
    if (club.squad.length <= 18) continue;
    if (Math.random() > 0.45) continue;
    const fringe = club.squad.map(id => game.players[id]).filter(p =>
      p && !p.loanOwner && !p.academy && !p.listed && p.rating >= 68 && p.rating <= 80 &&
      !(game.offers || []).some(o => o.playerId === p.id && ["pending_seller", "countered"].includes(o.status)));
    if (!fringe.length) continue;
    const target = fringe[Math.floor(Math.random() * fringe.length)];
    const borrowers = Object.values(game.clubs).filter(c =>
      c.name !== user.team && !humanOf(game, c.name) && (game.leagueFixtures || {})[c.league] && c.squad.length < 26);
    if (!borrowers.length) continue;
    const borrower = borrowers[Math.floor(Math.random() * borrowers.length)];
    const fee = Math.max(0.5, Math.round(target.value * 0.08 * 10) / 10);
    game.offers.push({
      id: game.offerSeq++, playerId: target.id, fromClub: borrower.name, toClub: borrower.name,
      sellerClub: user.team, fee, kind: "loan", status: "pending_seller", direction: "inbound", week: game.round
    });
    log(game, `LOAN ASK: ${borrower.name} want ${target.name} on loan until the end of the season, £${fee}m loan fee. Answer in the Offers tab.`);
  }
}
function aiInboundBids(game) {
  if (!windowOpen(game)) return;
  for (const user of Object.values(game.users)) {
    if (!user.team) continue;
    const club = game.clubs[user.team];
    const candidates = club.squad.map(id => game.players[id]).filter(p => p && !p.loanOwner && !p.academy && (p.listed || (p.rating >= 80 && !isSettled(game, p))));
    if (!candidates.length) continue;
    const chance = candidates.some(p => p.listed) ? 0.8 : 0.45;
    if (Math.random() > chance) continue;
    const listed = candidates.filter(p => p.listed);
    const target = (listed.length ? listed : candidates)[Math.floor(Math.random() * (listed.length ? listed.length : candidates.length))];
    const starHunger = !target.listed && target.rating >= 86 ? 0.15 : 0;
    const fee = Math.round(target.value * (target.listed ? (0.85 + Math.random() * 0.3) : (0.95 + starHunger + Math.random() * 0.45)) * 10) / 10;
    const bidders = Object.values(game.clubs).filter(c => c.name !== user.team && !humanOf(game, c.name) && c.budget >= fee && c.squad.length < 30);
    if (!bidders.length) continue;
    bidders.sort((a, b) => b.budget - a.budget);
    const pool = target.rating >= 84 ? bidders.slice(0, 15) : bidders;
    const bidder = pool[Math.floor(Math.random() * pool.length)];
    game.offers.push({
      id: game.offerSeq++, playerId: target.id, fromClub: bidder.name, toClub: bidder.name,
      sellerClub: user.team, fee, status: "pending_seller", direction: "inbound", week: game.round
    });
    log(game, `${bidder.name} have bid £${fee}m for ${target.name} (${user.team}).`);
    romano(game, `🚨 EXCLUSIVE: ${bidder.name} have made an official approach for ${target.name}! Around ${fmtFee(fee)} on the table. ${user.team} must now decide, the player is aware of the interest.`);
  }
}

function leagueAwards(game, league) {
  const rows = [];
  for (const name of leagueClubs(game, league)) {
    const club = game.clubs[name];
    if (!club) continue;
    for (const id of club.squad) {
      const st = (game.stats || {})[id];
      if (!st || (!st.g && !st.a)) continue;
      const p = game.players[id];
      if (!p) continue;
      rows.push({ id, name: p.name, club: name, pos: p.pos, g: st.g, a: st.a, score: st.g * 2 + st.a });
    }
  }
  const boot = [...rows].sort((x, y) => y.g - x.g || y.a - x.a)[0] || null;
  const ball = [...rows].sort((x, y) => y.a - x.a || y.g - x.g)[0] || null;
  const pots = [...rows].sort((x, y) => y.score - x.score)[0] || null;
  return { boot, ball, pots };
}

function statBoards(game, league) {
  const rows = [];
  for (const name of leagueClubs(game, league)) {
    const club = game.clubs[name];
    if (!club) continue;
    for (const id of club.squad) {
      const st = (game.stats || {})[id];
      if (!st || (!st.g && !st.a)) continue;
      const p = game.players[id];
      if (!p) continue;
      rows.push({ name: p.name, club: name, pos: p.pos, g: st.g, a: st.a, score: st.g * 2 + st.a });
    }
  }
  return {
    scorers: [...rows].sort((x, y) => y.g - x.g || y.a - x.a).slice(0, 5),
    assisters: [...rows].sort((x, y) => y.a - x.a || y.g - x.g).slice(0, 5),
    stars: [...rows].sort((x, y) => y.score - x.score).slice(0, 5)
  };
}

function spawnRegen(game, clubName, baseRating, forcedAge) {
  const club = game.clubs[clubName];
  if (!club) return null;
  const region = (LEAGUES[club.league] || {}).region || "england";
  const pool = ACADEMY_NAMES[region] || ACADEMY_NAMES.england;
  let name = "";
  for (let t = 0; t < 60; t++) {
    const cand = pool.first[Math.floor(Math.random() * pool.first.length)] + " " +
                 pool.last[Math.floor(Math.random() * pool.last.length)];
    if (!Object.values(game.players).some(p => p.name === cand)) { name = cand; break; }
  }
  if (!name) name = pool.first[0] + " " + pool.last[0] + " Jr";
  const pos = ["GK", "DF", "DF", "MF", "MF", "MF", "FW", "FW"][Math.floor(Math.random() * 8)];
  const age = forcedAge || (17 + Math.floor(Math.random() * 5));
  const rating = Math.max(56, Math.min(90, baseRating));
  const id = game.playerSeq++;
  const p = { id, name, pos, age, rating, value: marketValue(rating, age, pos), club: clubName, league: club.league };
  game.players[id] = p;
  club.squad.push(id);
  return p;
}

// every season a fresh batch of ready to sign kids lands on the market:
// a few at 85 to 88, the rest 82 to 85, mostly at mid table selling clubs
// so the prices are reachable and the game never runs out of talent to chase
function spawnWonderkids(game) {
  const bigHomes = BIG_CLUBS.filter(c => game.clubs[c] && !humanOf(game, c) && game.clubs[c].squad.length < 30);
  const midHomes = [];
  for (const [name, club] of Object.entries(game.clubs)) {
    if (BIG_CLUBS.includes(name) || humanOf(game, name)) continue;
    if (!(LEAGUES[club.league] || {}).playable) continue;
    if (club.squad.length >= 30) continue;
    midHomes.push(name);
  }
  const count = 10 + Math.floor(Math.random() * 5);
  const names = [];
  for (let i = 0; i < count; i++) {
    const rating = i < 3 ? 85 + Math.floor(Math.random() * 4) : 82 + Math.floor(Math.random() * 4);
    const pool = (Math.random() < 0.7 && midHomes.length) ? midHomes : (bigHomes.length ? bigHomes : midHomes);
    if (!pool.length) break;
    const home = pool[Math.floor(Math.random() * pool.length)];
    if (game.clubs[home].squad.length >= 30) continue;
    const kid = spawnRegen(game, home, rating, 18 + Math.floor(Math.random() * 4));
    if (kid) {
      names.push(`${kid.name} (${kid.rating}, ${home})`);
      log(game, `WONDERKID: ${kid.name}, ${kid.age} years old and already rated ${kid.rating}, is at ${home} and open to offers.`);
    }
  }
  if (names.length) log(game, `WONDERKID WATCH: a new batch of ${names.length} young stars just hit the market. Use the wonderkids filter in the transfer market to find them.`);
}

function endOfSeason(game) {
  settleStaleShootouts(game);
  const champions = {};
  game.lastTables = {};
  const historyTables = {};
  const awards = {};
  for (const league of Object.keys(game.leagueFixtures)) {
    const table = tableFor(game, league);
    if (!table.length) continue;
    champions[league] = table[0].team;
    game.lastTables[league] = table.map(r => r.team);
    historyTables[league] = table.slice(0, 4).map(r => ({ team: r.team, pts: r.pts }));
    awards[league] = leagueAwards(game, league);
    const humanHere = table.some(r => humanOf(game, r.team));
    if (league === "Premier League" || humanHere) {
      const a = awards[league];
      log(game, `${league.toUpperCase()} SEASON ${game.season}: ${table[0].team} are champions!` +
        (a.boot ? ` Golden Boot: ${a.boot.name} (${a.boot.g}).` : "") +
        (a.ball ? ` Golden Ball: ${a.ball.name} (${a.ball.a} assists).` : "") +
        (a.pots ? ` Player of the Season: ${a.pots.name}.` : ""));
    }
  }
  const cups = game.cups || {};
  const cupWinners = {};
  for (const [k, c] of Object.entries(cups)) cupWinners[k] = { title: c.title, winner: c.winner };

  // budgets reset to keep it competitive: base money back, plus 10 for a league title and 5 per cup
  for (const club of Object.values(game.clubs)) {
    club.budget = club.baseBudget !== undefined ? club.baseBudget : club.budget;
  }
  for (const league of Object.keys(champions)) {
    const champ = game.clubs[champions[league]];
    if (champ) champ.budget = Math.round((champ.budget + 10) * 10) / 10;
  }
  for (const c of Object.values(cups)) {
    const wc = c.winner && game.clubs[c.winner];
    if (wc) wc.budget = Math.round((wc.budget + 5) * 10) / 10;
  }
  // merit money, same rules for humans and AI:
  // a) prize money by final position, b) a bonus for finishing above what
  // your budget says you should, so underdogs get real cash to reinvest
  for (const league of Object.keys(game.leagueFixtures)) {
    const table = tableFor(game, league);
    if (!table.length) continue;
    const byMoney = table.map(r => game.clubs[r.team]).filter(Boolean)
      .sort((a, b) => (b.baseBudget !== undefined ? b.baseBudget : b.budget) - (a.baseBudget !== undefined ? a.baseBudget : a.budget))
      .map(c => c.name);
    table.forEach((row, i) => {
      const club = game.clubs[row.team];
      if (!club) return;
      const posPrize = Math.round(Math.max(0, table.length - 1 - i) * 0.6 * 10) / 10;
      const budgetRank = byMoney.indexOf(row.team) + 1;
      const over = budgetRank > 0 ? Math.max(0, budgetRank - (i + 1)) : 0;
      const overBonus = Math.min(20, over * 2);
      club.budget = Math.round((club.budget + posPrize + overBonus) * 10) / 10;
      if (overBonus >= 8 && humanOf(game, row.team)) {
        log(game, `MERIT MONEY: ${row.team} finished ${i + 1} with the league's number ${budgetRank} budget. The board adds £${overBonus}m to the war chest.`);
      }
    });
  }

  game.history = game.history || [];
  game.history.push({
    season: game.season,
    champion: champions["Premier League"],
    champions,
    cupWinners,
    awards,
    eflCup: cups.efl ? cups.efl.winner : null,
    faCup: cups.fa ? cups.fa.winner : null,
    ucl: cups.ucl ? cups.ucl.winner : null,
    intl: cups.intl ? cups.intl.winner : null,
    table: tableFor(game, "Premier League").map(r => ({ team: r.team, pts: r.pts })),
    tables: historyTables
  });
  // loans come home before the new season, and the kids come back sharper
  for (const p of Object.values(game.players)) {
    if (!p.loanOwner) continue;
    const owner = game.clubs[p.loanOwner];
    const holder = game.clubs[p.club];
    if (owner && holder && p.club !== p.loanOwner) {
      holder.squad = holder.squad.filter(id => id !== p.id);
      stripFromLineup(holder, p.id);
      owner.squad.push(p.id);
      const grew = p.age <= 22;
      if (grew) p.rating = Math.min(96, p.rating + 1);
      if (humanOf(game, p.loanOwner) || humanOf(game, p.club)) {
        log(game, `LOAN OVER: ${p.name} returns to ${p.loanOwner}${grew ? " a better player for the minutes" : ""}.`);
      }
      p.club = p.loanOwner;
      p.league = owner.league;
    }
    delete p.loanOwner;
    delete p.loanFee;
  }
  // silverware buys patience, a bad season can cost you the job
  for (const u of Object.values(game.users)) {
    if (!u.team) continue;
    const club = game.clubs[u.team];
    if (club.conf === undefined) club.conf = 60;
    if (champions[club.league] === u.team) club.conf = Math.min(99, club.conf + 20);
    for (const c of Object.values(cups)) if (c.winner === u.team) club.conf = Math.min(99, club.conf + 10);
    if (club.conf < 25) {
      log(game, `SACKED: ${u.name} has been dismissed by ${u.team} after a season well below expectations. The board thanks them for their service.`);
      romano(game, `\ud83d\udea8 BREAKING: ${u.team} have SACKED manager ${u.name}! Statement out in the last minutes. The hunt for a new job starts now.`);
      u.team = null;
      u.sacked = true;
      club.conf = 60;
      club.trainFocus = null;
    } else {
      club.conf = Math.round(club.conf * 0.5 + 60 * 0.5);
    }
    club.trainGained = 0;
  }
  ensureRoles(game);
  log(game, `SEASON ${game.season} OVER. Budgets reset for everyone, title winners bank £10m and cup winners £5m each. New fixtures and cup draws are in.`);
  game.season++;
  // form resets for the new season, morale settles halfway, injury knocks are gone, travel starts over
  for (const p of Object.values(game.players)) { delete p.fm; if (p.mo) C.setMorale(p, p.mo / 2); delete p.ret; delete p.retN; delete p.ap; delete p.bn; }
  for (const c of Object.values(game.clubs)) { delete c.fx; if (c.travel) c.travel = { fund: 0, setup: false, policy: c.travel.policy || "standard", smart: !!c.travel.smart, trips: {} }; }
  game.round = 0;
  game.stats = {};

  // ageing: young players climb all the way to 35, then the drop starts
  for (const p of Object.values(game.players)) {
    p.age++;
    p.prodigyGains = 0;
    const roll = Math.random();
    if (p.prodigy && p.age <= 19) p.rating = Math.min(96, p.rating + (roll < 0.4 ? 5 : roll < 0.8 ? 4 : 3));
    else if (p.age <= 21) p.rating = Math.min(96, p.rating + (roll < 0.35 ? 3 : roll < 0.75 ? 2 : 1));
    else if (p.age <= 27) p.rating = Math.min(96, p.rating + (roll < 0.3 ? 2 : roll < 0.75 ? 1 : 0));
    else if (p.age <= 34) p.rating = Math.min(96, p.rating + (roll < 0.45 ? 1 : 0));
    else if (p.age === 35) { /* peak holds one last year */ }
    else p.rating = Math.max(52, p.rating - (roll < 0.35 ? 3 : 2));
    const nv = marketValue(p.rating, p.age, p.pos);
    // values climb season by season instead of teleporting, drops apply in full
    p.value = nv > p.value ? Math.min(nv, Math.round(p.value * 1.6 * 10) / 10) : nv;
  }

  // retirements make room, regens keep the world exciting
  let retired = 0, regens = 0;
  for (const club of Object.values(game.clubs)) {
    const leaving = club.squad.map(id => game.players[id]).filter(p => p && (p.age >= 39 || (p.age >= 37 && Math.random() < 0.5)));
    for (const p of leaving) {
      retired++;
      club.squad = club.squad.filter(id => id !== p.id);
      stripFromLineup(club, p.id);
      const wasStar = p.rating >= 84;
      if (humanOf(game, club.name) || wasStar) log(game, `RETIRED: ${p.name} (${p.club}) hangs up the boots at ${p.age}.`);
      delete game.players[p.id];
      const drop = p.rating >= 86 ? (2 + Math.floor(Math.random() * 5)) : (4 + Math.floor(Math.random() * 8));
      const newRating = Math.max(58, p.rating - drop);
      // regens never appear straight in a human squad, they join an AI club
      // in the same league instead. Human clubs grow talent through the academy.
      let home = club.name;
      if (humanOf(game, club.name)) {
        const aiSameLeague = leagueClubs(game, club.league).filter(n =>
          !humanOf(game, n) && game.clubs[n].squad.length < 30);
        if (!aiSameLeague.length) continue;
        home = aiSameLeague[Math.floor(Math.random() * aiSameLeague.length)];
      }
      const kid = spawnRegen(game, home, newRating);
      if (kid) {
        regens++;
        if (kid.rating >= 80) log(game, `REGEN: ${kid.name}, ${kid.age}, rated ${kid.rating}, breaks into the ${home} squad.`);
      }
    }
  }
  spawnWonderkids(game);
  // contracts never expire: a player stays until he is sold or loaned out
  // no club starts a season below strength: thin squads promote youth
  for (const [cname, club] of Object.entries(game.clubs)) {
    if (!(game.leagueFixtures || {})[club.league] && !(LEAGUES[club.league] || {}).playable) continue;
    let guardKid = 0;
    while (club.squad.length < 17 && guardKid < 8) {
      const kid = spawnRegen(game, cname, 60 + Math.floor(Math.random() * 8), 17 + Math.floor(Math.random() * 3));
      guardKid++;
      if (!kid) break;
      giveDefaultContract(kid);
      if (humanOf(game, cname)) log(game, `YOUTH PROMOTED: ${kid.name} (${kid.pos}, ${kid.rating}) steps up to the ${cname} first team to fill the gaps.`);
    }
  }
  for (const p of Object.values(game.players)) {
    if (p.club === "" && p.age >= 37) { delete game.players[p.id]; retired++; }
  }
  if (retired) log(game, `${retired} players retired this summer and ${regens} regens stepped up.`);

  // promotion and relegation: three down, three up, in every country with a second tier
  for (const [league, meta] of Object.entries(LEAGUES)) {
    if (!meta.playable || !meta.second || !game.leagueFixtures[league] || !game.leagueFixtures[meta.second]) continue;
    const topTable = tableFor(game, league);
    const lowTable = tableFor(game, meta.second);
    if (topTable.length < 6 || lowTable.length < 6) continue;
    const down = topTable.slice(-3).map(r => r.team);
    const up = lowTable.slice(0, 3).map(r => r.team);
    for (const name of down) {
      const c = game.clubs[name];
      if (!c) continue;
      c.league = meta.second;
      for (const id of c.squad) { const p = game.players[id]; if (p) p.league = meta.second; }
      for (const id of (c.academy || [])) { const p = game.players[id]; if (p) p.league = meta.second; }
      const hu = humanOf(game, name);
      if (hu) { c.conf = Math.max(5, (c.conf !== undefined ? c.conf : 60) - 10); }
      log(game, `RELEGATED: ${name} go down to the ${meta.second}.${hu ? " The board is furious." : ""}`);
    }
    for (const name of up) {
      const c = game.clubs[name];
      if (!c) continue;
      c.league = league;
      for (const id of c.squad) { const p = game.players[id]; if (p) p.league = league; }
      for (const id of (c.academy || [])) { const p = game.players[id]; if (p) p.league = league; }
      log(game, `PROMOTED: ${name} are going up to the ${league}!${humanOf(game, name) ? " What a season." : ""}`);
    }
    if (down.length) romano(game, `\ud83d\udcc9 Going down from the ${league}: ${down.join(", ")}. Coming up: ${up.join(", ")}. The market will move fast on relegated stars.`);
  }
  refreshNations(game);
  for (const league of Object.keys(game.leagueFixtures)) {
    game.leagueFixtures[league] = makeFixtures(leagueClubs(game, league));
  }
  game.cups = makeAllCups(game);
  refreshAcademies(game);
  ensureRoles(game);
}

// national squads get call ups from the league most of their players are in,
// so retirements never leave a country without a team
function refreshNations(game) {
  const taken = new Set();
  for (const n of Object.values(game.nations || {})) for (const id of n.playerIds) taken.add(id);
  for (const [name, nation] of Object.entries(game.nations || {})) {
    nation.playerIds = nation.playerIds.filter(id => game.players[id]);
    if (nation.playerIds.length >= 14) continue;
    const leagueCount = {};
    for (const id of nation.playerIds) {
      const p = game.players[id];
      if (p) leagueCount[p.league] = (leagueCount[p.league] || 0) + 1;
    }
    const homeLeague = Object.entries(leagueCount).sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || "Premier League";
    const candidates = Object.values(game.players)
      .filter(p => p.league === homeLeague && !taken.has(p.id) && !p.academy && p.age <= 33)
      .sort((a, b) => b.rating - a.rating);
    const before = nation.playerIds.length;
    for (const c of candidates) {
      if (nation.playerIds.length >= 16) break;
      nation.playerIds.push(c.id);
      taken.add(c.id);
    }
    const added = nation.playerIds.length - before;
    if (added > 0 && nation.manager) log(game, `${name} call up ${added} new players for the coming season.`);
  }
}

// ---------- API ----------
app.post("/api/create", (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 20);
  if (!name) return res.status(400).json({ error: "Enter a manager name." });
  const game = newGame(name);
  res.json({ code: game.code });
});

app.post("/api/join", (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 20);
  const game = games[String(req.body.code || "").toUpperCase()];
  if (!game) return res.status(404).json({ error: "Game not found. Check the code." });
  if (!name) return res.status(400).json({ error: "Enter a manager name." });
  if (!game.users[name]) {
    if (Object.keys(game.users).length >= 10) return res.status(400).json({ error: "Lobby is full." });
    game.users[name] = { name, team: null, nation: null };
    log(game, `${name} joined the game.`);
    save();
  }
  res.json({ code: game.code });
});

function migrate(game) {
  // keeps saves from the previous version of the game working on this server
  if (!game) return;
  if (!game.sport) game.sport = "football";
  if (game.totalRounds === undefined) game.totalRounds = TOTAL_ROUNDS;
  if (game.playerSeq === undefined) game.playerSeq = 100000;
  if (!game.lock) game.lock = { active: false, week: 0 };
  if (!game.nations) game.nations = {};
  if (!game.stats) game.stats = {};
  if (!game.romano) game.romano = [];
  if (!game.lastEvents) game.lastEvents = {};
  if (!game.reacts) game.reacts = [];
  if (!game.shootouts) game.shootouts = {};
  if (!game.plays) game.plays = {};
  ensureRoles(game);
  for (const u of Object.values(game.users || {})) if (u.sacked === undefined) u.sacked = false;
  for (const p of Object.values(game.players || {})) {
    if (PRODIGIES.has(p.name) && !p.prodigy) p.prodigy = true;
    if (!p.academy && p.contractYears === undefined) giveDefaultContract(p);
  }
  for (const c of Object.values(game.clubs || {})) if (c.baseBudget === undefined) c.baseBudget = c.budget;
  if (!game.cups) game.cups = {};
  for (const u of Object.values(game.users || {})) if (u.nation === undefined) u.nation = null;
  if (!game.leagueFixtures) {
    game.leagueFixtures = {};
    if (Array.isArray(game.fixtures) && game.fixtures.length) {
      game.leagueFixtures["Premier League"] = game.fixtures;
    } else {
      for (const league of Object.keys(LEAGUES)) {
        const names = leagueClubs(game, league);
        if (names.length >= 4 && names.length % 2 === 0) game.leagueFixtures[league] = makeFixtures(names);
      }
    }
  }
}

function getCtx(req, res) {
  const game = games[String(req.query.code || req.body.code || "").toUpperCase()];
  if (!game) { res.status(404).json({ error: "Game not found." }); return null; }
  if (game.sport === "basketball") { res.status(400).json({ error: "Basketball has moved to its own game. This server is football only now." }); return null; }
  migrate(game);
  const name = String(req.query.name || req.body.name || "");
  const user = game.users[name];
  if (!user) { res.status(403).json({ error: "You are not in this game." }); return null; }
  return { game, user };
}

app.post("/api/pick", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (game.started && user.team) return res.status(400).json({ error: "Season already started. You can only take a new job if you lose yours." });
  const team = req.body.team;
  const club = game.clubs[team];
  if (!club || !(LEAGUES[club.league] || {}).playable) return res.status(400).json({ error: "Pick a club from one of the playable leagues." });
  if (humanOf(game, team) && humanOf(game, team).name !== user.name) return res.status(400).json({ error: "That club is taken." });
  user.team = team;
  club.conf = user.sacked ? 55 : (club.conf !== undefined ? club.conf : 60);
  user.sacked = false;
  spawnAcademy(game, team);
  log(game, game.started ? `NEW JOB: ${user.name} takes over at ${team} with the season already rolling.` : `${user.name} will manage ${team}.`);
  save();
  res.json({ ok: true });
});

app.post("/api/nation", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const nation = req.body.nation;
  if (!nation) {
    if (user.nation && game.nations[user.nation]) game.nations[user.nation].manager = null;
    user.nation = null;
    save();
    return res.json({ ok: true });
  }
  const n = (game.nations || {})[nation];
  if (!n) return res.status(400).json({ error: "That national team is not in this game." });
  if (n.manager && n.manager !== user.name) return res.status(400).json({ error: "That national job is taken." });
  if (user.nation && game.nations[user.nation]) game.nations[user.nation].manager = null;
  n.manager = user.name;
  user.nation = nation;
  log(game, `${user.name} takes the ${nation} national team job.`);
  save();
  res.json({ ok: true });
});

app.post("/api/start", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (user.name !== game.host) return res.status(403).json({ error: "Only the host can kick off." });
  if (!Object.values(game.users).every(u => u.team)) return res.status(400).json({ error: "Everyone needs to pick a club first." });
  game.started = true;
  for (const u of Object.values(game.users)) if (u.team && game.clubs[u.team]) { const tv = clubTravel(game.clubs[u.team]); tv.setup = false; tv.fund = 0; tv.trips = {}; }
  log(game, `Season ${game.season} is underway across all leagues. Unpicked clubs run on AI.`);
  save();
  res.json({ ok: true });
});

app.post("/api/tactic", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!TACTICS.includes(req.body.tactic)) return res.status(400).json({ error: "Unknown tactic." });
  game.clubs[user.team].tactic = req.body.tactic;
  save();
  res.json({ ok: true });
});

app.post("/api/lineup", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const xi = (Array.isArray(req.body.xi) ? req.body.xi : []).map(Number);
  const subs = (Array.isArray(req.body.subs) ? req.body.subs : []).map(Number);
  if (xi.length !== 11) return res.status(400).json({ error: "Pick exactly 11 starters." });
  if (subs.length > 9) return res.status(400).json({ error: "Max 9 subs." });
  if (new Set([...xi, ...subs]).size !== xi.length + subs.length) return res.status(400).json({ error: "A player can only be picked once." });
  const squad = new Set(game.clubs[user.team].squad);
  for (const id of [...xi, ...subs]) {
    if (!squad.has(id) || !game.players[id]) return res.status(400).json({ error: "One of those players is not in your squad." });
  }
  const gks = xi.filter(id => game.players[id].pos === "GK").length;
  if (gks !== 1) return res.status(400).json({ error: "You need exactly one goalkeeper in the starting XI." });
  const FORMS = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1", "3-4-3"];
  const formation = FORMS.includes(req.body.formation) ? req.body.formation : "4-3-3";
  game.clubs[user.team].lineup = { xi, subs, formation };
  save();
  res.json({ ok: true });
});

app.post("/api/promote", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const club = game.clubs[user.team];
  const id = Number(req.body.playerId);
  const p = game.players[id];
  if (!p || !p.academy || !club.academy || !club.academy.includes(id)) return res.status(400).json({ error: "That player is not in your academy." });
  if (club.squad.length >= 30) return res.status(400).json({ error: "Squad is full (30 max). Sell someone first." });
  p.academy = false;
  club.academy = club.academy.filter(x => x !== id);
  club.squad.push(id);
  log(game, `${p.name} (${p.age}) has been promoted from the ${user.team} academy to the first team!`);
  save();
  res.json({ ok: true });
});

function pickWeighted(list, weights) {
  let total = 0;
  const w = list.map(p => { const x = weights[p.pos] || 1; total += x; return x; });
  let roll = Math.random() * total;
  for (let i = 0; i < list.length; i++) { roll -= w[i]; if (roll <= 0) return list[i]; }
  return list[list.length - 1];
}

function recordScorers(game, match, league, keepEvents, xis) {
  game.stats = game.stats || {};
  const scoreW = { FW: 6, MF: 3, DF: 1, GK: 0.05 };
  const assistW = { FW: 3, MF: 5, DF: 1.5, GK: 0.2 };
  const ev = [];
  const contrib = {};
  for (const side of ["home", "away"]) {
    const clubName = match[side];
    const club = game.clubs[clubName];
    if (!club) continue;
    const goals = side === "home" ? match.hg : match.ag;
    if (!goals) continue;
    const xi = chosenXI(game, clubName).filter(Boolean);
    if (!xi.length) continue;
    for (let g = 0; g < goals; g++) {
      const scorer = pickWeighted(xi, scoreW);
      const st = game.stats[scorer.id] = game.stats[scorer.id] || { g: 0, a: 0 };
      st.g++;
      contrib[scorer.id] = (contrib[scorer.id] || 0) + 3;
      ev.push({ n: scorer.name, c: clubName, min: 2 + Math.floor(Math.random() * 89) });
      if (Math.random() < 0.72) {
        const others = xi.filter(p => p.id !== scorer.id);
        const assister = pickWeighted(others, assistW);
        const sa = game.stats[assister.id] = game.stats[assister.id] || { g: 0, a: 0 };
        sa.a++;
        contrib[assister.id] = (contrib[assister.id] || 0) + 2;
      }
    }
  }
  if (keepEvents) {
    ev.sort((a, b) => a.min - b.min);
    let potm = null;
    const ids = Object.keys(contrib);
    if (ids.length) {
      const best = ids.sort((a, b) => contrib[b] - contrib[a])[0];
      const bp = game.players[best];
      if (bp) potm = { n: bp.name, c: bp.club };
    } else {
      const winName = match.hg > match.ag ? match.home : match.hg < match.ag ? match.away : (Math.random() < 0.5 ? match.home : match.away);
      const xi = chosenXI(game, winName).filter(Boolean);
      const gk = xi.find(p => p.pos === "GK") || xi[0];
      if (gk) potm = { n: gk.name, c: winName };
    }
    const subs = [];
    for (const side of ["home", "away"]) for (const sb of ((xis && xis.subs && xis.subs[side]) || [])) subs.push({ n: sb.on.name, off: sb.off.name, c: match[side], min: sb.min });
    subs.sort((a, b) => a.min - b.min);
    game.lastEvents[match.home + "|" + match.away] = { ev, potm, subs };
  }
}

// same picker for cup ties, display only, no stat changes
function cupEvents(game, match) {
  const scoreW = { FW: 6, MF: 3, DF: 1, GK: 0.05 };
  const ev = [];
  let star = null, starClub = null;
  for (const side of ["home", "away"]) {
    const clubName = match[side];
    const goals = side === "home" ? match.hg : match.ag;
    if (!goals || !game.clubs[clubName]) continue;
    const xi = chosenXI(game, clubName).filter(Boolean);
    if (!xi.length) continue;
    for (let g = 0; g < goals; g++) {
      const scorer = pickWeighted(xi, scoreW);
      ev.push({ n: scorer.name, c: clubName, min: 2 + Math.floor(Math.random() * 89) });
      if (!star || Math.random() < 0.4) { star = scorer.name; starClub = clubName; }
    }
  }
  ev.sort((a, b) => a.min - b.min);
  game.lastEvents[match.home + "|" + match.away] = { ev, potm: star ? { n: star, c: starClub } : null };
}

// ---------- playable matches ----------
// A manager can play their own fixture in the browser before the host sims the week.
// The final score is parked in game.plays and the sim uses it in place of a generated one.
const MAX_PLAY_GOALS = 12;
function xiRating(game, team) {
  const xi = chosenXI(game, team).filter(Boolean);
  return xi.length ? Math.round(xi.reduce((s, p) => s + p.rating, 0) / xi.length * 10) / 10 : 60;
}

function playableFixtures(game, user) {
  const out = [];
  if (!game.started || !user.team || !game.clubs[user.team]) return out;
  if (game.round >= (game.totalRounds || 38)) return out;
  const me = user.team;
  const add = (kind, label, m) => {
    const rival = humanOf(game, m.home === me ? m.away : m.home);
    out.push({
      kind, label, home: m.home, away: m.away, side: m.home === me ? "home" : "away",
      homeRating: xiRating(game, m.home), awayRating: xiRating(game, m.away),
      blocked: rival ? "This one is against " + rival.name + ", another manager, so it gets simmed to keep it fair." : null
    });
  };
  const league = game.clubs[me].league;
  const lm = (((game.leagueFixtures || {})[league] || [])[game.round] || []).find(m => m.home === me || m.away === me);
  if (lm && lm.hg === null) add("league", league + ", week " + (game.round + 1), lm);
  for (const cup of Object.values(game.cups || {})) {
    if (cup.winner || cup.scope === "intl") continue;
    if (cup.weeks[cup.roundIdx] !== game.round + 1) continue;
    const ties = cup.rounds[cup.roundIdx] || [];
    const cm = ties.find(m => m.home === me || m.away === me);
    if (!cm || !cm.away || cm.hg !== null || !game.clubs[cm.home] || !game.clubs[cm.away]) continue;
    add(cup.key, cup.title + ", " + ((cup.roundNames && cup.roundNames[cup.roundIdx]) || nameForMatches(ties.length)), cm);
  }
  return out;
}

// true when this pairing is one of the manager's fixtures that already has a simmed score
function alreadySimmed(game, user, home, away) {
  const hit = m => m.home === home && m.away === away && m.hg !== null && m.hg !== undefined;
  const league = (game.clubs[user.team] || {}).league;
  if ((((game.leagueFixtures || {})[league]) || []).slice(0, game.round).some(r => r.some(hit))) return true;
  return Object.values(game.cups || {}).some(c => (c.rounds || []).some(r => r.some(hit)));
}

function currentPlay(game, user) {
  const p = (game.plays || {})[user.name];
  return p && p.season === game.season && p.round === game.round ? p : null;
}

// swaps the generated score for the one a manager actually played, if there is one
function usePlayedScore(game, m, kind, round) {
  for (const p of Object.values(game.plays || {})) {
    if (p.status !== "done" || p.season !== game.season || p.round !== round || p.kind !== kind) continue;
    if (p.home !== m.home || p.away !== m.away) continue;
    m.hg = p.hg;
    m.ag = p.ag;
    m.played = p.user;
    log(game, `PLAYED LIVE: ${p.user} played ${m.home} ${m.hg}-${m.ag} ${m.away} on the pitch.`);
    return true;
  }
  return false;
}

function playMatchweek(game) {
  const wasOpen = windowOpen(game);
  const humanLeagues = new Set(Object.values(game.users).filter(u => u.team && game.clubs[u.team]).map(u => game.clubs[u.team].league));
  game.lastEvents = {};
  for (const [league, fixtures] of Object.entries(game.leagueFixtures)) {
    const round = fixtures[game.round];
    if (!round) continue;
    if (humanLeagues.has(league)) {
      for (const m of round) {
        if (isDerby(m.home, m.away) && (humanOf(game, m.home) || humanOf(game, m.away))) {
          romano(game, `\ud83d\udd25 DERBY WEEK: ${m.home} against ${m.away}. Form goes out the window, careers are made in games like this.`);
        }
      }
    }
    for (const m of round) {
      const xis = simMatch(game, m, "L", game.round);
      usePlayedScore(game, m, "league", game.round);
      afterResult(game, m, xis, "L");
      recordScorers(game, m, league, humanLeagues.has(league), xis);
    }
    if (humanLeagues.has(league)) {
      log(game, `${league.toUpperCase()} WEEK ${game.round + 1}: ` + round.map(m => `${m.home} ${m.hg}-${m.ag} ${m.away}`).join(" | "));
      for (const m of round) {
        if (isDerby(m.home, m.away)) {
          const line = m.hg === m.ag ? "honours even, nobody gets the bragging rights" : `${m.hg > m.ag ? m.home : m.away} take the bragging rights`;
          log(game, `DERBY: ${m.home} ${m.hg}-${m.ag} ${m.away}, ${line}.`);
        }
      }
    }
  }
  game.round++;
  weeklyCondition(game);
  // players heal and bans get served, then the new knocks come in
  for (const p of Object.values(game.players)) {
    if (p.inj > 0) {
      p.inj--;
      if (p.inj === 0) {
        C.startInjuryReturn(p, !!((game.clubs[p.club] || {}).staff || {}).physio);
        if (humanOf(game, p.club)) log(game, `${p.name} (${p.club}) is back from injury and available again. He carries a knock for a few weeks while he gets up to speed.`);
      }
    }
    if (p.ban > 0) p.ban--;
    if (p.prodigy && p.age <= 19 && p.rating < 90 && !(p.inj > 0) && (p.prodigyGains || 0) < 3) {
      const onDevLoan = p.loanOwner && p.loanOwner !== p.club;
      if (Math.random() < (onDevLoan ? 0.12 : 0.08)) {
        p.rating++;
        p.prodigyGains = (p.prodigyGains || 0) + 1;
        p.value = Math.max(p.value, marketValue(p.rating, p.age, p.pos));
        if (humanOf(game, p.club) || (p.loanOwner && humanOf(game, p.loanOwner))) {
          log(game, `WONDERKID WATCH: ${p.name} (${p.club}) keeps growing week by week. Now rated ${p.rating} at ${p.age}.`);
        }
      }
    }
  }
  for (const [name, club] of Object.entries(game.clubs)) {
    if (!(LEAGUES[club.league] || {}).playable && !humanOf(game, name)) continue;
    const seniors = club.squad.map(id => game.players[id]).filter(p => p && !p.academy && !(p.inj > 0) && !(p.ban > 0));
    if (!seniors.length) continue;
    if (Math.random() < 0.08) {
      const p = seniors[Math.floor(Math.random() * seniors.length)];
      const longKnock = Math.random() < 0.15;
      p.inj = longKnock ? ((club.staff || {}).physio ? 3 : 3 + Math.floor(Math.random() * 3)) : ((club.staff || {}).physio ? 1 : (1 + (Math.random() < 0.45 ? 1 : 0)));
      if (humanOf(game, name)) {
        log(game, `INJURY: ${p.name} (${name}) is out for ${p.inj} week${p.inj > 1 ? "s" : ""}.`);
      }
    }
    if (Math.random() < 0.035) {
      const p2 = seniors[Math.floor(Math.random() * seniors.length)];
      if (!(p2.inj > 0)) {
        p2.ban = 1;
        for (const [key, entry] of Object.entries(game.lastEvents || {})) {
          const [h, a] = key.split("|");
          if (h === name || a === name) {
            entry.ev.push({ n: p2.name, c: name, min: 30 + Math.floor(Math.random() * 61), red: true });
            entry.ev.sort((x, y) => x.min - y.min);
            break;
          }
        }
        if (humanOf(game, name)) log(game, `RED CARD: ${p2.name} (${name}) is suspended for the next match.`);
      }
    }
  }
  // training focus: three good weeks on the grass earns a point of rating
  for (const u of Object.values(game.users)) {
    if (!u.team) continue;
    const club = game.clubs[u.team];
    const fp = club && club.trainFocus !== undefined && club.trainFocus !== null ? game.players[club.trainFocus] : null;
    if (!fp || fp.club !== u.team) { if (club) club.trainFocus = null; continue; }
    if (fp.inj > 0) continue;
    fp.trainPts = (fp.trainPts || 0) + 1;
    if (fp.trainPts >= 3 && (club.trainGained || 0) < 3 && fp.rating < 94) {
      fp.trainPts = 0;
      fp.rating++;
      club.trainGained = (club.trainGained || 0) + 1;
      fp.value = Math.max(fp.value, marketValue(fp.rating, fp.age, fp.pos));
      log(game, `TRAINING: ${fp.name} (${u.team}) hits a new level after weeks of extra sessions. Now rated ${fp.rating}.`);
    }
  }
  // board confidence moves with results against what the budget says you should do
  for (const u of Object.values(game.users)) {
    if (!u.team) continue;
    const club = game.clubs[u.team];
    if (club.conf === undefined) club.conf = 60;
    const round = (game.leagueFixtures[club.league] || [])[game.round - 1] || [];
    const m = round.find(x => x.home === u.team || x.away === u.team);
    if (m && m.hg !== null) {
      const myG = m.home === u.team ? m.hg : m.ag;
      const opG = m.home === u.team ? m.ag : m.hg;
      const derbySwing = isDerby(m.home, m.away) ? 2 : 1;
      club.conf += (myG > opG ? 3 : myG === opG ? 1 : -3) * derbySwing;
    }
    const table = tableFor(game, club.league);
    const pos = table.findIndex(r => r.team === u.team) + 1;
    const budgetRank = leagueClubs(game, club.league)
      .map(n => game.clubs[n])
      .sort((a, b) => (b.baseBudget !== undefined ? b.baseBudget : b.budget) - (a.baseBudget !== undefined ? a.baseBudget : a.budget))
      .findIndex(c => c.name === u.team) + 1;
    if (pos > 0 && budgetRank > 0) {
      if (pos <= budgetRank) club.conf += 1;
      else if (pos > budgetRank + 5) club.conf -= 1;
    }
    club.conf = Math.max(5, Math.min(99, club.conf));
    if (club.conf <= 20 && game.round % 6 === 0) log(game, `BOARD WATCH: pressure is building on ${u.name} at ${u.team}. The board expected better.`);
  }
  const playedWeek = game.round;
  simCupsForWeek(game);
  completePendingDeals(game);
  aiAnswerCounters(game);
  aiInboundBids(game);
  aiLoanRequestsToHumans(game);
  aiToAiTransfers(game);
  aiLoans(game);
  if (windowOpen(game)) {
    const doneThisWeek = (game.offers || []).filter(o => o.status === "accepted" && o.week === game.round).length;
    if (doneThisWeek >= 3) romano(game, `🗞️ Window pulse: ${doneThisWeek} deals over the line this week and the phones are still hot. More to come.`);
  }
  aiFreeAgentSignings(game);
  if (game.round >= (game.totalRounds || 38)) log(game, `SEASON ${game.season}: that was the final matchweek. Awards are in the Tables tab. The host can start the next season when everyone is ready.`);
  const isOpen = windowOpen(game);
  if (game.windowWasOpen === true && !isOpen) romano(game, `⏳ The transfer window has SLAMMED SHUT. No more deals until it reopens. Time to judge every club's business.`);
  if (game.windowWasOpen === false && isOpen) romano(game, `🚨 The transfer window is officially OPEN! Expect a crazy few weeks, clubs are already working on their targets.`);
  if (deadlineDay(game)) {
    romano(game, `\u23f0 IT IS DEADLINE DAY! One week left in the window. Faxes warming up, private jets on standby, expect absolute chaos before it SLAMS SHUT.`);
    log(game, "DEADLINE DAY: last week of the window. Get your business done or wait months.");
  }
  game.windowWasOpen = isOpen;
  if (wasOpen && !isOpen) log(game, "The transfer window has SLAMMED SHUT. No deals until it reopens.");
  if (!wasOpen && isOpen) log(game, "The transfer window is OPEN. Get your deals done.");
  game.lock = { active: true, week: playedWeek };
  // played scores only ever count for the week they were played in
  game.plays = {};
}

app.post("/api/sim", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (user.name !== game.host) return res.status(403).json({ error: "Only the host can sim the matchweek." });
  if (!game.started) return res.status(400).json({ error: "Start the season first." });
  if (game.round >= (game.totalRounds || 38)) return res.status(400).json({ error: "The season is over. Check the final tables and awards, then press Start next season." });
  playMatchweek(game);
  save();
  res.json({ ok: true });
});

// Sim Season runs every remaining week in order through all the systems (form, morale, events, travel
// bookings by each manager's policy), so the end state is the same as pressing Play matchweek each time.
app.post("/api/simseason", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (user.name !== game.host) return res.status(403).json({ error: "Only the host can sim the season." });
  if (!game.started) return res.status(400).json({ error: "Start the season first." });
  const total = game.totalRounds || 38;
  if (game.round >= total) return res.status(400).json({ error: "The season is over. Check the final tables and awards, then press Start next season." });
  const from = game.round + 1;
  let guard = 0;
  while (game.round < total && guard < 60) {
    playMatchweek(game);
    guard++;
  }
  log(game, "SIM SEASON: the host simmed from week " + from + " to the end of the season.");
  save();
  res.json({ ok: true, round: game.round });
});

// ---------- travel: the fund, the planner and the bookings ----------
function travelPlan(game, user) {
  const club = user.team ? game.clubs[user.team] : null;
  if (!club || !game.started) return null;
  const tv = clubTravel(club);
  const home = geo(club.name);
  const trips = [];
  const fixtures = (game.leagueFixtures || {})[club.league] || [];
  fixtures.forEach((round, i) => {
    const m = round.find(x => x.away === club.name);
    if (m) trips.push({ id: tripId("L", i), kind: "league", week: i + 1, label: "League, week " + (i + 1), opp: m.home, done: i < game.round || m.hg !== null });
  });
  for (const cup of Object.values(game.cups || {})) {
    if (cup.scope === "nation") continue;
    cup.rounds.forEach((ms, ri) => {
      const m = ms.find(x => x.away === club.name);
      if (!m) return;
      const wk = cup.weeks[ri];
      trips.push({ id: tripId(cup.key, wk), kind: cup.key, week: wk + 1, label: cup.title + ", " + ((cup.roundNames && cup.roundNames[ri]) || nameForMatches(ms.length)), opp: m.home, done: wk < game.round || m.hg !== null, cup: true });
    });
  }
  trips.sort((a, b) => a.week - b.week);
  for (const t of trips) {
    const g = geo(t.opp);
    const km = tripKm(club.name, t.opp);
    t.km = km;
    t.city = g ? g.city : t.opp;
    t.country = g ? g.country : "";
    t.airport = g ? g.airport : "";
    t.hotels = g ? g.hotels : ["budget", "standard", "luxury"];
    t.transport = C.transportOptions(km);
    t.hotelOptions = C.hotelOptions(km, t.hotels);
    t.hard = Math.round(clubStrength(game, t.opp));
    t.booked = tv.trips[t.id] || null;
    if (t.booked) { t.price = C.tripPrice(km, t.booked); t.mod = C.tripModifier(km, t.booked); }
  }
  const open = trips.filter(t => !t.done);
  return {
    fund: tv.fund, setup: !!tv.setup, policy: tv.policy || "standard", home: home ? home.city + ", " + home.country : club.name,
    advice: C.recommendFund(club.budget, open), unbooked: open.filter(t => !t.booked).length, trips
  };
}

app.post("/api/travelfund", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!game.started) return res.status(400).json({ error: "The travel fund is set once the season starts." });
  const club = game.clubs[user.team];
  const tv = clubTravel(club);
  if (tv.setup) return res.status(400).json({ error: "The travel fund is already set for this season." });
  const amount = Math.round(Number(req.body.amount) * 10) / 10;
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Enter an amount in millions." });
  if (amount > club.budget) return res.status(400).json({ error: "You only have " + club.budget + "m in the budget." });
  club.budget = Math.round((club.budget - amount) * 10) / 10;
  tv.fund = C.r3(amount);
  tv.setup = true;
  log(game, `TRAVEL: ${user.team} set aside £${amount}m for travel this season. It comes out of the transfer budget.`);
  save();
  res.json({ ok: true, fund: tv.fund, budget: club.budget });
});

// bookings: { tripId: { t: transport key, h: hotel key } }. Changing a booking refunds the old one first.
// policy: cheap, standard, luxury or smart, used for trips the manager never booked when a week is simmed.
app.post("/api/travelbook", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const plan = travelPlan(game, user);
  if (!plan) return res.status(400).json({ error: "The planner opens once the season starts." });
  const club = game.clubs[user.team];
  const tv = clubTravel(club);
  if (req.body.policy !== undefined) {
    if (!["cheap", "standard", "luxury", "smart"].includes(req.body.policy)) return res.status(400).json({ error: "Pick cheap, standard, luxury or smart." });
    tv.policy = req.body.policy === "smart" ? "standard" : req.body.policy;
    tv.smart = req.body.policy === "smart";
  }
  // bulk: cheap, standard, luxury or smart books every trip still to come in one go, refunding what was booked
  const bookings = Object.assign({}, req.body.bookings || {});
  let fund = tv.fund;
  const next = Object.assign({}, tv.trips);
  if (req.body.bulk) {
    if (!["cheap", "standard", "luxury", "smart"].includes(req.body.bulk)) return res.status(400).json({ error: "Pick cheap, standard, luxury or smart." });
    const open = plan.trips.filter(t => !t.done);
    for (const t of open) { if (next[t.id]) { fund = C.r3(fund + C.tripPrice(t.km, next[t.id])); delete next[t.id]; } }
    if (req.body.bulk === "smart") {
      const sf = C.smartFill(open.map(t => ({ id: t.id, km: t.km, hard: t.hard })), fund);
      for (const t of open) bookings[t.id] = sf.bookings[t.id];
    } else {
      // the plain policies drop the latest trips to cheap if the fund cannot cover them all
      let left = fund;
      const picks = open.map(t => ({ t, bk: C.policyBooking(t.km, req.body.bulk) }));
      for (const p of picks) left -= C.tripPrice(p.t.km, p.bk);
      for (let i = picks.length - 1; i >= 0 && left < -1e-9; i--) { const cheap = C.policyBooking(picks[i].t.km, "cheap"); left += C.tripPrice(picks[i].t.km, picks[i].bk) - C.tripPrice(picks[i].t.km, cheap); picks[i].bk = cheap; }
      if (left < -1e-9) return res.status(400).json({ error: "The travel fund cannot cover even the cheapest trips. Top it up next season or let the cheapest option carry you." });
      for (const p of picks) bookings[p.t.id] = p.bk;
    }
    tv.policy = req.body.bulk === "smart" ? "standard" : req.body.bulk;
    tv.smart = req.body.bulk === "smart";
  }
  for (const [id, bk] of Object.entries(bookings)) {
    const t = plan.trips.find(x => x.id === id);
    if (!t) return res.status(400).json({ error: "No trip called " + id + "." });
    if (t.done) return res.status(400).json({ error: "The trip to " + t.opp + " has already happened." });
    if (!bk || !t.transport.some(o => o.key === bk.t) || !t.hotelOptions.some(o => o.key === bk.h)) return res.status(400).json({ error: "Pick a transport option and a hotel for " + t.opp + "." });
    const old = next[id] ? C.tripPrice(t.km, next[id]) : 0;
    const price = C.tripPrice(t.km, { t: bk.t, h: bk.h });
    fund = C.r3(fund + old - price);
    if (fund < -1e-9) return res.status(400).json({ error: "The travel fund cannot cover that. You have £" + tv.fund + "m left." });
    next[id] = { t: bk.t, h: bk.h };
  }
  tv.trips = next;
  tv.fund = C.r3(Math.max(0, fund));
  save();
  res.json({ ok: true, fund: tv.fund, policy: tv.smart ? "smart" : tv.policy });
});

app.post("/api/playstart", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!game.started) return res.status(400).json({ error: "The season has not started yet." });
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const prev = currentPlay(game, user);
  if (prev) {
    return res.status(400).json({ error: prev.status === "done"
      ? "You already played your match this week. One match per week."
      : "You already kicked off a match this week. A match you leave gets simmed like normal." });
  }
  const kind = String(req.body.kind || "league");
  const fx = playableFixtures(game, user).find(f => f.kind === kind);
  if (!fx) return res.status(400).json({ error: "You have no match like that to play this week." });
  if (fx.blocked) return res.status(400).json({ error: fx.blocked });
  // the page says which fixture it is showing, so a stale page can never kick off next week's game by mistake
  if (req.body.home !== undefined && (req.body.home !== fx.home || req.body.away !== fx.away)) {
    return res.status(400).json({ error: "The host has simmed this week, your match was decided by the sim." });
  }
  game.plays[user.name] = {
    user: user.name, season: game.season, round: game.round, kind: fx.kind,
    home: fx.home, away: fx.away, status: "started", hg: null, ag: null, t: Date.now()
  };
  // the playable match uses the same effective OVRs as the sim would for this fixture
  const cupKey = fx.kind === "league" ? "L" : fx.kind;
  const mm = { home: fx.home, away: fx.away };
  const rowFor = (team, home) => p => ({ n: p.name, pos: p.pos, role: p.role || p.pos, r: Math.round(effOf(game, p, team, { home, m: mm, kind: cupKey, week: game.round })), base: p.rating });
  save();
  res.json({
    ok: true, kind: fx.kind, label: fx.label, home: fx.home, away: fx.away, side: fx.side,
    homeRating: fx.homeRating, awayRating: fx.awayRating,
    homeXI: chosenXI(game, fx.home).filter(Boolean).map(rowFor(fx.home, true)),
    awayXI: chosenXI(game, fx.away).filter(Boolean).map(rowFor(fx.away, false))
  });
});

app.post("/api/playresult", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!game.started) return res.status(400).json({ error: "The season has not started yet." });
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const home = String(req.body.home || ""), away = String(req.body.away || "");
  const fx = playableFixtures(game, user).find(f => f.home === home && f.away === away && (!req.body.kind || f.kind === req.body.kind));
  if (!fx) {
    // the round has moved past this fixture: the sim already decided it and a late score never replaces that
    const mineAndSimmed = (home === user.team || away === user.team) && alreadySimmed(game, user, home, away);
    return res.status(400).json({ error: mineAndSimmed
      ? "The host has simmed this week, your match was decided by the sim."
      : "That is not your match for this week." });
  }
  if (fx.blocked) return res.status(400).json({ error: fx.blocked });
  const play = currentPlay(game, user);
  if (play && play.status === "done") return res.status(400).json({ error: "You already played your match this week. One match per week." });
  if (!play || play.kind !== fx.kind || play.home !== home || play.away !== away) return res.status(400).json({ error: "Kick off the match first." });
  const hg = req.body.hg, ag = req.body.ag;
  if (!Number.isInteger(hg) || !Number.isInteger(ag) || hg < 0 || ag < 0 || hg > MAX_PLAY_GOALS || ag > MAX_PLAY_GOALS) {
    return res.status(400).json({ error: "That score does not look right. A played match can have at most " + MAX_PLAY_GOALS + " goals a side." });
  }
  play.status = "done";
  play.hg = hg;
  play.ag = ag;
  log(game, `${user.name} just played their ${fx.label} match on the pitch. The score lands when the week is simmed.`);
  save();
  res.json({ ok: true, message: `Saved. ${home} ${hg}-${ag} ${away} is locked in and counts when the host sims the week.` });
});

app.post("/api/nextseason", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (user.name !== game.host) return res.status(403).json({ error: "Only the host can start the next season." });
  if (!game.started) return res.status(400).json({ error: "Start the first season first." });
  if (game.round < (game.totalRounds || 38)) return res.status(400).json({ error: "The season isn't finished yet." });
  endOfSeason(game);
  game.lock = { active: false, week: 0 };
  save();
  res.json({ ok: true });
});


app.post("/api/unlock", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (user.name !== game.host) return res.status(403).json({ error: "Only the host can send everyone back." });
  game.lock = { active: false, week: game.lock ? game.lock.week : 0 };
  save();
  res.json({ ok: true });
});

app.post("/api/offer", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!windowOpen(game)) return res.status(400).json({ error: "The transfer window is shut. No new bids until it reopens." });
  const p = game.players[req.body.playerId];
  const fee = Math.round(Number(req.body.fee) * 10) / 10;
  if (!p) return res.status(400).json({ error: "Player not found." });
  if (p.club === "") return res.status(400).json({ error: "He is a free agent. Sign him for nothing from the free agents list in the Market tab." });
  if (p.academy) return res.status(400).json({ error: "Academy players can't be bought. Their club has to promote them first." });
  if (p.loanOwner) return res.status(400).json({ error: "He is on loan. His parent club won't sell him mid loan." });
  if (p.club === user.team) return res.status(400).json({ error: "He already plays for you." });
  if (!(fee > 0)) return res.status(400).json({ error: "Enter a fee." });
  if (fee > game.clubs[user.team].budget) return res.status(400).json({ error: "That bid is over your budget." });
  if (game.clubs[p.club].squad.length <= 12) return res.status(400).json({ error: `${p.club} refuse to sell. Their squad is too thin.` });
  const offer = {
    id: game.offerSeq++, playerId: p.id, toClub: user.team, sellerClub: p.club,
    fee, week: game.round, direction: "outbound", buyerUser: user.name
  };
  const sellerHuman = humanOf(game, p.club);
  if (req.body.swapId !== undefined && req.body.swapId !== null && req.body.swapId !== "") {
    const sw = game.players[Number(req.body.swapId)];
    if (!sw || sw.club !== user.team) return res.status(400).json({ error: "Pick one of your own players for the swap." });
    if (sw.academy || sw.loanOwner) return res.status(400).json({ error: "That player can't go in a swap." });
    if (sw.id === p.id) return res.status(400).json({ error: "You can't swap a player for himself." });
    offer.swapId = sw.id;
    offer.swapName = sw.name;
    offer.swapRating = sw.rating;
    offer.swapValue = sw.value;
  }
  if (sellerHuman) {
    offer.status = "pending_seller";
    log(game, `${user.team} have bid £${fee}m${offer.swapName ? " plus " + offer.swapName : ""} for ${p.name} (${p.club}).`);
    romano(game, `🚨 EXCLUSIVE: ${user.team} have submitted an official bid for ${p.name}, around ${fmtFee(fee)}${offer.swapName ? " plus " + offer.swapName + " in a proposed swap" : ""} on the table. ${p.club} are now internally discussing the proposal. More to follow.`);
  } else {
    resolveAiSellerOffer(game, offer);
  }
  game.offers.unshift(offer);
  game.offers = game.offers.slice(0, 200);
  save();
  res.json({ ok: true, offer });
});

app.post("/api/hijack", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!windowOpen(game)) return res.status(400).json({ error: "The transfer window is shut. No hijacking until it reopens." });
  const p = game.players[req.body.playerId];
  if (!p) return res.status(400).json({ error: "Player not found." });
  if (p.club === user.team) return res.status(400).json({ error: "He already plays for you." });
  if (p.academy || p.loanOwner || p.club === "") return res.status(400).json({ error: "That deal cannot be hijacked." });
  const price = hijackPrice(game, p, user.team);
  if (price === null) return res.status(400).json({ error: "Nobody is negotiating for him right now. Just make a normal bid." });
  const club = game.clubs[user.team];
  if (price > club.budget) return res.status(400).json({ error: `Hijacking this deal costs £${price}m and that is over your budget.` });
  if (club.squad.length >= 30) return res.status(400).json({ error: "Squad is full (30 max). Sell someone first." });
  const jilted = p.pendingDeal ? p.pendingDeal.toClub : (activeRivalOffers(game, p.id, user.team)[0] || {}).toClub;
  const offer = {
    id: game.offerSeq++, playerId: p.id, toClub: user.team, sellerClub: p.club,
    fee: price, week: game.round, direction: "outbound", buyerUser: user.name, hijack: true
  };
  romano(game, `🚀 HIJACK ATTEMPT: ${user.team} have stormed into the ${p.name} deal with a £${price}m package, trying to gazump ${jilted || "the competition"}. Chaos in the market.`);
  if (humanOf(game, p.club)) {
    offer.status = "pending_seller";
    log(game, `${user.team} are trying to hijack the ${p.name} deal with a £${price}m bid to ${p.club}.`);
  } else if (p.pendingDeal) {
    if (signedThisWeek(game, user)) return res.status(400).json({ error: "You already completed a signing this week. Hijacking an agreed deal registers him today, so come back after the matchweek." });
    delete p.pendingDeal;
    if (p.rating >= 85 && p.age > 22 && !BIG_CLUBS.includes(user.team) && Math.random() < 0.45) {
      offer.status = "player_declined";
      offer.note = `You gazumped ${jilted} but ${p.name} said no to your project. The original deal is dead too. Expensive chaos.`;
      romano(game, `❌ Twist: ${p.name} has rejected the hijack from ${user.team}. And the ${jilted} deal is off as well. Everyone loses.`);
    } else {
      const r = doTransfer(game, offer);
      if (r.ok) markSigning(game, user);
      offer.status = r.ok ? "accepted" : "failed";
      offer.note = r.ok ? `Hijack complete. You stole him from under ${jilted} for £${price}m.` : r.msg;
      if (r.ok) romano(game, `💥✅ HIJACKED and DONE: ${p.name} joins ${user.team}, not ${jilted}. £${price}m. One of the great window betrayals.`);
    }
  } else {
    resolveAiSellerOffer(game, offer);
    for (const o of activeRivalOffers(game, p.id, user.team)) {
      if (offer.status === "accepted") { o.status = "void"; o.note = `HIJACKED: ${user.team} gazumped your deal for ${p.name}.`; }
    }
  }
  game.offers.unshift(offer);
  game.offers = game.offers.slice(0, 200);
  save();
  res.json({ ok: true, offer, price });
});

app.post("/api/renegotiate", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  return res.status(400).json({ error: "Contracts never run out anymore. Your players stay until you sell or loan them." });
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const p = game.players[req.body.playerId];
  if (!p) return res.status(400).json({ error: "Player not found." });
  const mine = p.club === user.team || (p.loanOwner === user.team && p.club !== user.team);
  if (!mine) return res.status(400).json({ error: "He is not your player." });
  if (p.loanOwner && p.loanOwner !== user.team) return res.status(400).json({ error: "He is only on loan with you. His contract belongs to his parent club." });
  if (p.academy) return res.status(400).json({ error: "Academy contracts are handled by the academy." });
  const wage = Math.round(Number(req.body.wage) * 10) / 10;
  const years = Math.floor(Number(req.body.years));
  const role = String(req.body.role || "");
  const demands = {
    wantWage: Math.max(Math.round((p.wage || defaultWage(p)) * 1.05 * 10) / 10, Math.round(defaultWage(p) * 1.05 * 10) / 10),
    wantYears: 1,
    wantRole: SQUAD_ROLES[Math.max(0, ROLE_RANK[p.squadRole || defaultRole(p)] - 1)]
  };
  if (termsAccepted(demands, wage, years, role)) {
    p.wage = wage;
    p.contractYears = years;
    p.squadRole = role;
    log(game, `RENEWED: ${p.name} signs fresh terms at ${user.team}. £${wage}m a season for ${years} year${years > 1 ? "s" : ""} as ${role}.`);
    if (p.rating >= 84) romano(game, `✅ Contract news: ${p.name} has renewed with ${user.team} until ${2026 + game.season + years}. Big statement from the club.`);
    save();
    return res.json({ ok: true, accepted: true });
  }
  save();
  res.json({ ok: true, accepted: false, note: `${p.name} said no to those terms. His camp wants around £${demands.wantWage}m a season and no demotion below ${demands.wantRole}.` });
});

function respondInboundAccept(game, offer, p, res) {
  const seller = game.clubs[offer.sellerClub];
  const buyer = game.clubs[offer.fromClub];
  if (p.club !== offer.sellerClub) { offer.status = "void"; offer.note = "The player already left the club."; }
  else if (offer.kind === "loan") {
    if (buyer.squad.length >= 30) { offer.status = "failed"; offer.note = `${offer.fromClub} no longer have room.`; }
    else {
      seller.budget = Math.round((seller.budget + offer.fee) * 10) / 10;
      buyer.budget = Math.round((buyer.budget - offer.fee) * 10) / 10;
      seller.squad = seller.squad.filter(id => id !== p.id);
      stripFromLineup(seller, p.id);
      buyer.squad.push(p.id);
      p.loanOwner = offer.sellerClub;
      p.loanFee = offer.fee;
      p.club = offer.fromClub; p.league = buyer.league; p.listed = false;
      offer.status = "accepted";
      voidOtherOffers(game, p.id, offer.id);
      log(game, `LOAN: ${p.name} joins ${offer.fromClub} on loan from ${offer.sellerClub} until the end of the season, £${offer.fee}m loan fee.`);
      romano(game, `🟡 Loan agreed: ${p.name} to ${offer.fromClub} for the season. ${offer.sellerClub} bank ${fmtFee(offer.fee)} and keep his future.`);
    }
  }
  else if (seller.squad.length <= 16) { offer.status = "failed"; offer.note = "Squad too thin to sell. Sixteen senior players is the floor."; }
  else if (buyer.squad.length >= 30 || buyer.budget < offer.fee) { offer.status = "failed"; offer.note = `${offer.fromClub} pulled out of the deal.`; }
  else {
    seller.budget = Math.round((seller.budget + offer.fee) * 10) / 10;
    buyer.budget = Math.round((buyer.budget - offer.fee) * 10) / 10;
    seller.squad = seller.squad.filter(id => id !== p.id);
    stripFromLineup(seller, p.id);
    buyer.squad.push(p.id);
    p.club = offer.fromClub; p.league = buyer.league; p.listed = false;
    delete p.pendingDeal;
    giveDefaultContract(p);
    offer.status = "accepted";
    voidOtherOffers(game, p.id, offer.id);
    log(game, `TRANSFER: ${p.name} leaves ${offer.sellerClub} for ${offer.fromClub}, £${offer.fee}m.`);
    romano(game, `🚨✅ HERE WE GO! ${p.name} to ${offer.fromClub}, confirmed! ${fmtFee(offer.fee)} to ${offer.sellerClub}. Agreement completed, players and clubs all happy.`);
  }
  save();
  return res.json({ ok: true, offer });
}
app.post("/api/respond", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const offer = game.offers.find(o => o.id === Number(req.body.offerId));
  if (!offer) return res.status(404).json({ error: "Offer not found." });
  const p = game.players[offer.playerId];
  const action = req.body.action;
  const isSeller = user.team === offer.sellerClub;
  const isBuyer = offer.buyerUser === user.name;

  if (action === "withdraw" && isBuyer) {
    offer.status = "withdrawn";
    romano(game, `❌ ${offer.toClub || offer.sellerClub} have walked away from the ${p.name} deal. Negotiations over, the bid is withdrawn.`);
    save(); return res.json({ ok: true });
  }

  if ((action === "accept" || action === "counter") && !windowOpen(game)) {
    return res.status(400).json({ error: "The transfer window is shut. You can only decline or withdraw until it reopens." });
  }

  if (offer.status === "pending_seller" && isSeller) {
    if (action === "accept") {
      if (offer.direction === "inbound") {
        return respondInboundAccept(game, offer, p, res);
      } else {
        if (humanOf(game, offer.toClub) && offer.buyerUser) { completeSigning(game, offer, p); }
        else {
          const r = doTransfer(game, offer);
          offer.status = r.ok ? "accepted" : "failed";
          if (!r.ok) offer.note = r.msg;
        }
      }
    } else if (action === "decline") {
      offer.status = "declined";
      log(game, `${offer.sellerClub} rejected the £${offer.fee}m bid for ${p.name}.`);
      romano(game, `❌ ${offer.sellerClub} have rejected the bid for ${p.name}. Told the club consider him not for sale at that price. Deal off for now.`);
    } else if (action === "counter") {
      const cf = Math.round(Number(req.body.counterFee) * 10) / 10;
      if (!(cf > 0)) return res.status(400).json({ error: "Enter a counter fee." });
      offer.status = "countered"; offer.counterFee = cf;
      log(game, `${offer.sellerClub} want £${cf}m for ${p.name}.`);
      romano(game, `🔴 Talks continue for ${p.name}. ${offer.sellerClub} have sent a counter proposal, they want around ${fmtFee(cf)}. Ball now in the other court.`);
    }
    save(); return res.json({ ok: true });
  }

  if (offer.status === "countered" && (isBuyer || (offer.direction === "inbound" && isSeller))) {
    if (action === "accept" && offer.direction === "inbound" && isSeller) {
      // the buyer's last bid is still on the table even after you countered
      offer.status = "pending_seller";
      req.body.action = "accept";
      return respondInboundAccept(game, offer, p, res);
    }
    if (action === "accept") {
      offer.fee = offer.counterFee;
      if (offer.direction === "inbound") return res.status(400).json({ error: "Not applicable." });
      const sellerHuman = humanOf(game, offer.sellerClub);
      if (sellerHuman) {
        if (humanOf(game, offer.toClub) && offer.buyerUser) { completeSigning(game, offer, p); }
        else {
          const r = doTransfer(game, offer);
          offer.status = r.ok ? "accepted" : "failed";
          if (!r.ok) offer.note = r.msg;
        }
      } else {
        if (game.clubs[offer.toClub].budget < offer.fee) return res.status(400).json({ error: "That counter is over your budget." });
        resolveAiSellerOffer(game, offer);
      }
    } else if (action === "decline") offer.status = "withdrawn";
    else if (action === "counter" && isBuyer) {
      const cf = Math.round(Number(req.body.counterFee) * 10) / 10;
      if (!(cf > 0)) return res.status(400).json({ error: "Enter a fee." });
      if (cf > game.clubs[offer.toClub].budget) return res.status(400).json({ error: "Over budget." });
      offer.fee = cf;
      const sellerHuman = humanOf(game, offer.sellerClub);
      if (sellerHuman) { offer.status = "pending_seller"; log(game, `${offer.toClub} came back with £${cf}m for ${p.name}.`); }
      else resolveAiSellerOffer(game, offer);
    }
    save(); return res.json({ ok: true });
  }
  res.status(400).json({ error: "You can't respond to this offer." });
});

app.post("/api/list", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const p = game.players[req.body.playerId];
  if (!p || p.club !== user.team || p.academy) return res.status(400).json({ error: "Not your player." });
  if (p.loanOwner) return res.status(400).json({ error: "He is only here on loan, you can't list him." });
  p.listed = !p.listed;
  if (p.listed) { C.bumpMorale(p, C.T.LISTED_MORALE); log(game, `${p.name} has been transfer listed by ${user.team}.`); }
  save();
  res.json({ ok: true });
});

// ---------- loans, training, staff, reactions ----------
const STAFF = {
  scout: { cost: 15, name: "Chief scout" },
  youth: { cost: 20, name: "Youth coach" },
  physio: { cost: 10, name: "Head physio" },
  analyst: { cost: 10, name: "Match analyst" }
};

app.post("/api/release", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const p = game.players[req.body.playerId];
  if (!p) return res.status(400).json({ error: "Player not found." });
  if (p.loanOwner === user.team && p.club !== user.team) return res.status(400).json({ error: "He is out on loan. Recall him first, then you can terminate his contract." });
  if (p.club !== user.team) return res.status(400).json({ error: "He is not your player." });
  if (p.loanOwner && p.loanOwner !== user.team) return res.status(400).json({ error: "He is only here on loan. You cannot terminate another club's contract." });
  if (p.academy) return res.status(400).json({ error: "Academy kids cannot have their contracts terminated. Promote or keep them." });
  const club = game.clubs[user.team];
  if (club.squad.length <= 14) return res.status(400).json({ error: "Your squad is too thin to release anyone. Fourteen players is the floor." });
  const gks = club.squad.map(id => game.players[id]).filter(x => x && x.pos === "GK" && !x.academy).length;
  if (p.pos === "GK" && gks <= 1) return res.status(400).json({ error: "He is your only keeper. Sign another before releasing him." });
  const cost = 0.5;
  if (club.budget < cost) return res.status(400).json({ error: "Terminating a contract costs 0.5m in compensation and you cannot cover it." });
  club.budget = Math.round((club.budget - cost) * 10) / 10;
  club.squad = club.squad.filter(id => id !== p.id);
  stripFromLineup(club, p.id);
  if (club.trainFocus === p.id) club.trainFocus = null;
  p.loanOwner = null;
  // no free agent limbo: he signs somewhere smaller straight away
  const landing = Object.values(game.clubs).filter(c =>
    c.name !== user.team && !humanOf(game, c.name) && c.squad.length < 28 &&
    !(LEAGUES[c.league] || {}).playable && (game.leagueFixtures || {})[c.league]);
  const fallback = Object.values(game.clubs).filter(c => c.name !== user.team && !humanOf(game, c.name) && c.squad.length < 28);
  const dest = (landing.length ? landing : fallback)[Math.floor(Math.random() * (landing.length ? landing.length : fallback.length))];
  if (dest) {
    dest.squad.push(p.id);
    p.club = dest.name;
    p.league = dest.league;
    p.listed = false;
    log(game, `RELEASED: ${p.name} leaves ${user.team} and signs for ${dest.name} the same week. No free agents in this world.`);
  } else {
    p.club = "";
    p.league = "";
  }
  p.listed = false;
  voidOtherOffers(game, p.id, -1);
  if (p.rating >= 80 && p.club) romano(game, `\ud83d\udca3 ${p.name} leaves ${user.team} by mutual agreement and lands at ${p.club} within days. Ruthless business.`);
  save();
  res.json({ ok: true });
});

app.post("/api/signfree", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  return res.status(400).json({ error: "Free agents are gone. Every player belongs to a club now, buy or loan instead." });
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const p = game.players[req.body.playerId];
  if (!p) return res.status(400).json({ error: "Player not found." });
  if (p.club !== "") return res.status(400).json({ error: "He is not a free agent." });
  const club = game.clubs[user.team];
  if (club.squad.length >= 30) return res.status(400).json({ error: "Squad is full (30 max). Sell someone first." });
  p.club = user.team;
  p.league = club.league;
  p.loanOwner = null;
  delete p.pendingDeal;
  giveDefaultContract(p);
  club.squad.push(p.id);
  log(game, `FREE TRANSFER: ${p.name} signs for ${user.team} on a free. No fee, no drama.`);
  if (p.rating >= 80) romano(game, `\u270d\ufe0f Here we go, on a FREE: ${p.name} joins ${user.team}. The best kind of business.`);
  save();
  res.json({ ok: true });
});

app.post("/api/loanout", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!game.started) return res.status(400).json({ error: "Loans start with the season." });
  if (!windowOpen(game)) return res.status(400).json({ error: "The window is shut. Loans need an open window." });
  const p = game.players[Number(req.body.playerId)];
  const club = game.clubs[user.team];
  if (!p || p.club !== user.team || p.academy) return res.status(400).json({ error: "Not your player." });
  if (p.loanOwner) return res.status(400).json({ error: "He is already involved in a loan." });

  if (club.squad.length <= 15) return res.status(400).json({ error: "Your squad is too thin to loan anyone out." });
  const targets = leagueClubs(game, club.league).filter(n => !humanOf(game, n) && n !== user.team && game.clubs[n].squad.length < 30);
  if (!targets.length) return res.status(400).json({ error: "No club has room to take him right now." });
  const to = targets[Math.floor(Math.random() * targets.length)];
  const dest = game.clubs[to];
  club.squad = club.squad.filter(id => id !== p.id);
  stripFromLineup(club, p.id);
  dest.squad.push(p.id);
  p.loanOwner = user.team;
  p.club = to;
  p.league = dest.league;
  p.listed = false;
  if (club.trainFocus === p.id) club.trainFocus = null;
  voidOtherOffers(game, p.id, -1);
  log(game, `LOAN: ${p.name} (${p.age}) joins ${to} on loan from ${user.team} until the end of the season. He comes back sharper for the minutes.`);
  romano(game, `\ud83d\udfe1 Loan deal done: ${p.name} moves to ${to} on a season long loan from ${user.team}. Development move, no option to buy.`);
  save();
  res.json({ ok: true });
});

// recall fee scales with value: big names cost about 5m to bring home, small names about 300k
function recallFee(p) {
  return Math.min(5, Math.max(0.3, Math.round((p.value || 1) * 0.05 * 10) / 10));
}

app.post("/api/recall", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!game.started) return res.status(400).json({ error: "Nothing to recall before the season starts." });
  const p = game.players[Number(req.body.playerId)];
  if (!p || p.loanOwner !== user.team || p.club === user.team) return res.status(400).json({ error: "That player is not out on loan from your club." });
  const club = game.clubs[user.team];
  const holder = game.clubs[p.club];
  const fee = recallFee(p);
  if (club.budget < fee) return res.status(400).json({ error: `Recalling ${p.name} costs ${fee}m in compensation and you can't cover it.` });
  club.budget = Math.round((club.budget - fee) * 10) / 10;
  if (holder) {
    holder.budget = Math.round(((holder.budget || 0) + fee) * 10) / 10;
    holder.squad = holder.squad.filter(id => id !== p.id);
    stripFromLineup(holder, p.id);
  }
  const from = p.club;
  club.squad.push(p.id);
  p.club = user.team;
  p.league = club.league;
  delete p.loanOwner;
  log(game, `RECALL: ${user.team} cut the loan short and bring ${p.name} home from ${from} for ${fee}m in compensation.`);
  romano(game, `\ud83d\udd19 Loan recalled: ${p.name} is back at ${user.team}. ${from} pocket ${fee}m for the trouble.`);
  save();
  res.json({ ok: true, fee });
});

app.post("/api/loanin", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!game.started) return res.status(400).json({ error: "Loans start with the season." });
  if (!windowOpen(game)) return res.status(400).json({ error: "The window is shut. Loans need an open window." });
  const p = game.players[Number(req.body.playerId)];
  const club = game.clubs[user.team];
  if (!p || p.academy) return res.status(400).json({ error: "Player not found." });
  if (p.club === user.team) return res.status(400).json({ error: "He already plays for you." });
  if (humanOf(game, p.club)) return res.status(400).json({ error: "You can only loan from AI clubs. Talk to a real manager and buy instead." });
  if (p.rating > 85) return res.status(400).json({ error: "Clubs don't loan out their superstars. Anyone rated 86 or higher has to be bought." });
  if (p.loanOwner) return res.status(400).json({ error: "He is already out on loan." });
  const owner = game.clubs[p.club];
  if (owner.squad.length <= 14) return res.status(400).json({ error: `${p.club} are too thin to let him go.` });
  if (club.squad.length >= 30) return res.status(400).json({ error: "Squad is full (30 max)." });
  const loansIn = club.squad.map(id => game.players[id]).filter(x => x && x.loanOwner && x.loanOwner !== user.team).length;
  if (loansIn >= 3) return res.status(400).json({ error: "Three loans in per season is the limit." });
  if (user.loansIn && user.loansIn.week === game.round && user.loansIn.count >= 1) return res.status(400).json({ error: `You already took a loan in this week. One loan in per week, come back for ${p.name} after the matchweek.` });
  const fee = Math.max(1, Math.round(p.value * 0.1 * 10) / 10);
  if (club.budget < fee) return res.status(400).json({ error: `The loan fee is £${fee}m and you don't have it.` });
  user.loansIn = { week: game.round, count: 1 };
  club.budget = Math.round((club.budget - fee) * 10) / 10;
  owner.budget = Math.round((owner.budget + fee) * 10) / 10;
  owner.squad = owner.squad.filter(id => id !== p.id);
  stripFromLineup(owner, p.id);
  club.squad.push(p.id);
  p.loanOwner = owner.name;
  p.loanFee = fee;
  p.club = user.team;
  p.league = club.league;
  p.listed = false;
  voidOtherOffers(game, p.id, -1);
  log(game, `LOAN: ${p.name} joins ${user.team} on loan from ${owner.name} for a £${fee}m fee, with an option to buy at value.`);
  romano(game, `\ud83d\udfe1 Here we go, loan version: ${p.name} to ${user.team} on a season long deal! ${fmtFee(fee)} loan fee to ${owner.name}, option to buy included.`);
  save();
  res.json({ ok: true, fee });
});

app.post("/api/buyloan", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  if (!windowOpen(game)) return res.status(400).json({ error: "The window is shut. The option can be triggered once it reopens." });
  const p = game.players[Number(req.body.playerId)];
  const club = game.clubs[user.team];
  if (!p || p.club !== user.team || !p.loanOwner || p.loanOwner === user.team) return res.status(400).json({ error: "That player is not on loan at your club." });
  const owner = game.clubs[p.loanOwner];
  const price = p.value;
  if (club.budget < price) return res.status(400).json({ error: `The option to buy is his value, £${price}m. You don't have it.` });
  club.budget = Math.round((club.budget - price) * 10) / 10;
  if (owner) owner.budget = Math.round((owner.budget + price) * 10) / 10;
  const from = p.loanOwner;
  delete p.loanOwner;
  delete p.loanFee;
  log(game, `PERMANENT: ${user.team} trigger the option to buy on ${p.name}, £${price}m to ${from}.`);
  romano(game, `🚨✅ HERE WE GO! ${user.team} make the ${p.name} loan PERMANENT. Option to buy triggered, ${fmtFee(price)} to ${from}. Loved it there, staying for good.`);
  save();
  res.json({ ok: true });
});

app.post("/api/train", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const club = game.clubs[user.team];
  const raw = req.body.playerId;
  if (raw === null || raw === undefined || raw === "") { club.trainFocus = null; save(); return res.json({ ok: true }); }
  const p = game.players[Number(raw)];
  if (!p || p.club !== user.team || p.academy) return res.status(400).json({ error: "Not your player." });
  club.trainFocus = p.id;
  log(game, `${user.team} put ${p.name} on an individual training programme.`);
  save();
  res.json({ ok: true });
});

app.post("/api/staff", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  if (!user.team) return res.status(400).json({ error: "Pick a club first." });
  const key = req.body.key;
  const def = STAFF[key];
  if (!def) return res.status(400).json({ error: "No such staff role." });
  const club = game.clubs[user.team];
  club.staff = club.staff || {};
  if (club.staff[key]) return res.status(400).json({ error: "You already employ a " + def.name.toLowerCase() + "." });
  if (club.budget < def.cost) return res.status(400).json({ error: `A ${def.name.toLowerCase()} costs £${def.cost}m. You don't have it.` });
  club.budget = Math.round((club.budget - def.cost) * 10) / 10;
  club.staff[key] = true;
  log(game, `${user.team} hire a ${def.name.toLowerCase()} for £${def.cost}m. The upgrade is permanent.`);
  save();
  res.json({ ok: true });
});

const PEN_DIRS = ["left", "center", "right"];
app.post("/api/pens", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const so = (game.shootouts || {})[req.body.key];
  if (!so || so.done) return res.status(400).json({ error: "That shootout is over or does not exist." });
  const dir = req.body.dir;
  if (!PEN_DIRS.includes(dir)) return res.status(400).json({ error: "Pick left, center or right." });
  const kickMgr = so.kicker === "home" ? so.hMgr : so.aMgr;
  const saveMgr = so.kicker === "home" ? so.aMgr : so.hMgr;
  if (so.phase === "shoot") {
    if (kickMgr !== user.name) return res.status(403).json({ error: "It is not your kick." });
    so.pendingShot = dir;
    so.phase = "save";
    if (!saveMgr) resolveKick(game, so, so.pendingShot, aiDir());
  } else {
    if (saveMgr !== user.name) return res.status(403).json({ error: "It is not your save." });
    resolveKick(game, so, so.pendingShot, dir);
  }
  if (!so.done) autoAdvanceShootout(game, so);
  save();
  res.json({ ok: true });
});

const REACTS = ["\ud83d\ude02", "\ud83d\udd25", "\ud83d\udc80", "\ud83d\udc4f", "\ud83e\udd21", "\ud83d\ude2d"];
app.post("/api/react", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const e = req.body.emoji;
  if (!REACTS.includes(e)) return res.status(400).json({ error: "Pick one of the reactions." });
  game.reacts = game.reacts || [];
  const last = game.reacts[game.reacts.length - 1];
  if (last && last.n === user.name && Date.now() - last.t < 1200) return res.json({ ok: true });
  game.reacts.push({ n: user.name, e, t: Date.now() });
  game.reacts = game.reacts.slice(-30);
  save();
  res.json({ ok: true });
});

app.get("/api/state", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const myTeam = user.team;
  const myLeague = myTeam ? game.clubs[myTeam].league : "Premier League";
  const myFix = (game.leagueFixtures || {})[myLeague] || [];
  const relevantOffers = game.offers.filter(o =>
    o.buyerUser === user.name || o.sellerClub === myTeam || o.toClub === myTeam
  ).slice(0, 40);
  const clubsByLeague = {};
  for (const league of PLAYABLE) {
    clubsByLeague[league] = leagueClubs(game, league).map(t => ({
      name: t,
      manager: (humanOf(game, t) || {}).name || "AI",
      budget: game.clubs[t].budget,
      squadSize: game.clubs[t].squad.length
    }));
  }
  const tables = {};
  for (const league of Object.keys(game.leagueFixtures || {})) tables[league] = tableFor(game, league);
  res.json({
    code: game.code,
    signingsLeft: signedThisWeek(game, user) ? 0 : 1,
    you: user.name,
    host: game.host,
    started: game.started,
    season: game.season,
    round: game.round,
    seasonOver: game.started && game.round >= (game.totalRounds || 38),
    totalRounds: game.totalRounds || 38,
    users: Object.values(game.users).map(u => ({ name: u.name, team: u.team, nation: u.nation || null, play: (currentPlay(game, u) || {}).status || null })),
    playable: playableFixtures(game, user),
    myPlay: (() => {
      const p = currentPlay(game, user);
      return p ? { status: p.status, kind: p.kind, home: p.home, away: p.away, hg: p.hg, ag: p.ag } : null;
    })(),
    leagues: PLAYABLE,
    allLeagues: Object.keys(game.leagueFixtures || {}),
    myLeague,
    clubsByLeague,
    myClub: myTeam ? {
      name: myTeam,
      league: myLeague,
      budget: game.clubs[myTeam].budget,
      tactic: game.clubs[myTeam].tactic,
      lineup: game.clubs[myTeam].lineup || { xi: [], subs: [] },
      squad: game.clubs[myTeam].squad.map(id => game.players[id]).filter(Boolean).map(p => Object.assign({}, p, { cond: Object.assign(C.parts(p, game.clubs[myTeam], game.round), { eff: Math.round(effOf(game, p, myTeam) * 10) / 10 }) })),
      news: game.clubs[myTeam].news || [],
      academy: (game.clubs[myTeam].academy || []).map(id => game.players[id]).filter(Boolean).map(p => Object.assign({}, p, { cond: Object.assign(C.parts(p, game.clubs[myTeam], game.round), { eff: Math.round(effOf(game, p, myTeam) * 10) / 10 }) })),
      staff: game.clubs[myTeam].staff || {},
      trainFocus: game.clubs[myTeam].trainFocus !== undefined ? game.clubs[myTeam].trainFocus : null,
      conf: game.clubs[myTeam].conf !== undefined ? game.clubs[myTeam].conf : 60,
      loanedOut: Object.values(game.players).filter(p => p.loanOwner === myTeam && p.club !== myTeam).map(p => ({
        id: p.id, name: p.name, age: p.age, rating: p.rating, role: p.role || p.pos, club: p.club, fee: recallFee(p),
        cond: Object.assign(C.parts(p, game.clubs[p.club] || null, game.round), { eff: Math.round(effOf(game, p, p.club) * 10) / 10 })
      }))
    } : null,
    sacked: !!user.sacked,
    loansLeft: (user.loansIn && user.loansIn.week === game.round && user.loansIn.count >= 1) ? 0 : 1,
    travel: travelPlan(game, user),
    staffPrices: { scout: 15, youth: 20, physio: 10, analyst: 10 },
    lastEvents: game.lastEvents || {},
    aiDeals: game.aiDeals || 0,
    shootouts: Object.values(game.shootouts || {}).map(so => {
      const kickMgr = so.kicker === "home" ? so.hMgr : so.aMgr;
      const saveMgr = so.kicker === "home" ? so.aMgr : so.hMgr;
      let yourJob = null;
      if (!so.done && so.phase === "shoot" && kickMgr === user.name) yourJob = "shoot";
      if (!so.done && so.phase === "save" && saveMgr === user.name) yourJob = "save";
      return {
        key: so.key, cupTitle: so.cupTitle, home: so.home, away: so.away,
        hScore: so.hScore, aScore: so.aScore, kickNum: so.kickNum,
        phase: so.phase, kicker: so.kicker, done: !!so.done, winner: so.winner || null,
        hMgr: so.hMgr, aMgr: so.aMgr, yourJob,
        waitingOn: so.done ? null : (so.phase === "shoot" ? (kickMgr || "AI") : (saveMgr || "AI")),
        kicks: so.kicks.map(k => ({ team: k.team, taker: k.taker, goal: k.goal, dive: k.dive, dir: k.dir }))
      };
    }),
    reacts: (game.reacts || []).slice(-30),
    scoutTips: (myTeam && (game.clubs[myTeam].staff || {}).scout)
      ? Object.values(game.players)
          .filter(p => p.club !== myTeam && !p.academy && !p.loanOwner && p.age <= 21 && p.rating >= 79)
          .sort((a, b) => b.rating - a.rating).slice(0, 5)
          .map(p => ({ name: p.name, club: p.club, pos: p.pos, role: p.role, age: p.age, rating: p.rating, value: p.value, cond: Object.assign(C.parts(p, game.clubs[p.club] || null, game.round), { eff: Math.round(effOf(game, p, p.club) * 10) / 10 }) }))
      : null,
    myNation: user.nation || null,
    nations: Object.values(game.nations || {}).map(n => {
      const xi = nationXI(game, n.name);
      return {
        name: n.name,
        manager: n.manager,
        strength: Math.round(xi.reduce((s, p) => s + p.rating, 0) / (xi.length || 1)),
        players: n.playerIds.map(id => game.players[id]).filter(Boolean).map(p => ({ name: p.name, pos: p.pos, rating: p.rating, club: p.club }))
      };
    }),
    window: windowInfo(game),
    seasonAwards: (game.started && game.round >= (game.totalRounds || 38)) ? (() => {
      const out = {};
      for (const league of Object.keys(game.leagueFixtures || {})) {
        if (!(LEAGUES[league] || {}).playable) continue;
        const table = tableFor(game, league);
        if (!table.length) continue;
        const a = leagueAwards(game, league);
        const byMoney = table.map(r => game.clubs[r.team]).filter(Boolean)
          .sort((x, y) => (y.baseBudget !== undefined ? y.baseBudget : y.budget) - (x.baseBudget !== undefined ? x.baseBudget : x.budget))
          .map(c => c.name);
        let motss = null, bestOver = -99;
        table.forEach((row, i) => {
          const over = byMoney.indexOf(row.team) - i;
          if (over > bestOver) { bestOver = over; motss = row.team; }
        });
        const hu = motss && humanOf(game, motss);
        out[league] = {
          champion: table[0].team,
          championManager: humanOf(game, table[0].team) ? humanOf(game, table[0].team).name : "AI",
          boot: a.boot, ball: a.ball, pots: a.pots,
          motss: motss ? { club: motss, manager: hu ? hu.name : "AI", over: bestOver } : null,
          relegated: (LEAGUES[league] || {}).second ? table.slice(-3).map(r => r.team) : []
        };
      }
      return out;
    })() : null,
    lock: game.lock || { active: false, week: 0 },
    cups: Object.values(game.cups || {}).map(c => ({
      key: c.key,
      title: c.title,
      scope: c.scope || "club",
      winner: c.winner,
      weeks: c.weeks,
      roundIdx: c.roundIdx,
      rounds: c.rounds.map((ms, i) => ({
        week: c.weeks[i],
        name: (c.roundNames && c.roundNames[i]) || nameForMatches(ms.length),
        matches: ms
      }))
    })),
    tables,
    table: tables[myLeague] || [],
    statBoards: (() => {
      const out = {};
      for (const league of Object.keys(game.leagueFixtures || {})) out[league] = statBoards(game, league);
      return out;
    })(),
    thisWeek: (myFix[game.round] || []).map(m => ({ ...m, derby: isDerby(m.home, m.away) })),
    lastWeek: game.round > 0 ? (myFix[game.round - 1] || []).map(m => ({ ...m, derby: isDerby(m.home, m.away) })) : [],
    myFixtures: myTeam ? myFix.map((r, i) => {
      const m = r.find(x => x.home === myTeam || x.away === myTeam);
      return { week: i + 1, ...m };
    }) : [],
    offers: relevantOffers,
    feed: game.feed.slice(0, 40),
    romano: (game.romano || []).slice(0, 40),
    history: game.history || []
  });
});

app.get("/api/market", (req, res) => {
  const ctx = getCtx(req, res); if (!ctx) return;
  const { game, user } = ctx;
  const q = String(req.query.q || "").toLowerCase();
  const league = req.query.league || "";
  const pos = req.query.pos || "";
  let list = Object.values(game.players).filter(p => p.club !== user.team && p.club !== "" && !p.academy);
  if (req.query.wonder === "1") list = list.filter(p => p.age <= 21 && p.rating >= 82);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q));
  if (league) list = list.filter(p => p.league === league);
  if (pos) list = list.filter(p => p.pos === pos);
  list.sort((a, b) => b.rating - a.rating);
  const free = Object.values(game.players).filter(p => p.club === "").sort((a, b) => b.rating - a.rating);
  res.json({
    players: list.slice(0, 60).map(p => ({
      ...p,
      cond: Object.assign(C.parts(p, game.clubs[p.club] || null, game.round), { eff: Math.round(effOf(game, p, p.club) * 10) / 10 }),
      asking: askingPrice(game, p, p.club),
      humanOwned: !!humanOf(game, p.club),
      deal: p.pendingDeal ? { club: p.pendingDeal.toClub, fee: p.pendingDeal.fee } : null,
      nego: (activeRivalOffers(game, p.id, user.team)[0] || null) && { club: activeRivalOffers(game, p.id, user.team)[0].toClub },
      hijackPrice: hijackPrice(game, p, user.team)
    })),
    freeAgents: [],
    leagues: [...new Set(Object.values(game.players).map(p => p.league))].filter(l => l).sort()
  });
});



// small live numbers for the landing page stat row
let worldSize = null;
app.get("/floodlights/stats.json", (req, res) => {
  if (!worldSize) {
    const db = buildDatabase();
    worldSize = { clubs: Object.keys(db.clubs).length, players: Object.keys(db.players).length };
  }
  const list = Object.values(games);
  const seasons = list.reduce((n, g) => n + Math.max(0, (Number(g.season) || 1) - 1), 0);
  res.set("Cache-Control", "no-store");
  res.json({ clubs: worldSize.clubs, players: worldSize.players, leagues: PLAYABLE.length, rooms: list.length, seasons });
});

for (const layer of app.stack) {
  if (layer.route && typeof layer.route.path === "string" && layer.route.path.startsWith("/api/")) ownApi.add(layer.route.path);
}

module.exports = app;

// standalone mode, used by the test battery and handy for working on Floodlights alone
if (require.main === module) {
  const solo = express();
  solo.get("/", (req, res) => res.redirect("/floodlights/"));
  solo.use(app);
  const PORT = process.env.PORT || 3000;
  solo.listen(PORT, () => console.log(`Floodlights running on port ${PORT}`));
}
