// Floodlights player interest: how keen a player is to join a given club, FC27 style.
// Pure maths over the game state, no routes and no saving. The server requires this file.
//
// Levels: 0 Very Low, 1 Low, 2 Medium, 3 High. A club's standing (its "level") is worked out from the
// squad, the league, the money, the name (the big clubs), recent trophies, the table, form and Europe.
// A player compares the club that wants him with his own club, then his own situation moves it:
// happiness and minutes, contract, age and career stage, coming home, and whether the club needs his position.
// The club level numbers are cached per game per week, so the market can ask for 60 rows cheaply.
// Event bumps (game.interestBumps) and a "no" this window (game.interestNo) live in the save.

const { LEAGUES } = require("./world_pack");

const LABELS = ["Very Low", "Low", "Medium", "High"];

const T = {
  // where the score turns into a level
  HIGH: 1.2, MEDIUM: -1.6, LOW: -4.6,
  // club level parts
  LEAGUE_W: 7, BIG_CLUB: 2.5, WEALTH_W: 1.4, WEALTH_BASE: 40, WEALTH_MIN: -4, WEALTH_MAX: 4.5,
  TITLE: 2.5, EURO_WIN: 2, CUP_WIN: 0.7, HISTORY_MAX: 5, HISTORY_FADE: [1, 0.7, 0.5, 0.35, 0.25],
  TABLE_W: 3, LAST_TABLE_W: 2.5, FORM_W: 0.8, UCL: 2, UEL: 1, UECL: 0.5,
  // the player's view
  GAP_W: 0.42, GAP_MIN: -7, GAP_MAX: 4.5, LEAGUE_GAP_SHARE: 0.5,
  // a deal the player turns down is off for the rest of the window, so a manager cannot re roll it
  ACCEPT: [0.06, 0.3, 0.68, 1], ACCEPT_SCOUT: [0.1, 0.38, 0.78, 1], ACCEPT_CAP: 0.85,
  // AI clubs: a light version, a very low player never drops down, a low one half the time
  AI_LOW_SKIP: 0.5
};

// the country a league sits in, for "coming home". Leagues not listed have no home nation in the game.
const LEAGUE_COUNTRY = {
  "Premier League": "England", "Championship": "England", "La Liga": "Spain", "La Liga 2": "Spain",
  "Serie A": "Italy", "Serie B": "Italy", "Bundesliga": "Germany", "2. Bundesliga": "Germany",
  "Ligue 1": "France", "Ligue 2": "France", "Eredivisie": "Netherlands", "Primeira Liga": "Portugal",
  "Belgian Pro League": "Belgium", "Super Lig": "Turkey", "Scottish Premiership": "Scotland",
  "MLS": "USA", "Liga MX": "Mexico", "Brasileirao": "Brazil", "Argentina": "Argentina", "Croatia": "Croatia"
};

// the reason lines a player gives, short and plain, and the sentence used when he turns a deal down
const WHY = {
  stepUp: "Your club is a step up",
  stepDown: "Your club is a step down",
  leagueUp: "Your league is a step up",
  leagueDown: "Your league is a step down",
  happy: "Happy at his club",
  unhappy: "Unhappy at his club",
  minutes: "Wants more minutes",
  bench: "Would be a squad player for you",
  stage: "Wants a bigger stage",
  shortDeal: "Short contract, open to a move",
  longDeal: "Long contract, settled in",
  europe: "Wants Europe",
  noEurope: "You are not in Europe",
  home: "Would be coming home",
  homeNow: "Settled in his home country",
  need: "You need his position",
  trophies: "Wants to win trophies",
  noTrophies: "Wants a club that wins trophies",
  listed: "Transfer listed, wants out",
  newChallenge: "Open to a new challenge",
  settled: "Loves life at his club",
  keen: "Keen on your club",
  saidNo: "Already said no this window",
  neutral: "No strong feelings either way",
  openOffer: "Will listen to the right offer"
};
const NO_LINE = {
  stepDown: "He sees your club as a step down.",
  leagueDown: "He does not want to drop to a weaker league.",
  happy: "He is happy at his club.",
  bench: "He thinks he would be a squad player for you.",
  stage: "He wants a bigger stage than yours.",
  longDeal: "He is settled on a long deal where he is.",
  noEurope: "He wants to play in Europe and you are not there.",
  homeNow: "He is settled in his home country.",
  noTrophies: "He wants a club that wins trophies.",
  settled: "He loves life at his club.",
  saidNo: "He already told you no this window."
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const senior = (game, id) => { const p = game.players[id]; return p && !p.academy ? p : null; };

// ---------- the weekly snapshot: club levels, Europe, tables, nationalities ----------
const cache = new Map();
function snapshot(game) {
  // a new week, a new season or any finished deal (offers, AI deals and loans all count up) starts it fresh
  const key = game.season + "|" + game.round + "|" + (game.history || []).length + "|" + (game.offerSeq || 0) + "|" + (game.aiDeals || 0) + "|" + (game.aiLoanDeals || 0);
  const hit = cache.get(game.code);
  if (hit && hit.key === key) return hit;
  const snap = { key, levels: new Map(), squadAvg: new Map(), tables: new Map(), europe: new Map(), nation: null, history: null };
  // Europe this season: everyone who entered a European cup
  for (const [k, w] of [["ucl", T.UCL], ["uel", T.UEL], ["uecl", T.UECL]]) {
    const cup = (game.cups || {})[k];
    if (!cup || !cup.rounds || !cup.rounds[0]) continue;
    const teams = cup.rounds[0].flatMap(m => [m.home, m.away]).concat(cup.byes || []);
    for (const t of teams) if (t && !(snap.europe.get(t) >= w)) snap.europe.set(t, w);
  }
  // trophies in the last few seasons, newest counts most
  const hist = {};
  const seasons = (game.history || []).slice(-T.HISTORY_FADE.length).reverse();
  seasons.forEach((h, i) => {
    const fade = T.HISTORY_FADE[i];
    for (const club of Object.values(h.champions || {})) if (club) hist[club] = (hist[club] || 0) + T.TITLE * fade;
    for (const [k, c] of Object.entries(h.cupWinners || {})) {
      if (!c || !c.winner || k === "intl") continue;
      hist[c.winner] = (hist[c.winner] || 0) + (k === "ucl" ? T.EURO_WIN : T.CUP_WIN) * fade;
    }
  });
  snap.history = hist;
  cache.set(game.code, snap);
  return snap;
}
function nationOf(game, snap, pid) {
  if (!snap.nation) {
    snap.nation = new Map();
    for (const [name, n] of Object.entries(game.nations || {})) for (const id of n.playerIds || []) if (!snap.nation.has(id)) snap.nation.set(id, name);
  }
  return snap.nation.get(pid) || null;
}
function squadAvg(game, snap, clubName) {
  if (snap.squadAvg.has(clubName)) return snap.squadAvg.get(clubName);
  const club = game.clubs[clubName];
  const r = club ? club.squad.map(id => senior(game, id)).filter(Boolean).map(p => p.rating).sort((a, b) => b - a).slice(0, 14) : [];
  const v = r.length ? r.reduce((s, x) => s + x, 0) / r.length : 60;
  snap.squadAvg.set(clubName, v);
  return v;
}
// rank (0 is top) and size of the league table this season, plus points per game over the last five
function tableInfo(game, snap, league) {
  if (snap.tables.has(league)) return snap.tables.get(league);
  const fixtures = (game.leagueFixtures || {})[league];
  const out = { rank: new Map(), size: 0, played: 0, form: new Map() };
  if (fixtures) {
    const rows = {};
    const last = {};
    for (const n of Object.keys(game.clubs)) if (game.clubs[n].league === league) { rows[n] = { pts: 0, gd: 0, gf: 0 }; last[n] = []; }
    for (const round of fixtures) for (const m of round) {
      if (m.hg === null || m.hg === undefined) continue;
      const h = rows[m.home], a = rows[m.away];
      if (!h || !a) continue;
      const hp = m.hg > m.ag ? 3 : m.hg === m.ag ? 1 : 0, ap = m.ag > m.hg ? 3 : m.hg === m.ag ? 1 : 0;
      h.pts += hp; a.pts += ap; h.gd += m.hg - m.ag; a.gd += m.ag - m.hg; h.gf += m.hg; a.gf += m.ag;
      last[m.home].push(hp); last[m.away].push(ap);
    }
    const order = Object.keys(rows).sort((x, y) => rows[y].pts - rows[x].pts || rows[y].gd - rows[x].gd || rows[y].gf - rows[x].gf);
    order.forEach((n, i) => out.rank.set(n, i));
    out.size = order.length;
    for (const [n, l] of Object.entries(last)) {
      out.played = Math.max(out.played, l.length);
      const five = l.slice(-5);
      if (five.length) out.form.set(n, five.reduce((s, x) => s + x, 0) / five.length);
    }
  }
  snap.tables.set(league, out);
  return out;
}

// how big a club looks to a player right now, in rating like points (about 60 for a small club, 100 for a giant)
function clubLevel(game, clubName, bigClubs) {
  const snap = snapshot(game);
  if (snap.levels.has(clubName)) return snap.levels.get(clubName);
  const club = game.clubs[clubName];
  if (!club) return { level: 55, league: 0, europe: 0, squad: 55, contender: false };
  const meta = LEAGUES[club.league] || {};
  const sq = squadAvg(game, snap, clubName);
  const league = T.LEAGUE_W * (meta.prize || 0.1);
  const money = club.baseBudget !== undefined ? club.baseBudget : club.budget;
  const wealth = clamp(T.WEALTH_W * Math.log2(Math.max(1, money || 1) / T.WEALTH_BASE), T.WEALTH_MIN, T.WEALTH_MAX);
  const big = (bigClubs || []).includes(clubName) ? T.BIG_CLUB : 0;
  const history = Math.min(T.HISTORY_MAX, snap.history[clubName] || 0);
  let table = 0, form = 0;
  const ti = tableInfo(game, snap, club.league);
  if (ti.size > 1 && ti.played >= 6 && ti.rank.has(clubName)) {
    table = (0.5 - ti.rank.get(clubName) / (ti.size - 1)) * T.TABLE_W;
    form = (ti.form.get(clubName) - 1.35) * T.FORM_W;
  } else {
    // early in the season the table means little: last season's finish speaks instead
    const lt = (game.lastTables || {})[club.league];
    const idx = lt ? lt.indexOf(clubName) : -1;
    if (idx >= 0 && lt.length > 1) table = (0.5 - idx / (lt.length - 1)) * T.LAST_TABLE_W;
  }
  const europe = snap.europe.get(clubName) || 0;
  const level = sq + league + wealth + big + history + table + form + europe;
  const out = { level, league, europe, squad: sq, contender: europe >= T.UCL || history >= T.TITLE * 0.5 || (ti.rank.get(clubName) === 0 && ti.played >= 10) };
  snap.levels.set(clubName, out);
  return out;
}

// would he start? GK against the first keeper, outfield against the tenth best outfielder (the best XI rule)
function wouldStart(game, p, clubName) {
  const club = game.clubs[clubName];
  if (!club) return true;
  const mates = club.squad.map(id => senior(game, id)).filter(x => x && x.id !== p.id);
  if (p.pos === "GK") {
    const best = mates.filter(x => x.pos === "GK").sort((a, b) => b.rating - a.rating)[0];
    return !best || p.rating >= best.rating;
  }
  const out = mates.filter(x => x.pos !== "GK").sort((a, b) => b.rating - a.rating);
  return out.length < 10 || p.rating >= out[9].rating;
}
// a club is short in a position when it has fewer than the usual number there, or his rating beats the
// weakest of its starters in that spot by a couple of points
const POS_MIN = { GK: 2, DF: 6, MF: 6, FW: 4 };
function needsPosition(game, p, clubName) {
  const club = game.clubs[clubName];
  if (!club) return false;
  const same = club.squad.map(id => senior(game, id)).filter(x => x && x.pos === p.pos).sort((a, b) => b.rating - a.rating);
  if (same.length < (POS_MIN[p.pos] || 4)) return true;
  const starters = p.pos === "GK" ? 1 : p.pos === "DF" ? 4 : 3;
  const weakest = same[Math.min(starters, same.length) - 1];
  return !!weakest && p.rating >= weakest.rating + 2;
}
// is he playing at his own club: benched for weeks, or hardly starting once the season is going
function notPlaying(game, p) {
  if ((p.bn || 0) >= 3) return true;
  if (game.round >= 8 && p.ap && p.ap[0] < game.round * 0.35) return true;
  if (game.round >= 8 && !p.ap) return true;
  return !wouldStart(game, p, p.club);
}
// a star who is not going anywhere: the same idea as the server's settled rule
function settledStar(game, p, bigClubs) {
  if (!p || p.listed || !game.clubs[p.club]) return false;
  if (p.rating >= 88 && (bigClubs || []).includes(p.club)) return true;
  if (p.age <= 23 && p.rating >= 87) return true;
  const champs = (game.lastTables || {})[game.clubs[p.club].league];
  return !!(champs && champs[0] === p.club && p.rating >= 86);
}

// ---------- bumps from transfer events and a "no" this window ----------
function stamp(game) { return (game.season || 1) * 100 + (game.round || 0); }
function bumpFor(game, clubName, pid) {
  const b = ((game.interestBumps || {})[clubName] || {})[pid];
  if (!b) return 0;
  return stamp(game) <= b.until ? (b.by || 0) : 0;
}
// raises a player's interest in a club by one or two levels, through the end of the next window
function addBump(game, clubName, pid, by, until) {
  game.interestBumps = game.interestBumps || {};
  const m = game.interestBumps[clubName] = game.interestBumps[clubName] || {};
  m[pid] = { by: clamp(by, 1, 3), until };
  pruneBumps(game);
}
function pruneBumps(game) {
  const now = stamp(game);
  for (const [club, m] of Object.entries(game.interestBumps || {})) {
    for (const [id, b] of Object.entries(m)) if (!b || b.until < now) delete m[id];
    if (!Object.keys(m).length) delete game.interestBumps[club];
  }
  for (const [club, m] of Object.entries(game.interestNo || {})) {
    for (const [id, b] of Object.entries(m)) if (!b || b.until < now) delete m[id];
    if (!Object.keys(m).length) delete game.interestNo[club];
  }
}
// the last week of the window that is open (or the next one), as a stamp
function windowEnd(game) {
  const r = game.round || 0;
  return (game.season || 1) * 100 + (r <= 3 ? 3 : 22);
}
// the stamp a transfer event bump lasts to: the end of the next window
function bumpUntil(game) {
  const r = game.round || 0, s = game.season || 1;
  return r <= 3 ? s * 100 + 22 : (s + 1) * 100 + 3;
}
function saidNo(game, clubName, pid) {
  const b = ((game.interestNo || {})[clubName] || {})[pid];
  return !!(b && stamp(game) <= b.until);
}
function recordNo(game, clubName, pid) {
  game.interestNo = game.interestNo || {};
  const m = game.interestNo[clubName] = game.interestNo[clubName] || {};
  m[pid] = { until: windowEnd(game) };
  pruneBumps(game);
}

// ---------- the score ----------
// returns { score, lv, parts: [{ k, v }] } where parts are the signed pieces behind it
function rawScore(game, p, toClub, bigClubs) {
  const parts = [];
  const add = (k, v) => { if (v) parts.push({ k, v }); };
  const to = game.clubs[toClub];
  if (!to) return { score: -9, parts };
  const snap = snapshot(game);
  const there = clubLevel(game, toClub, bigClubs);
  const here = game.clubs[p.club] ? clubLevel(game, p.club, bigClubs) : { level: there.level - 4, league: there.league, europe: 0, squad: there.squad - 4, contender: false };
  // the step up or down, with the league part of it named on its own
  const leagueGap = there.league - here.league;
  const gap = clamp((there.level - here.level) * T.GAP_W, T.GAP_MIN, T.GAP_MAX);
  const leaguePart = clamp(leagueGap * T.GAP_W, T.GAP_MIN, T.GAP_MAX) * T.LEAGUE_GAP_SHARE;
  const clubPart = gap - (Math.sign(leaguePart) === Math.sign(gap) ? leaguePart : 0);
  if (Math.abs(leaguePart) >= 0.6 && Math.sign(leaguePart) === Math.sign(gap)) add(leaguePart > 0 ? "leagueUp" : "leagueDown", leaguePart);
  // a player who is not getting games will drop down for minutes, so a step down hurts him less
  const playing = !notPlaying(game, p);
  add(clubPart >= 0 ? "stepUp" : "stepDown", clubPart < 0 && (!playing || p.listed) ? clubPart * 0.55 : clubPart);
  // young players love a step up, a bit more than the rest
  if (p.age <= 23 && gap > 0) parts[parts.length - 1].v += gap * 0.25;
  // his level against their squad: far too good for them, or would sit on their bench
  const diff = p.rating - there.squad;
  const startsThere = wouldStart(game, p, toClub);
  if (diff > 3) add("stage", -(diff - 3) * (p.rating >= 84 ? 0.55 : 0.4));
  if (!startsThere && p.age <= 29) add("bench", -(p.age <= 23 ? 1.4 : 1));
  // happiness and minutes at his club
  const mo = p.mo || 0;
  if (p.listed) add("listed", 3);
  if (!playing && startsThere && p.age <= 32) add("minutes", 1.6);
  else if (!playing) add("unhappy", 0.6);
  if (mo <= -0.6) add("unhappy", -mo * 0.9);
  else if (playing && mo >= 0) add("happy", -0.8 - mo * 0.6);
  // contract: a short one opens the door, a long one keeps it shut a little
  const cy = p.contractYears === undefined ? 2 : p.contractYears;
  if (cy <= 1) add("shortDeal", 1.2);
  else if (cy >= 4) add("longDeal", -0.7);
  else if (cy >= 3) add("longDeal", -0.35);
  // career stage: older stars want trophies, older squad players are open to a new challenge
  if (p.age >= 30 && p.rating >= 82) add(there.contender ? "trophies" : "noTrophies", there.contender ? 1 : (here.contender ? -1.6 : -0.6));
  else if (p.age >= 31) add("newChallenge", 0.8);
  // Europe
  if (there.europe > 0 && here.europe === 0 && p.rating >= 74) add("europe", 1 + there.europe * 0.2);
  else if (here.europe > 0 && there.europe === 0 && p.rating >= 78) add("noEurope", -0.9 - here.europe * 0.3);
  // coming home: only players the game knows a nation for (the national squads)
  const nat = nationOf(game, snap, p.id);
  if (nat) {
    const home = LEAGUE_COUNTRY[to.league], now = game.clubs[p.club] ? LEAGUE_COUNTRY[game.clubs[p.club].league] : null;
    if (home === nat && now !== nat) add("home", 2);
    else if (now === nat && home !== nat) add("homeNow", -0.5);
  }
  // a light tactical fit: the club is short where he plays
  if (startsThere && needsPosition(game, p, toClub)) add("need", 0.8);
  if (settledStar(game, p, bigClubs)) add("settled", -2.5);
  const score = parts.reduce((s, x) => s + x.v, 0);
  return { score, parts };
}
function levelOf(score) {
  return score >= T.HIGH ? 3 : score >= T.MEDIUM ? 2 : score >= T.LOW ? 1 : 0;
}

// the full answer for the page: { lv, label, why: [two short reasons] }
function interest(game, p, toClub, bigClubs) {
  if (saidNo(game, toClub, p.id)) {
    const r = rawScore(game, p, toClub, bigClubs);
    const neg = r.parts.filter(x => x.v < 0).sort((a, b) => a.v - b.v);
    return { lv: 0, label: LABELS[0], why: [WHY.saidNo, neg.length ? WHY[neg[0].k] : WHY.happy] };
  }
  const r = rawScore(game, p, toClub, bigClubs);
  const base = levelOf(r.score);
  const bump = bumpFor(game, toClub, p.id);
  const lv = clamp(base + bump, 0, 3);
  return { lv, label: LABELS[lv], why: reasons(r.parts, lv, bump) };
}
// two reasons: the strongest pulls for a keen player, the strongest pushes for a cold one
function reasons(parts, lv, bump) {
  const pos = parts.filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const neg = parts.filter(x => x.v < 0).sort((a, b) => a.v - b.v);
  const keys = [];
  if (bump > 0) keys.push("keen");
  const first = lv >= 2 ? pos.concat(neg) : neg.concat(pos);
  for (const x of first) if (!keys.includes(x.k)) keys.push(x.k);
  const out = keys.slice(0, 2).map(k => WHY[k]);
  // two different lines always, even with little to say
  const pads = lv >= 2 ? [WHY.openOffer, WHY.neutral] : [WHY.neutral, WHY.openOffer];
  for (const pad of pads) if (out.length < 2 && !out.includes(pad)) out.push(pad);
  return out;
}
// the level only, for AI clubs and quick checks
function level(game, p, toClub, bigClubs) {
  if (saidNo(game, toClub, p.id)) return 0;
  return clamp(levelOf(rawScore(game, p, toClub, bigClubs).score) + bumpFor(game, toClub, p.id), 0, 3);
}
// the player's answer once the clubs agree a fee. Returns null for yes, or { lv, note } for no.
// A no is stored so the same player cannot be asked again until the window shuts.
function playerAnswer(game, p, toClub, bigClubs, opts) {
  const o = opts || {};
  const rng = o.rng || Math.random;
  if (saidNo(game, toClub, p.id)) return { lv: 0, note: `${p.name} already told ${toClub} no this window. Try again when the next window opens.`, line: NO_LINE.saidNo };
  const it = interest(game, p, toClub, bigClubs);
  const table = o.scout ? T.ACCEPT_SCOUT : T.ACCEPT;
  const chance = it.lv >= 3 ? 1 : Math.min(T.ACCEPT_CAP, table[it.lv]);
  if (rng() < chance) return null;
  recordNo(game, toClub, p.id);
  const r = rawScore(game, p, toClub, bigClubs);
  const neg = r.parts.filter(x => x.v < 0 && NO_LINE[x.k]).sort((a, b) => a.v - b.v);
  const line = neg.length ? NO_LINE[neg[0].k] : "He is happy where he is.";
  return { lv: it.lv, note: `${p.name} does not want the move. ${line} His interest in ${toClub} is ${it.label.toLowerCase()}, and he will not talk again until the next window.`, line };
}
// AI clubs: true when the player is willing to join an AI buyer
function aiWilling(game, p, toClub, bigClubs, rng) {
  const lv = levelOf(rawScore(game, p, toClub, bigClubs).score);
  if (lv === 0) return false;
  if (lv === 1) return (rng || Math.random)() >= T.AI_LOW_SKIP;
  return true;
}

module.exports = {
  T, LABELS, WHY, NO_LINE, LEAGUE_COUNTRY, clubLevel, rawScore, levelOf, interest, level, reasons, playerAnswer, aiWilling,
  addBump, bumpFor, bumpUntil, pruneBumps, saidNo, recordNo, windowEnd, stamp, wouldStart, needsPosition, notPlaying, settledStar, nationOf, snapshot
};
