/** Daily/weekly background systems: injuries healing, morale & trade requests, finances, hype, owner. */
import type { League, Player, ScheduledGame, TeamId } from "../types/game";
import { contractOf, newId, salaryIn, teamPlayers, isUserTeam } from "./helpers";
import { capStatus } from "../cap/payroll";
import { emptyRecord, winPct } from "../season/standings";
import { seasonTotal } from "../season/stats";
import { clamp } from "../util/rng";
import { refreshDepth } from "./transactions";

export function healInjuries(l: League, days = 1) {
  for (const p of Object.values(l.players)) {
    if (!p.injury) continue;
    p.injury.daysOut -= days;
    if (p.injury.daysOut <= 0) {
      const wasLong = p.injury.severity === "major" || p.injury.severity === "season-ending";
      p.injury = null;
      if (p.teamId) {
        refreshDepth(l, p.teamId);
        if (wasLong || isUserTeam(l, p.teamId) || p.ovr >= 80) l.news.unshift({ id: newId(l, "n"), date: l.date, type: "injury", text: `${p.name} has been cleared to return.`, teams: [p.teamId], players: [p.id] });
      }
    }
  }
}

export function applyInjury(l: League, p: Player, type: string, daysOut: number, severity: Player["injury"] extends infer I ? (I extends { severity: infer S } ? S : never) : never) {
  p.injury = { type, daysOut, severity, startDate: l.date, outForSeason: severity === "season-ending" };
  if (p.teamId) {
    refreshDepth(l, p.teamId);
    const notable = p.ovr >= 78 || isUserTeam(l, p.teamId) || severity !== "minor";
    if (notable)
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "injury", text: `${p.name} (${p.teamId}) - ${type}, expected out ${daysOut > 120 ? "for the season" : `about ${Math.max(1, Math.round(daysOut / 7))} week${daysOut >= 14 ? "s" : ""}`}.`, teams: [p.teamId], players: [p.id], important: severity === "season-ending" && p.ovr >= 80 });
  }
}

/** Weekly morale: minutes vs expectations, winning, contract, role; low morale can trigger a trade request. */
export function updateMorale(l: League) {
  for (const t of Object.keys(l.teams)) {
    const wp = winPct(l.standings[t] ?? emptyRecord(t));
    const ps = teamPlayers(l, t).sort((a, b) => b.ovr - a.ovr);
    ps.forEach((p, rank) => {
      const s = seasonTotal(l, p.id);
      const mpg = s.gp ? s.min / s.gp : 0;
      const expected = rank < 5 ? 30 : rank < 8 ? 20 : rank < 10 ? 12 : 4;
      const minutesDelta = (mpg - expected) / 10;
      const pers = p.personality;
      let target = 60;
      target += minutesDelta * (pers.playTime / 5);
      target += (wp - 0.5) * (pers.winning / 2.5);
      const c = contractOf(l, p);
      if (c && pers.money > 60) target += salaryIn(c, l.season) > 20e6 ? 4 : -3;
      if (l.teams[t].hype > 70) target += 3;
      if (p.injury) target -= 3;
      p.morale = Math.round(clamp(p.morale + (target - p.morale) * 0.25, 0, 100));
      if (!p.tradeRequest && p.morale < 22 && p.ovr >= 72 && pers.ego > 45 && s.gp >= 10) {
        p.tradeRequest = true;
        l.news.unshift({ id: newId(l, "n"), date: l.date, type: "request", text: `${p.name} has requested a trade from the ${l.teams[t].name}.`, teams: [t], players: [p.id], important: true });
      } else if (p.tradeRequest && p.morale > 50) p.tradeRequest = false;
    });
  }
}

/** Team chemistry from average morale and roster continuity. */
export function chemistry(l: League, t: TeamId): number {
  const ps = teamPlayers(l, t);
  if (!ps.length) return 50;
  const morale = ps.reduce((s, p) => s + p.morale, 0) / ps.length;
  const continuity = ps.filter((p) => p.seasonsWithTeam >= 1).length / ps.length;
  return clamp(morale * 0.7 + continuity * 30, 0, 100);
}

export function homeGameFinances(l: League, g: ScheduledGame) {
  const t = l.teams[g.home];
  const rec = l.standings[g.home] ?? emptyRecord(g.home);
  const wp = rec.w + rec.l ? winPct(rec) : 0.5;
  const base = 60 + t.market * 22;
  const priceEffect = (t.finances.ticketPrice - base) / base;
  const demand = clamp(0.72 + t.hype * 0.0028 + wp * 0.12 + (g.type === "playoffs" ? 0.2 : 0) - priceEffect * 0.55, 0.35, 1.0);
  const att = Math.round(t.arenaCapacity * demand);
  t.finances.attendance.push(att);
  const gate = att * t.finances.ticketPrice * (g.type === "playoffs" ? 1.6 : 1);
  const other = 1_100_000 + t.market * 420_000 + t.hype * 9_000; // concessions, sponsorship, local media per home game
  t.finances.revenue += gate + other;
  t.finances.cash += gate + other;
}

/** Daily payroll & operating expenses during the regular season (≈174 days). */
export function dailyExpenses(l: League) {
  for (const t of Object.keys(l.teams)) {
    const st = capStatus(l, t);
    const payroll = st.taxSalary / 174;
    const ops = 180_000;
    l.teams[t].finances.expenses += payroll + ops;
    l.teams[t].finances.cash -= payroll + ops;
  }
}

export function updateHypeAfterGame(l: League, g: ScheduledGame) {
  if (!g.result) return;
  const homeWon = g.result.homeScore > g.result.awayScore;
  const bump = g.type === "playoffs" ? 1.5 : 0.35;
  for (const [t, won] of [[g.home, homeWon], [g.away, !homeWon]] as const) {
    const team = l.teams[t];
    team.hype = clamp(team.hype + (won ? bump : -bump * 0.8), 0, 100);
  }
}

/** Season-end owner review: goals vs results → job security. */
export function ownerReview(l: League) {
  for (const t of Object.values(l.teams)) {
    const rec = l.standings[t.id] ?? emptyRecord(t.id);
    const wp = winPct(rec);
    const madePlayoffs = l.playoffs.some((s) => s.high === t.id || s.low === t.id);
    const profit = t.finances.revenue - t.finances.expenses;
    let delta = (wp - 0.5) * 40 + (madePlayoffs ? 8 : -4) + (profit > 0 ? 4 : -6);
    if (t.strategy.mode === "rebuilding") delta = delta * 0.5 + 4;
    t.owner.jobSecurity = Math.round(clamp(t.owner.jobSecurity + delta * (1 - t.owner.patience / 200), 0, 100));
  }
}

export function setOwnerGoals(l: League) {
  for (const t of Object.values(l.teams)) {
    const m = t.strategy.mode;
    t.owner.goals =
      m === "contending"
        ? [{ type: "win", target: 50 }, { type: "playoffs", target: 2 }]
        : m === "rebuilding"
          ? [{ type: "develop", target: 3 }, { type: "profit", target: 0 }]
          : [{ type: "playoffs", target: 1 }, { type: "profit", target: 0 }];
  }
}
