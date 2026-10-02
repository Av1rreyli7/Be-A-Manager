/**
 * League calendar. `simDay` advances one day (games, injuries, events). `advancePhase` moves through the
 * offseason: season-end → lottery → pre-draft → draft → options → free agency → summer league →
 * training camp → preseason. `simTo` loops until a target.
 */
import type { BoxScore, DepthChart, League, Player, ScheduledGame, TeamId } from "../types/game";
import { SLOTS, slotPenalty } from "./positions";
import { addDays, dayOfWeek, seasonCalendar, seasonStartYear } from "../util/dates";
import { Rng } from "../util/rng";
import { simulateGame, type SimTeam } from "../sim/game";
import { severityOf } from "../sim/injuries";
import { autoDepth, eligibleForGame } from "./depth";
import { contractOf, newId, standardPlayers, teamPlayers, projectedWinPct, isTwoWay } from "./helpers";
import { applyResult, emptyRecord } from "../season/standings";
import { recordBox } from "../season/stats";
import { setupKnockout, groupTable } from "../season/cup";
import { onPlayInResult, onPlayoffResult, playInComplete, startPlayIn, startPlayoffs, champion } from "../season/playoffs";
import { selectAllStars, threePointContest, dunkContest, contestWinner, updateVotes } from "../season/allstar";
import { applyInjury, chemistry, dailyExpenses, healInjuries, homeGameFinances, updateHypeAfterGame, updateMorale, setOwnerGoals } from "./daily";
import { aiRosterMaintenance, autoTrimRoster, refreshDepth, signPlayer, waivePlayer } from "./transactions";
import { generateOffersToUser, runAiTrades, runSalaryDumps } from "../trade/ai";
import { updateStrategies } from "../trade/strategy";
import { enterSeasonEnd } from "../offseason/seasonEnd";
import { aiDraftPick, buildDraftOrder, currentPick, finishDraft, generateDraftClass, runCombine, runLottery } from "../offseason/draft";
import { finishFreeAgency, freeAgencyDay, processOptions, startFreeAgency } from "../offseason/freeAgency";
import { progressAll, runSummerLeague } from "../offseason/progression";
import { aiExtensions } from "../offseason/extensions";
import { generateSchedule } from "../season/schedule";
import { drawCupGroups } from "../season/cup";
import { computeAlerts } from "./alerts";
import { seasonLabel } from "../util/dates";

export interface DayReport {
  date: string;
  games: number;
  userGames: { id: string; home: TeamId; away: TeamId; homeScore: number; awayScore: number }[];
  phaseChanged?: string;
  stop?: string; // reason the sim must stop (user action required)
}

function rngOf(l: League) {
  return new Rng(l.rngState);
}

function simTeam(l: League, t: TeamId, playoffs: boolean): SimTeam {
  const team = l.teams[t];
  const players = teamPlayers(l, t).filter((p) => eligibleForGame(l, p, playoffs));
  // depth chart only references eligible players; auto charts are rebuilt per game
  const depth = team.depth.auto || !l.userTeams.includes(t) ? autoDepth(l, t, playoffs) : repairDepth(team.depth, players);
  const hc = Object.values(l.coaches).find((c) => c.teamId === t && c.role === "HC");
  return { id: t, name: team.name, players, depth, coach: { offense: hc?.offense ?? 55, defense: hc?.defense ?? 55 }, chemistry: chemistry(l, t) };
}


/** A manual lineup with an unavailable starter: replace him with the best healthy player at that position. */
function repairDepth(d: DepthChart, players: Player[]): DepthChart {
  const ok = new Map(players.map((p) => [p.id, p]));
  const starters = [...d.starters];
  const used = new Set(starters.filter((id) => ok.has(id)));
  SLOTS.forEach((slot, i) => {
    if (starters[i] && ok.has(starters[i])) return;
    const pool = players.filter((p) => !used.has(p.id)).sort((a, b) => slotPenalty(a, i) - slotPenalty(b, i) || b.ovr - a.ovr);
    if (pool[0]) {
      starters[i] = pool[0].id;
      used.add(pool[0].id);
    }
  });
  const minutes = { ...d.minutes };
  d.starters.forEach((id, i) => {
    if (starters[i] !== id && starters[i]) minutes[starters[i]] = Math.max(minutes[starters[i]] ?? 0, minutes[id] ?? 28);
  });
  return { ...d, starters: starters.slice(0, 5), rotation: d.rotation.filter((id) => ok.has(id) && !starters.includes(id)), minutes };
}

function playGame(l: League, g: ScheduledGame, rng: Rng) {
  const playoffs = g.type === "playoffs" || g.type === "play-in";
  const neutral = g.type === "cup-final" || g.id.includes("cupsf");
  const user = l.userTeams.includes(g.home) || l.userTeams.includes(g.away);
  const res = simulateGame(simTeam(l, g.home, playoffs), simTeam(l, g.away, playoffs), {
    rng,
    type: g.type,
    date: g.date,
    gameId: g.id,
    quarterMinutes: l.settings.quarterLength,
    pbp: user || playoffs,
    injuryRate: l.settings.injuryFrequency,
    homeCourt: !neutral,
  });
  finishGame(l, g, res.box, res.clutch);
  return user;
}

/** Everything that happens once a game has a final box score, however it was produced. */
function finishGame(l: League, g: ScheduledGame, box: BoxScore, clutch: Record<string, { pts: number; secs: number; pm: number }>) {
  g.played = true;
  g.result = box.summary;
  applyResult(l, g, box);
  recordBox(l, g, box, clutch, true);
  // two-way game counts
  for (const side of ["home", "away"] as const) for (const b of box.lines[side]) {
    const p = l.players[b.playerId];
    const c = contractOf(l, p);
    if (c?.type === "two-way" && b.min > 0) c.twoWayGames = (c.twoWayGames ?? 0) + 1;
  }
  for (const inj of box.injuries) applyInjury(l, l.players[inj.playerId], inj.type, inj.daysOut, severityOf(inj.type));
  homeGameFinances(l, g);
  updateHypeAfterGame(l, g);
  if (g.type === "play-in") onPlayInResult(l, g);
  if (g.type === "playoffs") onPlayoffResult(l, g);
  if (g.type === "cup-knockout" || g.type === "cup-final") onCupKnockout(l, g, box);
}

/**
 * Record a user game that was played outside the sim (Hardwood Legends).
 * Goes through the same bookkeeping as a simulated game. Returns an error message, or null.
 */
export function recordPlayedGame(l: League, gameId: string, box: BoxScore): string | null {
  const g = l.schedule.find((x) => x.id === gameId);
  if (!g) return "That game is no longer on the schedule.";
  if (g.played) return "That game has already been played.";
  if (!l.userTeams.includes(g.home) && !l.userTeams.includes(g.away)) return "That isn't one of your games.";
  if (box.home !== g.home || box.away !== g.away) return "The result doesn't match this matchup.";
  if (box.summary.homeScore === box.summary.awayScore) return "A game can't end in a tie.";
  finishGame(l, g, { ...box, gameId: g.id, date: g.date, type: g.type }, {});
  computeAlerts(l);
  return null;
}

function onCupKnockout(l: League, g: ScheduledGame, box: { lines: { home: { playerId: string; pts: number }[]; away: { playerId: string; pts: number }[] } }) {
  const cup = l.cup;
  if (!cup || !g.result) return;
  const winner = g.result.homeScore > g.result.awayScore ? g.home : g.away;
  const cal = seasonCalendar(seasonStartYear(l.season));
  const qf = cup.knockout.qf.find((x) => `${l.season}-${x.id}` === g.id);
  if (qf) qf.winner = winner;
  const sf = cup.knockout.sf.find((x) => `${l.season}-${x.id}` === g.id);
  if (sf) sf.winner = winner;
  if (cup.knockout.final && `${l.season}-${cup.knockout.final.id}` === g.id) {
    cup.knockout.final.winner = winner;
    cup.champion = winner;
    const lines = winner === g.home ? box.lines.home : box.lines.away;
    cup.mvp = [...lines].sort((a, b) => b.pts - a.pts)[0]?.playerId;
    if (cup.mvp) l.players[cup.mvp].awards.push({ season: l.season, award: "Cup MVP", teamId: winner });
    for (const p of teamPlayers(l, winner)) p.awards.push({ season: l.season, award: "Cup Champion", teamId: winner });
    l.news.unshift({ id: newId(l, "n"), date: g.date, type: "league", text: `The ${l.teams[winner].fullName} win the NBA Cup!${cup.mvp ? ` ${l.players[cup.mvp].name} is tournament MVP.` : ""}`, teams: [winner], players: cup.mvp ? [cup.mvp] : [], important: true });
  }
  // once all QFs are done: semifinals (neutral) + one extra game for QF losers
  if (cup.knockout.qf.length === 4 && cup.knockout.qf.every((x) => x.winner) && !cup.knockout.sf.length) {
    for (const conf of ["East", "West"] as const) {
      const qs = cup.knockout.qf.filter((x) => x.id.includes(conf));
      const sfId = `cupsf-${conf}`;
      cup.knockout.sf.push({ id: sfId, home: qs[0].winner!, away: qs[1].winner! });
      l.schedule.push({ id: `${l.season}-${sfId}`, date: cal.cupSemifinals, home: qs[0].winner!, away: qs[1].winner!, type: "cup-knockout", round: `Cup semifinal (${conf})`, played: false });
    }
    const losers = cup.knockout.qf.map((x) => (x.winner === x.home ? x.away : x.home));
    l.schedule.push({ id: `${l.season}-cupql-1`, date: cal.cupSemifinals, home: losers[0], away: losers[2], type: "regular", played: false });
    l.schedule.push({ id: `${l.season}-cupql-2`, date: cal.cupSemifinals, home: losers[3], away: losers[1], type: "regular", played: false });
  }
  if (cup.knockout.sf.length === 2 && cup.knockout.sf.every((x) => x.winner) && !cup.knockout.final) {
    const [e, w] = cup.knockout.sf;
    cup.knockout.final = { id: "cupfinal", home: e.winner!, away: w.winner! };
    l.schedule.push({ id: `${l.season}-cupfinal`, date: cal.cupFinal, home: e.winner!, away: w.winner!, type: "cup-final", round: "NBA Cup Championship", played: false });
  }
}

function runAllStar(l: League, rng: Rng) {
  if (!l.allStar?.rosters) selectAllStars(l);
  const as = l.allStar!;
  if (as.gameId) return;
  as.threePoint = threePointContest(l, rng);
  as.dunk = dunkContest(l, rng);
  as.threeWinner = contestWinner(as.threePoint);
  as.dunkWinner = contestWinner(as.dunk);
  const mk = (conf: "East" | "West"): SimTeam => {
    const players = as.rosters![conf].map((id) => l.players[id]).filter((p) => p && !p.injury);
    const starters = players.slice(0, 5).map((p) => p.id);
    const minutes: Record<string, number> = {};
    players.forEach((p, i) => (minutes[p.id] = i < 5 ? 24 : Math.round(120 / Math.max(1, players.length - 5))));
    return { id: conf === "East" ? "EAST" : "WEST", name: `Team ${conf}`, players, depth: { starters, rotation: players.slice(5).map((p) => p.id), minutes, auto: false }, coach: { offense: 70, defense: 40 }, chemistry: 50 };
  };
  const gid = `${l.season}-allstar`;
  const res = simulateGame(mk("East"), mk("West"), { rng, type: "all-star", date: l.date, gameId: gid, quarterMinutes: 12, pbp: true, injuryRate: 0, homeCourt: false, allStar: true });
  l.boxScores[gid] = res.box;
  as.gameId = gid;
  const eastWon = res.box.summary.homeScore > res.box.summary.awayScore;
  const lines = eastWon ? res.box.lines.home : res.box.lines.away;
  as.mvp = [...lines].sort((a, b) => b.pts + b.ast - (a.pts + a.ast))[0]?.playerId;
  if (as.mvp) l.players[as.mvp].awards.push({ season: l.season, award: "All-Star MVP" });
  if (as.threeWinner) l.players[as.threeWinner].awards.push({ season: l.season, award: "3-Point Contest" });
  if (as.dunkWinner) l.players[as.dunkWinner].awards.push({ season: l.season, award: "Slam Dunk Contest" });
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `All-Star Sunday: ${eastWon ? "East" : "West"} wins ${Math.max(res.box.summary.homeScore, res.box.summary.awayScore)}-${Math.min(res.box.summary.homeScore, res.box.summary.awayScore)}. MVP: ${as.mvp ? l.players[as.mvp].name : "-"}. 3-point contest: ${as.threeWinner ? l.players[as.threeWinner].name : "-"}. Dunk contest: ${as.dunkWinner ? l.players[as.dunkWinner].name : "-"}.`, teams: [], players: [as.mvp, as.threeWinner, as.dunkWinner].filter(Boolean) as string[], important: true });
}

/** Players released by March 1 remain playoff-eligible; after that AI teams stop buyouts. */
function buyoutPeriod(l: League, rng: Rng) {
  const cal = seasonCalendar(seasonStartYear(l.season));
  if (l.date <= cal.tradeDeadline || l.date > cal.buyoutDeadline) return;
  for (const t of Object.keys(l.teams)) {
    if (l.userTeams.includes(t) || l.teams[t].strategy.mode !== "rebuilding") continue;
    const vets = teamPlayers(l, t).filter((p) => p.ovr >= 70 && Number(l.date.slice(0, 4)) - Number(p.dob.slice(0, 4)) >= 31 && contractOf(l, p)?.years.length === 1);
    for (const v of vets) {
      if (!rng.chance(0.08)) continue;
      waivePlayer(l, v.id);
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "release", text: `${v.name} and the ${l.teams[t].name} agree to a buyout; contenders expected to pursue.`, teams: [t], players: [v.id], important: true });
      // a contender with an open spot signs him
      const dest = Object.keys(l.teams).filter((x) => l.teams[x].strategy.mode === "contending" && !l.userTeams.includes(x) && standardPlayers(l, x).length < 15);
      if (dest.length) aiRosterSignSpecific(l, rng.pick(dest), v.id);
    }
  }
}

function aiRosterSignSpecific(l: League, teamId: TeamId, playerId: string) {
  const p = l.players[playerId];
  const min = l.cba.minimumSalary.byService[Math.min(p.experience, l.cba.minimumSalary.byService.length - 1)];
  signPlayer(l, teamId, p, { salary: min, years: 1, raisePct: 0, option: null, method: "minimum" });
}

export function simDay(l: League): DayReport {
  const rng = rngOf(l);
  const report: DayReport = { date: l.date, games: 0, userGames: [] };
  const cal = seasonCalendar(seasonStartYear(l.season));
  if (l.phase === "free-agency") {
    freeAgencyDay(l, rng);
    if (l.freeAgency.day % 4 === 0) runAiTrades(l, rng, 1);
    if (l.freeAgency.day % 3 === 0) runSalaryDumps(l, rng, 2);
    l.rngState = rng.state;
    computeAlerts(l);
    return report;
  }
  if (!["preseason", "regular", "play-in", "playoffs"].includes(l.phase)) {
    report.stop = "Offseason - use the phase controls to continue";
    return report;
  }
  // preseason → regular season at tip-off
  if (l.phase === "preseason" && l.date >= cal.tipoff) {
    for (const t of l.userTeams) {
      // online: a friend who hasn't set their roster can't hold up the league - their coach trims it
      if (l.online && t !== l.online.hostTeam) {
        const n0 = standardPlayers(l, t).length;
        const tw0 = teamPlayers(l, t).filter((p) => isTwoWay(l, p)).length;
        if (n0 > l.cba.roster.maxStandard || tw0 > l.cba.roster.maxTwoWay || n0 < l.cba.roster.minStandard) autoTrimRoster(l, t);
        continue;
      }
      const n = standardPlayers(l, t).length;
      const tw = teamPlayers(l, t).filter((p) => isTwoWay(l, p)).length;
      if (n > l.cba.roster.maxStandard || tw > l.cba.roster.maxTwoWay) {
        report.stop = `${l.teams[t].name} must cut down to ${l.cba.roster.maxStandard} standard + ${l.cba.roster.maxTwoWay} two-way players before opening night (currently ${n} + ${tw}). Use Auto-fix on the Roster page to let the coach decide.`;
        return report;
      }
      if (n < l.cba.roster.minStandard) {
        report.stop = `${l.teams[t].name} need at least ${l.cba.roster.minStandard} standard players for opening night (currently ${n}). Sign free agents, or use Auto-fix on the Roster page.`;
        return report;
      }
    }
    for (const t of Object.keys(l.teams)) aiRosterMaintenance(l, t, { preseasonCut: true });
    for (const t of Object.values(l.teams)) t.preseasonExpectation = Math.round(projectedWinPct(l, t.id) * 82);
    setOwnerGoals(l);
    l.phase = "regular";
    report.phaseChanged = "regular";
    l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `Opening night of the ${l.season} season.`, teams: [], players: [], important: true });
  }

  // includes any game left behind on an earlier date (safety net so a season can never stall)
  const todays = l.schedule.filter((g) => g.date <= l.date && !g.played);
  for (const g of todays) {
    const user = playGame(l, g, rng);
    report.games++;
    if (user && g.result) report.userGames.push({ id: g.id, home: g.home, away: g.away, homeScore: g.result.homeScore, awayScore: g.result.awayScore });
  }

  if (l.phase === "regular") {
    dailyExpenses(l);
    // Cup knockout setup
    if (l.cup && !l.cup.knockout.qf.length && l.date >= cal.cupGroupEnd && l.schedule.filter((g) => g.type === "cup-group").every((g) => g.played)) {
      const { qfGames, extra } = setupKnockout(l, rng);
      l.schedule.push(...qfGames, ...extra);
      const adv = l.cup.knockout.qf.flatMap((x) => [x.home, x.away]);
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `NBA Cup knockout set: ${adv.join(", ")} advance to the quarterfinals. Group winners: ${Object.keys(l.cup.groups).map((gn) => groupTable(l, gn)[0].teamId).join(", ")}.`, teams: adv, players: [], important: true });
    }
    if (l.date === addDays(cal.allStarSunday, -14)) selectAllStars(l);
    if (l.date === cal.allStarSunday) runAllStar(l, rng);
    if (l.date === cal.tradeDeadline) l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: "Today is the trade deadline (3 p.m. ET).", teams: [], players: [], important: true });
    buyoutPeriod(l, rng);
    // ten-day contracts expire
    for (const c of Object.values(l.contracts)) {
      if (c.type === "10-day" && c.expires && c.expires <= l.date && c.playerId) {
        const p = l.players[c.playerId];
        delete l.contracts[c.id];
        p.contractId = null;
        const t = p.teamId!;
        p.teamId = null;
        p.status = "fa";
        l.nextId += 1;
        refreshDepth(l, t);
      }
    }
    if (dayOfWeek(l.date) === 1) {
      updateMorale(l);
      const played = Object.values(l.standings).reduce((s, r) => s + r.w + r.l, 0) / 30;
      if (played >= 15) updateStrategies(l);
      if (l.date < cal.tradeDeadline) runAiTrades(l, rng, rng.chance(0.6) ? 2 : 1);
      if (l.date >= `${seasonStartYear(l.season)}-12-20`) updateVotes(l);
      if (l.draft) l.draft.scoutingPoints += 8;
    }
    // deadline frenzy: extra AI activity in the final two weeks
    if (l.date <= cal.tradeDeadline && l.date >= addDays(cal.tradeDeadline, -14) && rng.chance(0.3)) runAiTrades(l, rng, 1);
    if (rng.chance(0.18)) generateOffersToUser(l, rng);
    for (const t of Object.keys(l.teams)) if (!l.userTeams.includes(t)) aiRosterMaintenance(l, t);
    // regular season complete?
    if (l.schedule.filter((g) => g.type === "regular" || g.type === "cup-group" || g.type === "cup-knockout" || g.type === "cup-final").every((g) => g.played)) {
      l.phase = "play-in";
      startPlayIn(l);
      report.phaseChanged = "play-in";
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: "The regular season is over. The Play-In Tournament begins.", teams: [], players: [], important: true });
    }
  } else if (l.phase === "play-in" && playInComplete(l)) {
    l.phase = "playoffs";
    startPlayoffs(l);
    for (const t of Object.keys(l.teams)) l.teams[t].depth = l.teams[t].depth.auto || !l.userTeams.includes(t) ? autoDepth(l, t, true) : l.teams[t].depth;
    report.phaseChanged = "playoffs";
  } else if (l.phase === "playoffs" && champion(l)) {
    l.phase = "season-end";
    enterSeasonEnd(l, rng);
    report.phaseChanged = "season-end";
    report.stop = "Season complete";
  }

  healInjuries(l, 1);
  if (l.phase !== "season-end") l.date = addDays(l.date, 1);
  // skip empty days in the playoffs quickly
  l.rngState = rng.state;
  computeAlerts(l);
  return report;
}

/** Move to the next offseason phase (or start the next season). */
export function advancePhase(l: League): string {
  const rng = rngOf(l);
  let msg = "";
  switch (l.phase) {
    case "season-end": {
      const cal = seasonCalendar(seasonStartYear(l.season));
      l.date = cal.draftLottery;
      if (!l.draft) l.draft = generateDraftClass(l, seasonStartYear(l.season) + 1, rng);
      const results = runLottery(l, rng);
      l.draft.lottery = { results, done: true };
      buildDraftOrder(l, results);
      l.phase = "draft-lottery";
      const top = results.slice(0, 4).map((r) => `#${r.pick} ${r.teamId}${r.pick < r.preLottery ? ` (jumped from ${r.preLottery})` : ""}`);
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "draft", text: `Draft lottery results: ${top.join(", ")}.`, teams: results.slice(0, 4).map((r) => r.teamId), players: [], important: true });
      msg = "Draft lottery complete";
      break;
    }
    case "draft-lottery":
      l.phase = "pre-draft";
      l.date = addDays(l.date, 3);
      runCombine(l, rng);
      if (l.draft) l.draft.scoutingPoints += 30;
      msg = "Combine results are in";
      break;
    case "pre-draft":
      l.phase = "draft";
      l.date = seasonCalendar(seasonStartYear(l.season)).draft;
      msg = "The draft is open";
      break;
    case "draft": {
      // auto-pick any remaining selections
      // any selections the user didn't make are auto-picked from that team's board
      while (currentPick(l)) aiDraftPick(l);
      finishDraft(l);
      runAiTrades(l, rng, 2);
      l.phase = "options";
      l.date = addDays(l.date, 2);
      processOptions(l);
      aiExtensions(l, rng);
      msg = "Option decisions and qualifying offers";
      break;
    }
    case "options":
      startFreeAgency(l, rng);
      // standings reset for the new league year
      l.standings = Object.fromEntries(Object.keys(l.teams).map((t) => [t, emptyRecord(t)]));
      msg = "Free agency is open";
      break;
    case "free-agency":
      finishFreeAgency(l, rng);
      l.phase = "summer-league";
      l.date = seasonCalendar(seasonStartYear(l.season)).summerLeague;
      runSummerLeague(l, rng, seasonLabel(seasonStartYear(l.season) - 1));
      msg = "Summer League complete";
      break;
    case "summer-league": {
      l.phase = "training-camp";
      l.date = seasonCalendar(seasonStartYear(l.season)).trainingCamp;
      progressAll(l, rng, seasonLabel(seasonStartYear(l.season) - 1));
      aiExtensions(l, rng);
      msg = "Training camp: player development revealed";
      break;
    }
    case "training-camp":
      runSalaryDumps(l, rng, 4);
      setupNewSeason(l, rng);
      msg = `The ${l.season} preseason has begun`;
      break;
    default:
      msg = "Use the sim controls to continue the season";
  }
  l.rngState = rng.state;
  computeAlerts(l);
  return msg;
}

export function setupNewSeason(l: League, rng: Rng) {
  const startYear = seasonStartYear(l.season);
  const prevRecords: Record<string, number> = {};
  const last = l.history.find((h) => h.season === seasonLabel(startYear - 1));
  for (const r of last?.standings ?? []) prevRecords[r.teamId] = r.w / Math.max(1, r.w + r.l);
  l.phase = "preseason";
  l.date = seasonCalendar(startYear).preseasonStart;
  l.standings = Object.fromEntries(Object.keys(l.teams).map((t) => [t, emptyRecord(t)]));
  l.playIn = [];
  l.playoffs = [];
  l.allStar = null;
  l.boxScores = {};
  l.gameLog = {};
  l.tradeOffers = [];
  const groups = l.settings.seasonLength >= 60 ? drawCupGroups(l, prevRecords, rng) : null;
  l.cup = groups ? { season: l.season, groups, knockout: { qf: [], sf: [] } } : null;
  l.schedule = generateSchedule(Object.values(l.teams), { startYear, gamesPerTeam: l.settings.seasonLength, cupGroups: groups }, rng);
  l.draft = generateDraftClass(l, startYear + 1, rng);
  for (const t of Object.keys(l.teams)) {
    l.teams[t].finances.revenue = 0;
    l.teams[t].finances.expenses = 0;
    l.teams[t].finances.attendance = [];
    aiRosterMaintenance(l, t);
    l.teams[t].depth = l.teams[t].depth.auto || !l.userTeams.includes(t) ? autoDepth(l, t) : l.teams[t].depth;
  }
  updateStrategies(l);
  l.history.push({ season: l.season, awards: [] });
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `Training camps open for the ${l.season} season.`, teams: [], players: [], important: true });
}

export type SimTarget = "day" | "week" | "month" | "deadline" | "allstar" | "regular-end" | "playoffs-end" | "next-user-game" | "game-day";

export function simTo(l: League, target: SimTarget, onProgress?: (r: DayReport) => void, opts: { team?: TeamId } = {}): DayReport[] {
  const mine = opts.team ? [opts.team] : l.userTeams;
  const reports: DayReport[] = [];
  const cal = seasonCalendar(seasonStartYear(l.season));
  const start = l.date;
  const stopDate =
    target === "day" ? start : target === "week" ? addDays(start, 6) : target === "month" ? addDays(start, 29) : target === "deadline" ? cal.tradeDeadline : target === "allstar" ? cal.allStarSunday : "9999-12-31";
  for (let i = 0; i < 400; i++) {
    // stop on the morning of a user game so it can be played by hand
    if (target === "game-day" && l.schedule.some((g) => !g.played && g.date <= l.date && (mine.includes(g.home) || mine.includes(g.away)))) break;
    const phaseBefore = l.phase;
    const r = simDay(l);
    reports.push(r);
    onProgress?.(r);
    if (r.stop) break;
    if (target === "regular-end" && phaseBefore === "regular" && l.phase !== "regular") break;
    if (target === "playoffs-end" && (l.phase as string) === "season-end") break;
    if (target === "next-user-game" && r.userGames.length) break;
    if (l.phase === "free-agency" && target !== "day" && target !== "week" && i >= 6) break;
    if (["day", "week", "month"].includes(target) && r.date >= stopDate) break;
    // land ON the deadline / All-Star day (still able to trade / watch the event), not the day after
    if ((target === "deadline" || target === "allstar") && l.date >= stopDate) break;
    if (!["preseason", "regular", "play-in", "playoffs", "free-agency"].includes(l.phase)) break;
  }
  return reports;
}

export { aiRosterMaintenance, runAllStar };
