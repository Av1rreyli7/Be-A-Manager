// Floodlights player interest check: multi season transfer numbers over the real API.
// Run: node scripts/dev/interest-check.js [worlds] [seasons]
//   FL_SERVER   the server file to boot (default floodlights/server.js). Point it at a copy of the old server
//               to get the baseline numbers with the same script.
//   FL_CHECK_PORT  port for that server (default 3204). FL_SAVE_FILE  its save file (default a temp file).
//   FL_CHECK_OUT   optional path for a JSON dump of the numbers.
// It measures, per transfer window: AI deals across the whole world (transfers plus loans), and what scripted
// human managers complete when they bid sensibly for realistic targets (a mid table Premier League club, a
// small Premier League club and a small Scottish club). With the interest model loaded (the current server)
// it also prints the interest spread by player band for a small, a mid and a big club, and how a club's
// pull changes after it wins its league.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SERVER = process.env.FL_SERVER || path.join(ROOT, "floodlights", "server.js");
const PORT = process.env.FL_CHECK_PORT || "3204";
const SAVE = process.env.FL_SAVE_FILE || path.join(os.tmpdir(), "fl-interest-check-" + PORT + ".json");
const BASE = "http://localhost:" + PORT;
const WORLDS = Number(process.argv[2] || 4);
const SEASONS = Number(process.argv[3] || 3);
const HUMANS = [["Mid", "Fulham"], ["Small", "Burnley"], ["Scot", "Hibernian"]];
const LEAGUES_TO_SHOP = ["Premier League", "Championship", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Eredivisie", "Primeira Liga", "Belgian Pro League", "Super Lig", "Scottish Premiership", "MLS", "Brasileirao", "Argentina", "Liga MX", "La Liga 2", "Serie B", "2. Bundesliga", "Ligue 2"];
const BIG = ["Man City", "Liverpool", "Arsenal", "Chelsea", "Man United", "Tottenham", "Newcastle", "Real Madrid", "Barcelona", "Atletico Madrid", "Bayern Munich", "Borussia Dortmund", "PSG", "Juventus", "Inter Milan", "AC Milan", "Napoli", "Al-Hilal", "Al-Nassr", "Al-Ittihad"];

let I = null;
try { I = require(path.join(ROOT, "floodlights", "interest.js")); } catch (e) { I = null; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(route, body) {
  const o = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
  const r = await fetch(BASE + route, o);
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
async function readGame(code, want) {
  await sleep(650);
  for (let i = 0; i < 40; i++) {
    try {
      const g = Object.values(JSON.parse(fs.readFileSync(SAVE, "utf8"))).find(x => x.code === code);
      if (g && (!want || want(g))) return g;
    } catch (e) {}
    await sleep(200);
  }
  throw new Error("save never caught up");
}
const windowOpenAt = r => r <= 3 || (r >= 19 && r <= 22);
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

// a sensible manager: the thinnest position first, a rating that improves the side but fits the club, a fee
// the budget can take, and (when the market shows it) skip anyone whose interest is very low
// it buys at most two players a window, so the January window still has money in it
async function shopWeek(code, name, stats, doneThisWindow) {
  if (doneThisWindow >= 2) return;
  const st = await api(`/api/state?code=${code}&name=${name}`);
  if (!st.j || !st.j.myClub || st.j.signingsLeft < 1) return;
  const club = st.j.myClub;
  const seniors = club.squad.filter(p => !p.academy);
  // keep room: release the weakest when the squad is getting full
  if (seniors.length >= 27) {
    const cut = seniors.filter(p => !p.loanOwner && p.pos !== "GK").sort((a, b) => a.rating - b.rating)[0];
    if (cut) await api("/api/release", { code, name, playerId: cut.id });
  }
  const outfield = seniors.filter(p => p.pos !== "GK").sort((a, b) => b.rating - a.rating);
  const xi = [seniors.filter(p => p.pos === "GK").sort((a, b) => b.rating - a.rating)[0]].concat(outfield.slice(0, 10)).filter(Boolean);
  const xiAvg = mean(xi.map(p => p.rating));
  const need = ["DF", "MF", "FW", "GK"].map(pos => {
    const here = seniors.filter(p => p.pos === pos).sort((a, b) => b.rating - a.rating);
    const k = pos === "GK" ? 1 : pos === "DF" ? 4 : 3;
    const top = here.slice(0, k);
    return { pos, weakest: top.length ? top[top.length - 1].rating : 50, score: (xiAvg - mean(top.map(p => p.rating))) + Math.max(0, ({ GK: 2, DF: 6, MF: 6, FW: 4 })[pos] - here.length) * 3 };
  }).sort((a, b) => b.score - a.score);
  const budget = club.budget;
  let tries = 0;
  for (const nd of need.slice(0, 2)) {
    let rows = [];
    for (const lg of LEAGUES_TO_SHOP) {
      const m = await api(`/api/market?code=${code}&name=${name}&league=${encodeURIComponent(lg)}&pos=${nd.pos}`);
      rows = rows.concat((m.j && m.j.players) || []);
    }
    const lo = Math.max(nd.weakest + 1, Math.round(xiAvg) - 2), hi = Math.round(xiAvg) + 5;
    let cands = rows.filter(p => !p.humanOwned && !p.loanOwner && !p.deal && p.rating >= lo && p.rating <= hi && p.asking <= budget * 0.45 && p.age <= 31);
    stats.seen += cands.length;
    if (cands.some(p => p.interest)) {
      const before = cands.length;
      cands = cands.filter(p => p.interest.lv >= 1);
      stats.skippedVeryLow += before - cands.length;
    }
    cands.sort((a, b) => ((b.interest ? b.interest.lv : 2) - (a.interest ? a.interest.lv : 2)) || (b.rating - a.rating));
    for (const p of cands.slice(0, 4)) {
      if (tries >= 3) return;
      tries++;
      stats.bids++;
      let r = await api("/api/offer", { code, name, playerId: p.id, fee: Math.min(budget, Math.round(p.asking * 10) / 10) });
      let off = r.j && r.j.offer;
      if (off && off.status === "countered" && off.counterFee <= budget) {
        await api("/api/respond", { code, name, offerId: off.id, action: "accept" });
        const s2 = await api(`/api/state?code=${code}&name=${name}`);
        off = (s2.j.offers || []).find(o => o.id === off.id) || off;
      }
      const status = off ? off.status : "error";
      stats.status[status] = (stats.status[status] || 0) + 1;
      if (off && p.interest) { stats.byLv[p.interest.lv].bids++; if (status === "accepted") stats.byLv[p.interest.lv].done++; if (status === "player_declined") stats.byLv[p.interest.lv].no++; }
      if (status === "accepted") { stats.done++; return; }
    }
  }
}

function band(g, p) {
  if (p.rating >= 85 && BIG.includes(p.club)) return "star at a big club (85+)";
  if (p.rating >= 85) return "star elsewhere (85+)";
  if (p.rating >= 80) return "good player (80 to 84)";
  if (p.rating >= 72) return "squad player (72 to 79)";
  return "lower rated (under 72)";
}
function spread(g, clubName) {
  const out = {};
  for (const p of Object.values(g.players)) {
    if (!p.club || p.club === clubName || p.academy || !g.clubs[p.club]) continue;
    const b = band(g, p);
    out[b] = out[b] || [0, 0, 0, 0];
    out[b][I.level(g, p, clubName, BIG)]++;
  }
  return out;
}
function pct(d) { const n = d.reduce((s, x) => s + x, 0) || 1; return d.map(x => Math.round(x / n * 100) + "%").join(" / ") + "  (n=" + n + ")"; }
// a club's pull on a fixed group of players: the share at medium or high and the average level
function pull(g, clubName, ids) {
  const lv = ids.map(id => g.players[id]).filter(p => p && p.club && p.club !== clubName).map(p => I.level(g, p, clubName, BIG));
  return { avg: +mean(lv).toFixed(2), mediumOrHigh: +(lv.filter(x => x >= 2).length / (lv.length || 1)).toFixed(3), high: +(lv.filter(x => x >= 3).length / (lv.length || 1)).toFixed(3), n: lv.length };
}

async function main() {
  try { fs.unlinkSync(SAVE); } catch (e) {}
  const srv = spawn("node", [SERVER], { env: Object.assign({}, process.env, { PORT, FL_SAVE_FILE: SAVE }), stdio: "ignore" });
  process.on("exit", () => { try { srv.kill(); } catch (e) {} });
  await sleep(1300);
  const windows = [];
  const human = {};
  for (const [, team] of HUMANS) human[team] = { perWindow: [], status: {}, byLv: [0, 1, 2, 3].map(() => ({ bids: 0, done: 0, no: 0 })), bids: 0, seen: 0, skippedVeryLow: 0 };
  const titles = [];
  const trEvents = [];
  let spreads = null;
  for (let w = 0; w < WORLDS; w++) {
    const c = await api("/api/create", { name: "Mid" });
    const code = c.j.code;
    for (const [n, team] of HUMANS) {
      if (n !== "Mid") await api("/api/join", { code, name: n });
      await api("/api/pick", { code, name: n, team });
    }
    await api("/api/start", { code, name: "Mid" });
    const starts = [];
    for (let s = 1; s <= SEASONS; s++) {
      const g0 = await readGame(code, g => g.season === s && g.round === 0);
      starts.push(g0);
      if (I && w === 0 && s === 1) spreads = { small: spread(g0, "Hibernian"), mid: spread(g0, "Fulham"), big: spread(g0, "Arsenal") };
      let open = null;
      const ai0 = { deals: g0.aiDeals || 0, loans: g0.aiLoanDeals || 0 };
      let winStart = g0;
      for (let r = 0; r < 38; r++) {
        if (r === 18) winStart = await readGame(code, gg => gg.round === 18 && gg.season === s);
        if (windowOpenAt(r)) {
          if (!open) open = { season: s, kind: r <= 3 ? "summer" : "january", world: w, human: {} };
          for (const [n, team] of HUMANS) {
            const stx = { done: 0, bids: 0, seen: 0, skippedVeryLow: 0, status: {}, byLv: [0, 1, 2, 3].map(() => ({ bids: 0, done: 0, no: 0 })) };
            await shopWeek(code, n, stx, open.human[team] || 0);
            open.human[team] = (open.human[team] || 0) + stx.done;
            const H = human[team];
            H.bids += stx.bids; H.seen += stx.seen; H.skippedVeryLow += stx.skippedVeryLow;
            for (const [k, v] of Object.entries(stx.status)) H.status[k] = (H.status[k] || 0) + v;
            stx.byLv.forEach((b, i) => { H.byLv[i].bids += b.bids; H.byLv[i].done += b.done; H.byLv[i].no += b.no; });
          }
        }
        await api("/api/sim", { code, name: "Mid" });
        // pending AI deals agreed in the last window week complete one week later, so a window closes at 5 and 24
        if (r === 4 || r === 23) {
          const g = await readGame(code, gg => gg.round === r + 1 && gg.season === s);
          const before = open.before || ai0;
          open.aiDeals = (g.aiDeals || 0) - before.deals;
          open.aiLoans = (g.aiLoanDeals || 0) - before.loans;
          // AI to AI permanent moves this window, and how keen each player was on his new club at the start
          if (I) {
            const humanClubs = new Set(Object.values(g.users).map(u => u.team).filter(Boolean));
            open.moves = [0, 0, 0, 0];
            open.starDrops = 0;
            for (const p of Object.values(g.players)) {
              const was = winStart.players[p.id];
              if (!was || !was.club || !p.club || was.club === p.club || p.loanOwner || was.loanOwner || humanClubs.has(p.club) || humanClubs.has(was.club) || !winStart.clubs[p.club]) continue;
              const lv = I.level(winStart, was, p.club, BIG);
              open.moves[lv]++;
              if (was.rating >= 84 && I.clubLevel(winStart, p.club, BIG).level < I.clubLevel(winStart, was.club, BIG).level - 8) open.starDrops++;
            }
          }
          windows.push(open);
          for (const [, team] of HUMANS) human[team].perWindow.push(open.human[team] || 0);
          open = null;
          if (r === 4) {
            // the next window counts from here
            const nb = { deals: g.aiDeals || 0, loans: g.aiLoanDeals || 0 };
            open = null;
            ai0.deals = nb.deals; ai0.loans = nb.loans;
          }
        }
      }
      // transfer window events this season, per manager (at most one each)
      const gEnd = await readGame(code, gg => gg.round === 38 && gg.season === s);
      for (const [, team] of HUMANS) {
        const tr = ((gEnd.clubs[team] || {}).tipped || []).filter(t => t.s === s);
        const news = ((gEnd.clubs[team] || {}).news || []).filter(x => x.e && x.e.k === "transfer" && tr.some(t => t.w === x.w));
        trEvents.push({ team, season: s, n: tr.length, weeks: tr.map(t => t.w), up: news.map(x => x.e.tr.from + ">" + x.e.tr.lv) });
      }
      if (s < SEASONS) await api("/api/nextseason", { code, name: "Mid" });
    }
    // after a title: each playable league champion's pull before the season and after it, on the same players
    if (I) {
      for (let s = 1; s < starts.length; s++) {
        const before = starts[s - 1], after = starts[s];
        const champs = (after.history || []).slice(-1)[0] || {};
        for (const [lg, club] of Object.entries(champs.champions || {})) {
          if (!["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "Eredivisie", "Primeira Liga", "Super Lig", "Scottish Premiership", "Belgian Pro League"].includes(lg)) continue;
          const lastBefore = (before.lastTables || {})[lg];
          if (lastBefore && lastBefore[0] === club) continue; // only a new title tells us something
          const ids = Object.values(before.players).filter(p => p.club && p.club !== club && !p.academy && Math.abs(p.rating - I.clubLevel(before, club, BIG).squad) <= 6).map(p => p.id);
          titles.push({ world: w, season: s, league: lg, club, before: pull(before, club, ids), after: pull(after, club, ids) });
        }
      }
    }
  }
  srv.kill();
  // ---------- report ----------
  const by = k => windows.filter(x => x.kind === k);
  const vol = list => ({ windows: list.length, aiDealsAvg: +mean(list.map(x => x.aiDeals)).toFixed(1), aiLoansAvg: +mean(list.map(x => x.aiLoans)).toFixed(1), totalAvg: +mean(list.map(x => x.aiDeals + x.aiLoans)).toFixed(1) });
  const moves = [0, 1, 2, 3].map(i => windows.reduce((s, x) => s + ((x.moves || [])[i] || 0), 0));
  const starDrops = windows.reduce((s, x) => s + (x.starDrops || 0), 0);
  const out = { server: path.relative(ROOT, SERVER), worlds: WORLDS, seasons: SEASONS, volume: { all: vol(windows), summer: vol(by("summer")), january: vol(by("january")) }, aiMovesByInterest: moves, aiStarDrops: starDrops, human: {}, spreads, titles };
  for (const [, team] of HUMANS) {
    const H = human[team];
    out.human[team] = { perWindowAvg: +mean(H.perWindow).toFixed(2), windowsWithOneOrMore: +(H.perWindow.filter(x => x >= 1).length / (H.perWindow.length || 1)).toFixed(2), windowsWithTwoOrMore: +(H.perWindow.filter(x => x >= 2).length / (H.perWindow.length || 1)).toFixed(2), perWindow: H.perWindow, bids: H.bids, status: H.status, skippedVeryLow: H.skippedVeryLow, byInterest: I && H.byLv.some(b => b.bids) ? H.byLv.map((b, i) => ({ lv: i, bids: b.bids, signed: b.done, playerSaidNo: b.no })) : undefined };
  }
  console.log("server: " + out.server + ", " + WORLDS + " worlds x " + SEASONS + " seasons");
  console.log("AI transfer volume per window (deals completed by AI clubs, plus AI loans):");
  console.table(out.volume);
  if (I) console.log("AI to AI permanent moves by the player's interest in the buyer at the window start (Very Low / Low / Medium / High): " + moves.join(" / ") + ", stars (84+) dropping to a much smaller club: " + starDrops);
  console.log("scripted human managers, signings per window:");
  console.table(Object.fromEntries(Object.entries(out.human).map(([k, v]) => [k, { perWindowAvg: v.perWindowAvg, oneOrMore: v.windowsWithOneOrMore, twoOrMore: v.windowsWithTwoOrMore, bids: v.bids, accepted: v.status.accepted || 0, playerSaidNo: v.status.player_declined || 0, clubSaidNo: v.status.declined || 0 }])));
  for (const [team, v] of Object.entries(out.human)) if (v.byInterest) console.log(team + " bids by interest level (lv, bids, signed, player said no): " + v.byInterest.map(b => `${b.lv}:${b.bids}/${b.signed}/${b.playerSaidNo}`).join("  "));
  if (spreads) {
    console.log("interest spread at the start, Very Low / Low / Medium / High:");
    for (const [k, s] of Object.entries(spreads)) { console.log("  " + k + " club (" + ({ small: "Hibernian", mid: "Fulham", big: "Arsenal" })[k] + ")"); for (const [b, d] of Object.entries(s)) console.log("    " + b.padEnd(26) + pct(d)); }
  }
  if (trEvents.some(t => t.n)) {
    const seasonsWith = trEvents.filter(t => t.n >= 1).length;
    console.log("transfer window events: " + seasonsWith + " of " + trEvents.length + " manager seasons had one, never more than one: " + trEvents.every(t => t.n <= 1) + ", weeks " + trEvents.flatMap(t => t.weeks).join(",") + ", interest before>after " + trEvents.flatMap(t => t.up).join(" "));
  }
  out.transferEvents = trEvents;
  if (titles.length) {
    console.log("new league champions, pull on the same players (rating within 6 of their squad) before and after the title:");
    console.table(titles.map(t => ({ season: t.season, league: t.league, club: t.club, avgBefore: t.before.avg, avgAfter: t.after.avg, midHighBefore: t.before.mediumOrHigh, midHighAfter: t.after.mediumOrHigh, highBefore: t.before.high, highAfter: t.after.high })));
    console.log("titles where the pull went up: " + titles.filter(t => t.after.avg > t.before.avg).length + " of " + titles.length);
  }
  if (process.env.FL_CHECK_OUT) fs.writeFileSync(process.env.FL_CHECK_OUT, JSON.stringify(out, null, 1));
  process.exit(0);
}
main().catch(e => { console.log("CRASH", e); process.exit(1); });
