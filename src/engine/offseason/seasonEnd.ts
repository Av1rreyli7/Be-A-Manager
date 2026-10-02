/** Season end: awards → history → tax & finances → apron pick freezes → owner review → retirements/HOF. */
import type { League, Player, SeasonHistory } from "../types/game";
import { applyAwards, computeAwards, finalsMvp } from "../season/awards";
import { champion } from "../season/playoffs";
import { capStatus, cbaFor } from "../cap/payroll";
import { newId, seasonAge } from "../league/helpers";
import { ownerReview } from "../league/daily";
import { seasonTotal } from "../season/stats";
import { hashString } from "../ratings/ratings";
import { Rng } from "../util/rng";
import { seasonStartYear } from "../util/dates";

export function enterSeasonEnd(l: League, rng: Rng) {
  const hist: SeasonHistory = l.history.find((h) => h.season === l.season) ?? { season: l.season, awards: [] };
  if (!l.history.includes(hist)) l.history.push(hist);
  const champ = champion(l);
  if (champ) {
    hist.champion = champ;
    const fin = l.playoffs.find((s) => s.conference === "Finals")!;
    hist.runnerUp = fin.high === champ ? fin.low : fin.high;
    const fmvp = finalsMvp(l, champ);
    if (fmvp) {
      hist.finalsMvp = fmvp;
      l.players[fmvp].awards.push({ season: l.season, award: "Finals MVP", teamId: champ });
      hist.awards.push({ award: "Finals MVP", playerId: fmvp, teamId: champ, name: l.players[fmvp].name });
    }
    for (const p of Object.values(l.players)) if (p.teamId === champ && p.status === "active") p.awards.push({ season: l.season, award: "Champion", teamId: champ });
    l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `🏆 The ${l.teams[champ].fullName} are ${l.season} NBA champions!${fmvp ? ` ${l.players[fmvp].name} is Finals MVP.` : ""}`, teams: [champ], players: fmvp ? [fmvp] : [], important: true });
  }
  if (l.cup?.champion) {
    hist.cupChampion = l.cup.champion;
    hist.cupMvp = l.cup.mvp;
  }
  const awards = computeAwards(l);
  applyAwards(l, awards, hist);
  const headline = awards.filter((a) => ["MVP", "DPOY", "ROY", "6MOY", "MIP", "COY", "Clutch POY"].includes(a.award)).map((a) => `${a.award}: ${a.name}`).join(" · ");
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "award", text: `${l.season} awards - ${headline}`, teams: [], players: awards.filter((a) => a.playerId).map((a) => a.playerId!), important: true });
  hist.standings = Object.values(l.standings).map((r) => ({ teamId: r.teamId, w: r.w, l: r.l }));

  // single-season records
  for (const p of Object.values(l.players)) {
    const s = seasonTotal(l, p.id);
    if (s.gp < 40) continue;
    for (const [stat, v] of [["PPG", s.pts / s.gp], ["RPG", (s.oreb + s.dreb) / s.gp], ["APG", s.ast / s.gp], ["3PM", s.fg3m]] as const) {
      const rec = l.records.singleSeason.find((r) => r.stat === stat);
      if (!rec || v > rec.value) {
        l.records.singleSeason = l.records.singleSeason.filter((r) => r.stat !== stat);
        l.records.singleSeason.push({ stat, value: Math.round(v * 10) / 10, playerId: p.id, name: p.name, season: l.season });
      }
    }
  }

  // luxury tax & finances
  const cba = cbaFor(l, l.season);
  for (const t of Object.values(l.teams)) {
    const st = capStatus(l, t.id);
    t.taxHistory.push({ season: l.season, paid: st.taxBill });
    // teams below the minimum team salary pay the shortfall to their players
    if (st.taxSalary < st.minimumTeamSalary) {
      const short = st.minimumTeamSalary - st.taxSalary;
      t.finances.expenses += short;
      t.finances.cash -= short;
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `${t.fullName} finished ${(short / 1e6).toFixed(1)}M below the salary floor and pay the shortfall to their players.`, teams: [t.id], players: [] });
    }
    t.finances.expenses += st.taxBill;
    t.finances.cash -= st.taxBill;
    t.finances.history.push({ season: l.season, revenue: Math.round(t.finances.revenue), expenses: Math.round(t.finances.expenses), payroll: st.taxSalary, tax: st.taxBill, profit: Math.round(t.finances.revenue - t.finances.expenses) });
    // 2nd-apron penalty: first-round pick seven drafts out is frozen
    if (st.taxSalary > cba.secondApron.value) {
      const y = seasonStartYear(l.season) + 1 + (cba.trade.secondApronFrozenPickYearsOut - 1);
      const k = l.picks[`${y}-1-${t.id}`];
      if (k && k.owner === t.id) {
        k.frozen = true;
        l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `${t.fullName} finished above the 2nd apron - their ${y} first-round pick is frozen.`, teams: [t.id], players: [] });
      }
    }
  }
  ownerReview(l);
  processRetirements(l, rng);
}

export function retirementChance(p: Player, age: number): number {
  if (age < 31) return p.ovr < 45 ? 0.08 : 0;
  const base = Math.max(0, (age - 32) * 0.1);
  const decline = p.ovr < 60 ? 0.35 : p.ovr < 68 ? 0.15 : p.ovr < 76 ? 0.04 : 0;
  const star = p.ovr >= 82 ? -0.15 : 0;
  return Math.max(0, Math.min(0.97, base + decline + star + (age >= 40 ? 0.4 : 0)));
}

function legacyNote(l: League, p: Player): string {
  const career = p.stats.reduce((acc, s) => ({ gp: acc.gp + s.regular.gp, pts: acc.pts + s.regular.pts }), { gp: 0, pts: 0 });
  const realGp = p.realStats.reduce((a, s) => a + s.gp, 0);
  const counts = (award: string) => p.awards.filter((a) => a.award === award).length;
  const bits: string[] = [];
  if (counts("Champion")) bits.push(`${counts("Champion")}× champion`);
  if (counts("MVP")) bits.push(`${counts("MVP")}× MVP`);
  if (counts("All-Star")) bits.push(`${counts("All-Star")}× All-Star (this save)`);
  const allNba = p.awards.filter((a) => a.award.startsWith("All-NBA")).length;
  if (allNba) bits.push(`${allNba}× All-NBA`);
  bits.push(`${p.experience} seasons`);
  if (career.gp) bits.push(`${(career.pts / career.gp).toFixed(1)} ppg in this save over ${career.gp} games`);
  else if (realGp) bits.push(`${realGp} games in the last three real seasons`);
  return bits.join(", ");
}

function hofScore(p: Player): number {
  const c = (a: string) => p.awards.filter((x) => x.award === a).length;
  const allNba = p.awards.filter((a) => a.award.startsWith("All-NBA")).length;
  return c("MVP") * 25 + c("Finals MVP") * 15 + c("Champion") * 6 + allNba * 7 + c("All-Star") * 3 + c("DPOY") * 8 + (p.ovr >= 90 ? 20 : 0) + p.experience;
}

export function processRetirements(l: League, rng: Rng) {
  const retiring: Player[] = [];
  for (const p of Object.values(l.players)) {
    if (p.status !== "active" && p.status !== "fa") continue;
    const age = seasonAge(p, l.season);
    const c = p.contractId ? l.contracts[p.contractId] : null;
    const hasFutureYears = !!c?.years.some((y) => seasonStartYear(y.season) > seasonStartYear(l.season) && y.guaranteed > 0);
    let chance = retirementChance(p, age);
    if (hasFutureYears) chance *= age >= 38 ? 0.4 : 0.05; // players rarely walk away from guaranteed money
    if (rng.chance(chance)) retiring.push(p);
  }
  for (const p of retiring) {
    l.nextId += 1;
    const team = p.teamId;
    if (p.contractId) delete l.contracts[p.contractId];
    p.contractId = null;
    p.status = "retired";
    p.retiredSeason = l.season;
    p.teamId = null;
    p.legacy = legacyNote(l, p);
    const hs = hofScore(p);
    if (hs >= 70) {
      p.hallOfFame = true;
      p.awards.push({ season: l.season, award: "Hall of Fame" });
    }
    // jersey retirement by a long-time team
    if (team && p.jersey && (p.hallOfFame || hs >= 45) && p.seasonsWithTeam >= 5) l.teams[team].retiredNumbers.push({ number: p.jersey, playerName: p.name, season: l.season });
    if (p.ovr >= 72 || p.hallOfFame || (team && l.userTeams.includes(team)))
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "retirement", text: `${p.name} announces retirement - ${p.legacy}.${p.hallOfFame ? " A future Hall of Famer." : ""}`, teams: team ? [team] : [], players: [p.id], important: p.ovr >= 80 });
  }
  void hashString;
  return retiring.length;
}
